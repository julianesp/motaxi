import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const ProfileScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Ionicons
              name={user.role === 'passenger' ? 'person' : 'bicycle'}
              size={60}
              color="white"
            />
          </View>
          <Text style={styles.name}>{user.full_name}</Text>
          <Text style={styles.role}>
            {user.role === 'passenger' ? 'Pasajero' : 'Conductor'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Personal</Text>

          <View style={styles.infoItem}>
            <Ionicons name="mail-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Correo</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="call-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Teléfono</Text>
              <Text style={styles.infoValue}>{user.phone}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Miembro desde</Text>
              <Text style={styles.infoValue}>
                {new Date(user.created_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('NotificationsSettings')}
          >
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Notificaciones</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('PrivacySecurity')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Privacidad y Seguridad</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('HelpSupport')}
          >
            <Ionicons name="help-circle-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Ayuda y Soporte</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('About')}
          >
            <Ionicons name="information-circle-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Acerca de</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color="#F44336" />
          <Text style={styles.signOutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Versión 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FF6B6B',
    padding: 30,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  role: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  section: {
    marginTop: 20,
    backgroundColor: 'white',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoContent: {
    flex: 1,
    marginLeft: 15,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    margin: 20,
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F44336',
    gap: 10,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginBottom: 30,
  },
});

export default ProfileScreen;
