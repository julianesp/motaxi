import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const PrivacySecurityScreen: React.FC = () => {
  const [shareLocation, setShareLocation] = useState(true);
  const [shareTrips, setShareTrips] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);

  const handleChangePassword = () => {
    Alert.alert(
      'Cambiar Contraseña',
      'Se enviará un enlace de restablecimiento a tu correo electrónico.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: () => {
            // TODO: Implementar cambio de contraseña
            Alert.alert('Éxito', 'Se ha enviado un enlace a tu correo.');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar Cuenta',
      'Esta acción es permanente y eliminará todos tus datos. ¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            // TODO: Implementar eliminación de cuenta
            Alert.alert('Información', 'Esta función estará disponible próximamente.');
          },
        },
      ]
    );
  };

  const handleViewPrivacyPolicy = () => {
    Alert.alert(
      'Política de Privacidad',
      'Aquí se mostraría la política de privacidad completa de MoTaxi.\n\nPróximamente estará disponible en un visor web.'
    );
  };

  const handleViewTerms = () => {
    Alert.alert(
      'Términos y Condiciones',
      'Aquí se mostrarían los términos y condiciones de uso de MoTaxi.\n\nPróximamente estará disponible en un visor web.'
    );
  };

  const MenuItem = ({
    icon,
    title,
    description,
    onPress,
    danger,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description?: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons name={icon} size={24} color={danger ? '#F44336' : '#FF6B6B'} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>
          {title}
        </Text>
        {description && (
          <Text style={styles.menuDescription}>{description}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  const ToggleItem = ({
    icon,
    title,
    description,
    value,
    onValueChange,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.menuItem}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={24} color="#FF6B6B" />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D5DB', true: '#FFB4B4' }}
        thumbColor={value ? '#FF6B6B' : '#F3F4F6'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seguridad de la Cuenta</Text>

          <MenuItem
            icon="key-outline"
            title="Cambiar Contraseña"
            description="Actualiza tu contraseña periódicamente"
            onPress={handleChangePassword}
          />

          <ToggleItem
            icon="shield-checkmark-outline"
            title="Autenticación de Dos Factores"
            description="Añade una capa extra de seguridad"
            value={twoFactorAuth}
            onValueChange={setTwoFactorAuth}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacidad</Text>

          <ToggleItem
            icon="location-outline"
            title="Compartir Ubicación"
            description="Permite a conductores ver tu ubicación durante viajes"
            value={shareLocation}
            onValueChange={setShareLocation}
          />

          <ToggleItem
            icon="car-outline"
            title="Historial de Viajes"
            description="Guardar historial de viajes realizados"
            value={shareTrips}
            onValueChange={setShareTrips}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información Legal</Text>

          <MenuItem
            icon="document-text-outline"
            title="Política de Privacidad"
            description="Cómo protegemos tus datos personales"
            onPress={handleViewPrivacyPolicy}
          />

          <MenuItem
            icon="reader-outline"
            title="Términos y Condiciones"
            description="Condiciones de uso del servicio"
            onPress={handleViewTerms}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zona de Peligro</Text>

          <MenuItem
            icon="trash-outline"
            title="Eliminar Cuenta"
            description="Eliminar permanentemente tu cuenta y datos"
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={24} color="#10B981" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Tu seguridad es nuestra prioridad</Text>
            <Text style={styles.infoText}>
              Todos tus datos están encriptados y protegidos. Nunca compartimos tu
              información personal con terceros sin tu consentimiento.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIconDanger: {
    backgroundColor: '#FFEBEE',
  },
  menuContent: {
    flex: 1,
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  menuTitleDanger: {
    color: '#F44336',
  },
  menuDescription: {
    fontSize: 13,
    color: '#666',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
});

export default PrivacySecurityScreen;
