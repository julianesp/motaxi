import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'passenger' | 'driver';
  message_type: 'text' | 'location' | 'system';
  text_content?: string;
  location_latitude?: number;
  location_longitude?: number;
  is_read: number;
  created_at: number;
}

interface ChatScreenProps {
  route: {
    params: {
      conversationId: string;
      tripId: string;
      otherUserName: string;
    };
  };
  navigation: any;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { conversationId, otherUserName } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: otherUserName || 'Chat',
    });

    loadMessages();
    markAsRead();

    // Polling cada 3 segundos para nuevos mensajes
    pollingIntervalRef.current = setInterval(() => {
      loadMessages(true); // silent reload
      checkTyping();
    }, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId]);

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const response = await apiClient.get(`/chat/messages/${conversationId}`);
      setMessages(response.data.messages);

      // Scroll to bottom si hay mensajes nuevos
      if (response.data.messages.length > 0 && !silent) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await apiClient.put(`/chat/mark-read/${conversationId}`);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Indicar que dejó de escribir
      await apiClient.post(`/chat/typing/${conversationId}`, { is_typing: false });

      await apiClient.post('/chat/send', {
        conversation_id: conversationId,
        text_content: messageText,
        message_type: 'text',
      });

      // Recargar mensajes
      await loadMessages(true);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Restaurar el mensaje en caso de error
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = async (text: string) => {
    setNewMessage(text);

    // Indicar que está escribiendo
    if (text.trim()) {
      try {
        await apiClient.post(`/chat/typing/${conversationId}`, { is_typing: true });
      } catch (error) {
        console.error('Error sending typing indicator:', error);
      }

      // Limpiar timeout anterior
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Indicar que dejó de escribir después de 3 segundos de inactividad
      typingTimeoutRef.current = setTimeout(async () => {
        try {
          await apiClient.post(`/chat/typing/${conversationId}`, { is_typing: false });
        } catch (error) {
          console.error('Error stopping typing indicator:', error);
        }
      }, 3000);
    }
  };

  const checkTyping = async () => {
    try {
      const response = await apiClient.get(`/chat/typing/${conversationId}`);
      setIsTyping(response.data.is_typing);
    } catch (error) {
      console.error('Error checking typing:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === user?.id;
    const time = new Date(item.created_at * 1000).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (item.message_type === 'location') {
      return (
        <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
          <View style={styles.locationMessage}>
            <Ionicons name="location" size={20} color={isMine ? 'white' : '#333'} />
            <Text style={[styles.messageText, isMine && styles.myMessageText]}>
              Ubicación compartida
            </Text>
          </View>
          <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>{time}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMine && styles.myMessageText]}>
          {item.text_content}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>{time}</Text>
          {isMine && (
            <Ionicons
              name={item.is_read ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={item.is_read ? '#4CAF50' : '#999'}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>{otherUserName} está escribiendo...</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={handleTyping}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    padding: 15,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  locationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingIndicator: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
  },
  typingText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
});

export default ChatScreen;
