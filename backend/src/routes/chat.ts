import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';
import { PushNotificationService } from '../services/push-notifications';

export const chatRoutes = new Hono<{ Bindings: Env }>();

// Todas las rutas requieren autenticación
chatRoutes.use('*', authMiddleware);

/**
 * GET /chat/conversations
 * Obtener todas las conversaciones del usuario
 */
chatRoutes.get('/conversations', async (c) => {
  try {
    const user = c.get('user');

    const column = user.role === 'passenger' ? 'passenger_id' : 'driver_id';

    const conversations = await c.env.DB.prepare(
      `SELECT
        c.*,
        p.full_name as passenger_name,
        d_user.full_name as driver_name,
        t.status as trip_status,
        t.pickup_address,
        t.dropoff_address
       FROM conversations c
       LEFT JOIN users p ON c.passenger_id = p.id
       LEFT JOIN users d_user ON c.driver_id = d_user.id
       LEFT JOIN trips t ON c.trip_id = t.id
       WHERE c.${column} = ?
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`
    )
      .bind(user.id)
      .all();

    return c.json({ conversations: conversations.results || [] });
  } catch (error: any) {
    console.error('Get conversations error:', error);
    return c.json({ error: error.message || 'Failed to get conversations' }, 500);
  }
});

/**
 * GET /chat/conversation/:trip_id
 * Obtener conversación de un viaje específico
 */
chatRoutes.get('/conversation/:trip_id', async (c) => {
  try {
    const user = c.get('user');
    const tripId = c.req.param('trip_id');

    const conversation = await c.env.DB.prepare(
      `SELECT c.*,
              p.full_name as passenger_name, p.phone as passenger_phone,
              d_user.full_name as driver_name, d_user.phone as driver_phone
       FROM conversations c
       LEFT JOIN users p ON c.passenger_id = p.id
       LEFT JOIN users d_user ON c.driver_id = d_user.id
       WHERE c.trip_id = ? AND (c.passenger_id = ? OR c.driver_id = ?)`
    )
      .bind(tripId, user.id, user.id)
      .first();

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    return c.json({ conversation });
  } catch (error: any) {
    console.error('Get conversation error:', error);
    return c.json({ error: error.message || 'Failed to get conversation' }, 500);
  }
});

/**
 * GET /chat/messages/:conversation_id
 * Obtener mensajes de una conversación
 */
chatRoutes.get('/messages/:conversation_id', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('conversation_id');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // Verificar que el usuario pertenece a la conversación
    const conversation = await c.env.DB.prepare(
      'SELECT * FROM conversations WHERE id = ? AND (passenger_id = ? OR driver_id = ?)'
    )
      .bind(conversationId, user.id, user.id)
      .first();

    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized' }, 404);
    }

    // Obtener mensajes
    const messages = await c.env.DB.prepare(
      `SELECT m.*,
              u.full_name as sender_name
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ? AND m.is_deleted = 0
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(conversationId, limit, offset)
      .all();

    return c.json({
      messages: (messages.results || []).reverse(), // Más antiguos primero
      has_more: (messages.results?.length || 0) === limit,
    });
  } catch (error: any) {
    console.error('Get messages error:', error);
    return c.json({ error: error.message || 'Failed to get messages' }, 500);
  }
});

/**
 * POST /chat/send
 * Enviar mensaje
 */
chatRoutes.post('/send', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { conversation_id, text_content, message_type = 'text', location_latitude, location_longitude } = body;

    // Verificar que el usuario pertenece a la conversación
    const conversation = await c.env.DB.prepare(
      'SELECT * FROM conversations WHERE id = ? AND (passenger_id = ? OR driver_id = ?)'
    )
      .bind(conversation_id, user.id, user.id)
      .first();

    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized' }, 404);
    }

    // Validar contenido
    if (message_type === 'text' && !text_content?.trim()) {
      return c.json({ error: 'Message text is required' }, 400);
    }

    const messageId = uuidv4();

    // Crear mensaje
    await c.env.DB.prepare(
      `INSERT INTO messages (
        id, conversation_id, trip_id, sender_id, sender_role,
        message_type, text_content, location_latitude, location_longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        messageId,
        conversation_id,
        conversation.trip_id,
        user.id,
        user.role,
        message_type,
        text_content || null,
        location_latitude || null,
        location_longitude || null
      )
      .run();

    // Obtener el mensaje creado
    const message = await c.env.DB.prepare(
      `SELECT m.*, u.full_name as sender_name
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`
    )
      .bind(messageId)
      .first();

    // Enviar push notification al destinatario
    const recipientId =
      user.id === conversation.passenger_id
        ? conversation.driver_id
        : conversation.passenger_id;

    const recipient = await c.env.DB.prepare(
      'SELECT push_token, full_name FROM users WHERE id = ?'
    )
      .bind(recipientId)
      .first();

    if (recipient && recipient.push_token) {
      const senderName = user.full_name || 'Usuario';
      const notificationBody =
        message_type === 'text'
          ? text_content
          : message_type === 'location'
          ? '📍 Ubicación compartida'
          : 'Nuevo mensaje';

      await PushNotificationService.sendPushNotification({
        to: recipient.push_token as string,
        title: senderName,
        body: notificationBody,
        data: {
          type: 'chat_message',
          conversation_id,
          message_id: messageId,
        },
        sound: 'default',
      });
    }

    // Crear notificación en la base de datos
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, data)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        uuidv4(),
        recipientId,
        user.full_name || 'Usuario',
        message_type === 'text' ? text_content : 'Nuevo mensaje',
        'chat_message',
        JSON.stringify({ conversation_id, message_id: messageId })
      )
      .run();

    return c.json({ message }, 201);
  } catch (error: any) {
    console.error('Send message error:', error);
    return c.json({ error: error.message || 'Failed to send message' }, 500);
  }
});

/**
 * PUT /chat/mark-read/:conversation_id
 * Marcar todos los mensajes como leídos
 */
chatRoutes.put('/mark-read/:conversation_id', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('conversation_id');

    // Verificar que el usuario pertenece a la conversación
    const conversation = await c.env.DB.prepare(
      'SELECT * FROM conversations WHERE id = ? AND (passenger_id = ? OR driver_id = ?)'
    )
      .bind(conversationId, user.id, user.id)
      .first();

    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized' }, 404);
    }

    // Marcar como leídos los mensajes que NO fueron enviados por el usuario
    await c.env.DB.prepare(
      `UPDATE messages
       SET is_read = 1, read_at = ?
       WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`
    )
      .bind(Math.floor(Date.now() / 1000), conversationId, user.id)
      .run();

    // Resetear contador de no leídos
    if (user.role === 'passenger') {
      await c.env.DB.prepare(
        'UPDATE conversations SET passenger_unread_count = 0 WHERE id = ?'
      )
        .bind(conversationId)
        .run();
    } else {
      await c.env.DB.prepare(
        'UPDATE conversations SET driver_unread_count = 0 WHERE id = ?'
      )
        .bind(conversationId)
        .run();
    }

    return c.json({ message: 'Messages marked as read' });
  } catch (error: any) {
    console.error('Mark read error:', error);
    return c.json({ error: error.message || 'Failed to mark messages as read' }, 500);
  }
});

/**
 * POST /chat/typing/:conversation_id
 * Indicar que el usuario está escribiendo
 */
chatRoutes.post('/typing/:conversation_id', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('conversation_id');
    const body = await c.req.json();
    const { is_typing = true } = body;

    // Verificar que el usuario pertenece a la conversación
    const conversation = await c.env.DB.prepare(
      'SELECT * FROM conversations WHERE id = ? AND (passenger_id = ? OR driver_id = ?)'
    )
      .bind(conversationId, user.id, user.id)
      .first();

    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized' }, 404);
    }

    if (is_typing) {
      // Crear o actualizar indicador de typing
      const expiresAt = Math.floor(Date.now() / 1000) + 5; // Expira en 5 segundos

      await c.env.DB.prepare(
        `INSERT INTO typing_indicators (id, conversation_id, user_id, is_typing, expires_at)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(conversation_id, user_id) DO UPDATE SET
           is_typing = 1,
           expires_at = ?,
           created_at = strftime('%s', 'now')`
      )
        .bind(uuidv4(), conversationId, user.id, expiresAt, expiresAt)
        .run();
    } else {
      // Eliminar indicador de typing
      await c.env.DB.prepare(
        'DELETE FROM typing_indicators WHERE conversation_id = ? AND user_id = ?'
      )
        .bind(conversationId, user.id)
        .run();
    }

    return c.json({ message: 'Typing indicator updated' });
  } catch (error: any) {
    console.error('Typing indicator error:', error);
    return c.json({ error: error.message || 'Failed to update typing indicator' }, 500);
  }
});

/**
 * GET /chat/typing/:conversation_id
 * Obtener si el otro usuario está escribiendo
 */
chatRoutes.get('/typing/:conversation_id', async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.param('conversation_id');

    // Verificar que el usuario pertenece a la conversación
    const conversation = await c.env.DB.prepare(
      'SELECT * FROM conversations WHERE id = ? AND (passenger_id = ? OR driver_id = ?)'
    )
      .bind(conversationId, user.id, user.id)
      .first();

    if (!conversation) {
      return c.json({ error: 'Conversation not found or unauthorized' }, 404);
    }

    // Limpiar indicadores expirados
    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare('DELETE FROM typing_indicators WHERE expires_at < ?')
      .bind(now)
      .run();

    // Obtener indicador del otro usuario
    const typing = await c.env.DB.prepare(
      `SELECT t.*, u.full_name
       FROM typing_indicators t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.conversation_id = ? AND t.user_id != ? AND t.is_typing = 1`
    )
      .bind(conversationId, user.id)
      .first();

    return c.json({
      is_typing: !!typing,
      user_name: typing?.full_name || null,
    });
  } catch (error: any) {
    console.error('Get typing indicator error:', error);
    return c.json({ error: error.message || 'Failed to get typing indicator' }, 500);
  }
});

/**
 * DELETE /chat/message/:message_id
 * Eliminar mensaje (soft delete)
 */
chatRoutes.delete('/message/:message_id', async (c) => {
  try {
    const user = c.get('user');
    const messageId = c.req.param('message_id');

    // Verificar que el mensaje pertenece al usuario
    const message = await c.env.DB.prepare(
      'SELECT * FROM messages WHERE id = ? AND sender_id = ?'
    )
      .bind(messageId, user.id)
      .first();

    if (!message) {
      return c.json({ error: 'Message not found or unauthorized' }, 404);
    }

    // Soft delete
    await c.env.DB.prepare(
      'UPDATE messages SET is_deleted = 1, deleted_at = ? WHERE id = ?'
    )
      .bind(Math.floor(Date.now() / 1000), messageId)
      .run();

    return c.json({ message: 'Message deleted successfully' });
  } catch (error: any) {
    console.error('Delete message error:', error);
    return c.json({ error: error.message || 'Failed to delete message' }, 500);
  }
});
