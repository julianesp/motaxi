import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapsService } from '../services/maps.service';

interface PlaceAutocompleteProp {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onPlaceSelected: (place: {
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  editable?: boolean;
  currentLocation?: { latitude: number; longitude: number } | null;
}

interface Prediction {
  description: string;
  place_id: string;
}

export const PlaceAutocomplete: React.FC<PlaceAutocompleteProp> = ({
  placeholder,
  value,
  onChangeText,
  onPlaceSelected,
  icon,
  iconColor,
  editable = true,
  currentLocation,
}) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);

  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (value.length >= 3) {
        setLoading(true);
        const results = await MapsService.getPlaceAutocomplete(
          value,
          currentLocation?.latitude,
          currentLocation?.longitude
        );
        setPredictions(results);
        setShowPredictions(true);
        setLoading(false);
      } else {
        setPredictions([]);
        setShowPredictions(false);
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(delaySearch);
  }, [value, currentLocation]);

  const handleSelectPlace = async (prediction: Prediction) => {
    onChangeText(prediction.description);
    setShowPredictions(false);
    setPredictions([]);

    // Obtener coordenadas del lugar seleccionado
    const placeDetails = await MapsService.getPlaceDetails(prediction.place_id);
    if (placeDetails) {
      onPlaceSelected({
        address: placeDetails.address,
        latitude: placeDetails.latitude,
        longitude: placeDetails.longitude,
      });
    }
  };

  const renderPrediction = ({ item }: { item: Prediction }) => (
    <TouchableOpacity
      style={styles.predictionItem}
      onPress={() => handleSelectPlace(item)}
    >
      <Ionicons name="location-outline" size={20} color="#666" />
      <Text style={styles.predictionText} numberOfLines={2}>
        {item.description}
      </Text>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.inputContainer}>
        <Ionicons name={icon} size={20} color={iconColor} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          autoComplete="off"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color="#FF6B6B" />}
      </View>

      {showPredictions && predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          <FlatList
            data={predictions}
            renderItem={renderPrediction}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            style={styles.predictionsList}
            scrollEnabled={true}
            nestedScrollEnabled={true}
          />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  input: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  predictionsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginTop: 5,
    marginBottom: 10,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  predictionsList: {
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  predictionText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
});
