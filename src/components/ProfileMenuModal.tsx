import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onViewProfile: () => void;
}

const ProfileMenuModal: React.FC<ProfileMenuModalProps> = ({
  visible,
  onClose,
  onViewProfile,
}) => {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const handleSignOut = () => {
    onClose();
    Alert.alert(
      'Cerrar Sesion',
      '¿Estas seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleNavigate = (screen: keyof RootStackParamList) => {
    onClose();
    // pequeño delay para que el modal cierre antes de navegar
    setTimeout(() => navigation.navigate(screen as any), 200);
  };

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Indicador de arrastre */}
          <View style={styles.handle} />

          {/* Cabecera con info del usuario */}
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Ionicons
                name={user.role === 'passenger' ? 'person' : 'bicycle'}
                size={28}
                color="white"
              />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.full_name}</Text>
              <Text style={styles.userRole}>
                {user.role === 'passenger' ? 'Pasajero' : 'Conductor'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Opciones */}
          <TouchableOpacity style={styles.option} onPress={onViewProfile}>
            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="person-outline" size={20} color="#42CE1D" />
            </View>
            <Text style={styles.optionText}>Ver perfil completo</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={() => handleNavigate('NotificationsSettings')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="settings-outline" size={20} color="#1976D2" />
            </View>
            <Text style={styles.optionText}>Ajustes</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={() => handleNavigate('HelpSupport')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FFF8E1' }]}>
              <Ionicons name="help-circle-outline" size={20} color="#F9A825" />
            </View>
            <Text style={styles.optionText}>Ayuda</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.option} onPress={handleSignOut}>
            <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="log-out-outline" size={20} color="#F44336" />
            </View>
            <Text style={[styles.optionText, { color: '#F44336' }]}>
              Cerrar sesion
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#42CE1D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222',
  },
  userRole: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#222',
  },
});

export default ProfileMenuModal;
