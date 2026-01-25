import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../utils/auth';
import { Env } from '../index';
import { PushNotificationService } from '../services/push-notifications';

export const emergencyRoutes = new Hono<{ Bindings: Env }>();

// Todas las rutas requieren autenticación
emergencyRoutes.use('*', authMiddleware);

/**
 * GET /emergency/contacts
 * Obtener contactos de emergencia del usuario
 */
emergencyRoutes.get('/contacts', async (c) => {
  try {
    const user = c.get('user');

    const contacts = await c.env.DB.prepare(
      'SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC'
    )
      .bind(user.id)
      .all();

    return c.json({ contacts: contacts.results || [] });
  } catch (error: any) {
    console.error('Get emergency contacts error:', error);
    return c.json({ error: error.message || 'Failed to get emergency contacts' }, 500);
  }
});

/**
 * POST /emergency/contacts
 * Agregar contacto de emergencia
 */
emergencyRoutes.post('/contacts', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { name, phone, relationship, is_primary } = body;

    if (!name || !phone) {
      return c.json({ error: 'Name and phone are required' }, 400);
    }

    // Validar que no existan más de 5 contactos
    const existingContacts = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM emergency_contacts WHERE user_id = ?'
    )
      .bind(user.id)
      .first();

    if (existingContacts && (existingContacts.count as number) >= 5) {
      return c.json({ error: 'Maximum 5 emergency contacts allowed' }, 400);
    }

    // Si este contacto es primario, quitar el flag de otros
    if (is_primary) {
      await c.env.DB.prepare(
        'UPDATE emergency_contacts SET is_primary = 0 WHERE user_id = ?'
      )
        .bind(user.id)
        .run();
    }

    const contactId = uuidv4();

    await c.env.DB.prepare(
      `INSERT INTO emergency_contacts (id, user_id, name, phone, relationship, is_primary)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(contactId, user.id, name, phone, relationship || null, is_primary ? 1 : 0)
      .run();

    const contact = await c.env.DB.prepare(
      'SELECT * FROM emergency_contacts WHERE id = ?'
    )
      .bind(contactId)
      .first();

    return c.json({ contact }, 201);
  } catch (error: any) {
    console.error('Create emergency contact error:', error);
    return c.json({ error: error.message || 'Failed to create emergency contact' }, 500);
  }
});

/**
 * PUT /emergency/contacts/:id
 * Actualizar contacto de emergencia
 */
emergencyRoutes.put('/contacts/:id', async (c) => {
  try {
    const user = c.get('user');
    const contactId = c.req.param('id');
    const body = await c.req.json();
    const { name, phone, relationship, is_primary } = body;

    // Verificar que el contacto pertenece al usuario
    const contact = await c.env.DB.prepare(
      'SELECT * FROM emergency_contacts WHERE id = ? AND user_id = ?'
    )
      .bind(contactId, user.id)
      .first();

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }

    // Si este contacto es primario, quitar el flag de otros
    if (is_primary) {
      await c.env.DB.prepare(
        'UPDATE emergency_contacts SET is_primary = 0 WHERE user_id = ?'
      )
        .bind(user.id)
        .run();
    }

    await c.env.DB.prepare(
      `UPDATE emergency_contacts
       SET name = ?, phone = ?, relationship = ?, is_primary = ?
       WHERE id = ?`
    )
      .bind(name, phone, relationship || null, is_primary ? 1 : 0, contactId)
      .run();

    const updatedContact = await c.env.DB.prepare(
      'SELECT * FROM emergency_contacts WHERE id = ?'
    )
      .bind(contactId)
      .first();

    return c.json({ contact: updatedContact });
  } catch (error: any) {
    console.error('Update emergency contact error:', error);
    return c.json({ error: error.message || 'Failed to update emergency contact' }, 500);
  }
});

/**
 * DELETE /emergency/contacts/:id
 * Eliminar contacto de emergencia
 */
emergencyRoutes.delete('/contacts/:id', async (c) => {
  try {
    const user = c.get('user');
    const contactId = c.req.param('id');

    // Verificar que el contacto pertenece al usuario
    const contact = await c.env.DB.prepare(
      'SELECT * FROM emergency_contacts WHERE id = ? AND user_id = ?'
    )
      .bind(contactId, user.id)
      .first();

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }

    await c.env.DB.prepare('DELETE FROM emergency_contacts WHERE id = ?')
      .bind(contactId)
      .run();

    return c.json({ message: 'Contact deleted successfully' });
  } catch (error: any) {
    console.error('Delete emergency contact error:', error);
    return c.json({ error: error.message || 'Failed to delete emergency contact' }, 500);
  }
});

/**
 * POST /emergency/sos
 * Activar alerta SOS durante un viaje
 */
emergencyRoutes.post('/sos', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { trip_id, latitude, longitude } = body;

    if (!trip_id || !latitude || !longitude) {
      return c.json({ error: 'Trip ID and location are required' }, 400);
    }

    // Verificar que el viaje existe y el usuario está involucrado
    const trip = await c.env.DB.prepare(
      'SELECT * FROM trips WHERE id = ? AND (passenger_id = ? OR driver_id = ?)'
    )
      .bind(trip_id, user.id, user.id)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found or unauthorized' }, 404);
    }

    // Verificar que no haya una alerta SOS activa para este viaje
    const existingAlert = await c.env.DB.prepare(
      'SELECT * FROM sos_alerts WHERE trip_id = ? AND status = ?'
    )
      .bind(trip_id, 'active')
      .first();

    if (existingAlert) {
      return c.json({ error: 'SOS alert already active for this trip' }, 400);
    }

    const alertId = uuidv4();

    await c.env.DB.prepare(
      `INSERT INTO sos_alerts (id, trip_id, user_id, latitude, longitude, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    )
      .bind(alertId, trip_id, user.id, latitude, longitude)
      .run();

    // Obtener contactos de emergencia del usuario
    const emergencyContacts = await c.env.DB.prepare(
      'SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY is_primary DESC'
    )
      .bind(user.id)
      .all();

    // Obtener información del usuario
    const userInfo = await c.env.DB.prepare(
      'SELECT full_name, phone FROM users WHERE id = ?'
    )
      .bind(user.id)
      .first();

    // Notificar a los contactos de emergencia (por SMS o llamada)
    // TODO: Integrar con servicio de SMS
    const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const alertMessage = `🚨 ALERTA DE EMERGENCIA 🚨\n${userInfo?.full_name} necesita ayuda urgente.\nUbicación: ${googleMapsLink}\nViaje ID: ${trip_id}`;

    console.log('SOS Alert triggered:', alertMessage);
    console.log('Emergency contacts to notify:', emergencyContacts.results);

    // Notificar al otro participante del viaje
    const otherParticipantId = user.id === trip.passenger_id ? trip.driver_id : trip.passenger_id;
    if (otherParticipantId) {
      const otherUser = await c.env.DB.prepare(
        'SELECT push_token FROM users WHERE id = ?'
      )
        .bind(otherParticipantId)
        .first();

      if (otherUser && otherUser.push_token) {
        await PushNotificationService.sendPushNotification({
          to: otherUser.push_token as string,
          title: '🚨 ALERTA DE EMERGENCIA',
          body: `Se ha activado una alerta SOS en el viaje actual`,
          data: { type: 'sos_alert', trip_id, alert_id: alertId },
          sound: 'default',
          priority: 'high',
        });
      }

      // Crear notificación en la base de datos
      await c.env.DB.prepare(
        `INSERT INTO notifications (id, user_id, title, message, type, data)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(
          uuidv4(),
          otherParticipantId,
          '🚨 ALERTA DE EMERGENCIA',
          'Se ha activado una alerta SOS en el viaje actual',
          'sos_alert',
          JSON.stringify({ trip_id, alert_id: alertId })
        )
        .run();
    }

    const alert = await c.env.DB.prepare('SELECT * FROM sos_alerts WHERE id = ?')
      .bind(alertId)
      .first();

    return c.json({
      alert,
      message: 'SOS alert activated successfully',
      contacts_notified: emergencyContacts.results?.length || 0,
    }, 201);
  } catch (error: any) {
    console.error('Create SOS alert error:', error);
    return c.json({ error: error.message || 'Failed to create SOS alert' }, 500);
  }
});

/**
 * PUT /emergency/sos/:id/resolve
 * Resolver alerta SOS
 */
emergencyRoutes.put('/sos/:id/resolve', async (c) => {
  try {
    const user = c.get('user');
    const alertId = c.req.param('id');
    const body = await c.req.json();
    const { status, notes } = body;

    if (!['resolved', 'false_alarm'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Verificar que la alerta existe
    const alert = await c.env.DB.prepare(
      'SELECT * FROM sos_alerts WHERE id = ?'
    )
      .bind(alertId)
      .first();

    if (!alert) {
      return c.json({ error: 'Alert not found' }, 404);
    }

    await c.env.DB.prepare(
      `UPDATE sos_alerts
       SET status = ?, resolved_at = ?, resolved_by = ?, notes = ?
       WHERE id = ?`
    )
      .bind(status, Math.floor(Date.now() / 1000), user.id, notes || null, alertId)
      .run();

    const updatedAlert = await c.env.DB.prepare('SELECT * FROM sos_alerts WHERE id = ?')
      .bind(alertId)
      .first();

    return c.json({ alert: updatedAlert });
  } catch (error: any) {
    console.error('Resolve SOS alert error:', error);
    return c.json({ error: error.message || 'Failed to resolve SOS alert' }, 500);
  }
});

/**
 * POST /emergency/share-trip
 * Compartir viaje en tiempo real con contacto
 */
emergencyRoutes.post('/share-trip', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { trip_id, contact_id } = body;

    if (!trip_id || !contact_id) {
      return c.json({ error: 'Trip ID and contact ID are required' }, 400);
    }

    // Verificar que el viaje existe y el usuario está involucrado
    const trip = await c.env.DB.prepare(
      'SELECT * FROM trips WHERE id = ? AND (passenger_id = ? OR driver_id = ?)'
    )
      .bind(trip_id, user.id, user.id)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found or unauthorized' }, 404);
    }

    // Obtener contacto de emergencia
    const contact = await c.env.DB.prepare(
      'SELECT * FROM emergency_contacts WHERE id = ? AND user_id = ?'
    )
      .bind(contact_id, user.id)
      .first();

    if (!contact) {
      return c.json({ error: 'Emergency contact not found' }, 404);
    }

    // Generar token único para compartir
    const shareToken = uuidv4();
    const shareId = uuidv4();

    // El enlace expira en 24 horas
    const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

    await c.env.DB.prepare(
      `INSERT INTO trip_shares (id, trip_id, shared_by_user_id, shared_with_phone, shared_with_name, share_token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(shareId, trip_id, user.id, contact.phone, contact.name, shareToken, expiresAt)
      .run();

    // TODO: Enviar SMS o WhatsApp con el enlace
    const shareLink = `https://motaxi.app/track/${shareToken}`;
    const message = `${user.full_name || 'Tu contacto'} está compartiendo su viaje en tiempo real contigo. Puedes seguirlo aquí: ${shareLink}`;

    console.log('Trip share created:', message);

    const share = await c.env.DB.prepare('SELECT * FROM trip_shares WHERE id = ?')
      .bind(shareId)
      .first();

    return c.json({
      share,
      share_link: shareLink,
      message: 'Trip shared successfully',
    }, 201);
  } catch (error: any) {
    console.error('Share trip error:', error);
    return c.json({ error: error.message || 'Failed to share trip' }, 500);
  }
});

/**
 * GET /emergency/track/:token
 * Rastrear viaje compartido (público, no requiere autenticación)
 */
emergencyRoutes.get('/track/:token', async (c) => {
  try {
    const token = c.req.param('token');

    const share = await c.env.DB.prepare(
      'SELECT * FROM trip_shares WHERE share_token = ? AND is_active = 1'
    )
      .bind(token)
      .first();

    if (!share) {
      return c.json({ error: 'Invalid or expired share link' }, 404);
    }

    // Verificar que no haya expirado
    const now = Math.floor(Date.now() / 1000);
    if (share.expires_at && (share.expires_at as number) < now) {
      return c.json({ error: 'Share link has expired' }, 410);
    }

    // Obtener información del viaje
    const trip = await c.env.DB.prepare(
      `SELECT t.*,
              passenger.full_name as passenger_name, passenger.phone as passenger_phone,
              driver.full_name as driver_name, driver.phone as driver_phone,
              d.current_latitude as driver_latitude, d.current_longitude as driver_longitude
       FROM trips t
       LEFT JOIN users passenger ON t.passenger_id = passenger.id
       LEFT JOIN users driver ON t.driver_id = driver.id
       LEFT JOIN drivers d ON t.driver_id = d.id
       WHERE t.id = ?`
    )
      .bind(share.trip_id)
      .first();

    if (!trip) {
      return c.json({ error: 'Trip not found' }, 404);
    }

    return c.json({
      trip: {
        id: trip.id,
        status: trip.status,
        pickup_address: trip.pickup_address,
        dropoff_address: trip.dropoff_address,
        passenger_name: trip.passenger_name,
        driver_name: trip.driver_name,
        driver_location: {
          latitude: trip.driver_latitude,
          longitude: trip.driver_longitude,
        },
        started_at: trip.started_at,
      },
      shared_by: share.shared_by_user_id,
      shared_with: share.shared_with_name,
    });
  } catch (error: any) {
    console.error('Track trip error:', error);
    return c.json({ error: error.message || 'Failed to track trip' }, 500);
  }
});
