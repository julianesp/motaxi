import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../config/api';

interface RatingModalProps {
  visible: boolean;
  tripId: string;
  driverId?: string;
  driverName?: string;
  passengerName?: string;
  onClose: () => void;
  onRated: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  tripId,
  driverId,
  driverName,
  passengerName,
  onClose,
  onRated,
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [addingToFavorites, setAddingToFavorites] = useState(false);

  const personName = driverName || passengerName || 'Usuario';
  const isRatingDriver = !!driverName;

  const handleStarPress = (selectedRating: number) => {
    setRating(selectedRating);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Por favor selecciona una calificación');
      return;
    }

    setSubmitting(true);

    try {
      await apiClient.put(`/trips/${tripId}/rate`, {
        rating,
        comment: comment.trim() || null,
      });

      setSubmitting(false);
      setRatingSubmitted(true);
      onRated();

      // Si estamos calificando a un conductor, mostrar opción de agregar a favoritos
      // Si no (es pasajero o no hay driverId), cerrar el modal
      if (!isRatingDriver || !driverId) {
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo enviar la calificación');
      setSubmitting(false);
    }
  };

  const handleAddToFavorites = async () => {
    if (!driverId) {
      Alert.alert('Error', 'No se pudo obtener la información del conductor');
      return;
    }

    setAddingToFavorites(true);

    try {
      await apiClient.post('/favorites/drivers', {
        driver_id: driverId,
        nickname: null, // Opcional: podrías pedir un apodo al usuario
      });

      Alert.alert(
        '¡Agregado!',
        `${driverName} ha sido agregado a tus conductores favoritos`,
        [
          {
            text: 'OK',
            onPress: handleClose,
          },
        ]
      );
    } catch (error: any) {
      if (error.message?.includes('ya está en tus favoritos')) {
        Alert.alert('Información', 'Este conductor ya está en tus favoritos');
      } else {
        Alert.alert('Error', error.message || 'No se pudo agregar a favoritos');
      }
    } finally {
      setAddingToFavorites(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    setRatingSubmitted(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {!ratingSubmitted ? (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Ionicons
                  name={isRatingDriver ? 'bicycle' : 'person'}
                  size={50}
                  color="#FF6B6B"
                />
                <Text style={styles.title}>¿Cómo fue tu experiencia?</Text>
                <Text style={styles.subtitle}>
                  Califica a {personName}
                </Text>
              </View>

              {/* Stars */}
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleStarPress(star)}
                    disabled={submitting}
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={50}
                      color={star <= rating ? '#FFD700' : '#CCC'}
                      style={styles.star}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Rating Text */}
              {rating > 0 && (
                <Text style={styles.ratingText}>
                  {rating === 5 && '¡Excelente!'}
                  {rating === 4 && 'Muy bueno'}
                  {rating === 3 && 'Bueno'}
                  {rating === 2 && 'Regular'}
                  {rating === 1 && 'Malo'}
                </Text>
              )}

              {/* Comment */}
              <TextInput
                style={styles.commentInput}
                placeholder="Comentario (opcional)"
                placeholderTextColor="#999"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                maxLength={200}
                editable={!submitting}
              />

              {/* Buttons */}
              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleClose}
                  disabled={submitting}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.submitButton,
                    (submitting || rating === 0) && styles.buttonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={submitting || rating === 0}
                >
                  <Text style={styles.submitButtonText}>
                    {submitting ? 'Enviando...' : 'Enviar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Success State - Show Add to Favorites */}
              <View style={styles.header}>
                <Ionicons
                  name="checkmark-circle"
                  size={70}
                  color="#4CAF50"
                />
                <Text style={styles.title}>¡Gracias por tu calificación!</Text>
                {isRatingDriver && driverId && (
                  <Text style={styles.subtitle}>
                    ¿Te gustaría agregar a {driverName} a tus favoritos?
                  </Text>
                )}
              </View>

              {isRatingDriver && driverId ? (
                <View style={styles.favoriteButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.favoriteButton]}
                    onPress={handleAddToFavorites}
                    disabled={addingToFavorites}
                  >
                    <Ionicons name="star" size={24} color="#FFD700" />
                    <Text style={styles.favoriteButtonText}>
                      {addingToFavorites ? 'Agregando...' : 'Agregar a Favoritos'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.skipButton]}
                    onPress={handleClose}
                    disabled={addingToFavorites}
                  >
                    <Text style={styles.skipButtonText}>No, gracias</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
  },
  star: {
    marginHorizontal: 5,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 15,
  },
  commentInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
    marginBottom: 20,
    minHeight: 80,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#FF6B6B',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  favoriteButtons: {
    gap: 10,
  },
  favoriteButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  favoriteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    backgroundColor: '#E0E0E0',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
