import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const AboutScreen: React.FC = () => {
  const handleOpenWebsite = () => {
    Linking.openURL('https://motaxi.com');
  };

  const handleOpenSocialMedia = (platform: 'facebook' | 'twitter' | 'instagram') => {
    const urls = {
      facebook: 'https://facebook.com/motaxi',
      twitter: 'https://twitter.com/motaxi',
      instagram: 'https://instagram.com/motaxi',
    };
    Linking.openURL(urls[platform]);
  };

  const InfoItem = ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const FeatureItem = ({
    icon,
    title,
    description,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
  }) => (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={28} color="#FF6B6B" />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );

  const SocialButton = ({
    icon,
    label,
    onPress,
    color,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    color: string;
  }) => (
    <TouchableOpacity style={styles.socialButton} onPress={onPress}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.socialButtonText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="bicycle" size={80} color="white" />
          </View>
          <Text style={styles.appName}>MoTaxi</Text>
          <Text style={styles.tagline}>Tu transporte seguro y confiable</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Aplicación</Text>

          <InfoItem label="Versión" value="1.0.0" />
          <InfoItem label="Última actualización" value="Enero 2026" />
          <InfoItem label="Desarrollador" value="MoTaxi Team" />
          <InfoItem label="Licencia" value="Propietaria" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acerca de MoTaxi</Text>
          <Text style={styles.aboutText}>
            MoTaxi es una plataforma de transporte de mototaxis que conecta pasajeros
            con conductores verificados de forma rápida y segura. Nuestra misión es
            proporcionar un servicio de transporte económico, eficiente y seguro para
            todos.
          </Text>
          <Text style={styles.aboutText}>
            Fundada en 2026, MoTaxi está comprometida con la innovación en el sector
            del transporte urbano, ofreciendo una alternativa ágil para la movilidad
            en la ciudad.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Características Principales</Text>

          <FeatureItem
            icon="location"
            title="Seguimiento en Tiempo Real"
            description="Rastrea tu viaje y comparte tu ubicación con familiares"
          />

          <FeatureItem
            icon="shield-checkmark"
            title="Conductores Verificados"
            description="Todos nuestros conductores pasan por un proceso de verificación"
          />

          <FeatureItem
            icon="cash"
            title="Tarifas Transparentes"
            description="Conoce el precio antes de solicitar tu viaje"
          />

          <FeatureItem
            icon="star"
            title="Sistema de Calificaciones"
            description="Califica tu experiencia y ayuda a mejorar el servicio"
          />

          <FeatureItem
            icon="chatbubbles"
            title="Chat Integrado"
            description="Comunícate fácilmente con tu conductor"
          />

          <FeatureItem
            icon="card"
            title="Múltiples Métodos de Pago"
            description="Paga con tarjeta, efectivo o billetera digital"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Síguenos</Text>

          <SocialButton
            icon="logo-facebook"
            label="Facebook"
            onPress={() => handleOpenSocialMedia('facebook')}
            color="#1877F2"
          />

          <SocialButton
            icon="logo-twitter"
            label="Twitter"
            onPress={() => handleOpenSocialMedia('twitter')}
            color="#1DA1F2"
          />

          <SocialButton
            icon="logo-instagram"
            label="Instagram"
            onPress={() => handleOpenSocialMedia('instagram')}
            color="#E4405F"
          />
        </View>

        <TouchableOpacity style={styles.websiteButton} onPress={handleOpenWebsite}>
          <Ionicons name="globe-outline" size={20} color="#FF6B6B" />
          <Text style={styles.websiteButtonText}>Visitar nuestro sitio web</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 MoTaxi. Todos los derechos reservados.
          </Text>
          <Text style={styles.footerText}>
            Hecho con ❤️ para una mejor movilidad urbana
          </Text>
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
  header: {
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  aboutText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 15,
    textAlign: 'justify',
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 12,
  },
  socialButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    gap: 8,
  },
  websiteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 5,
  },
});

export default AboutScreen;
