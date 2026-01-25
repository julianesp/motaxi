import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const HelpSupportScreen: React.FC = () => {
  const handleCallSupport = () => {
    const phoneNumber = 'tel:+573001234567';
    Linking.canOpenURL(phoneNumber).then((supported) => {
      if (supported) {
        Linking.openURL(phoneNumber);
      } else {
        Alert.alert('Error', 'No se puede realizar la llamada desde este dispositivo.');
      }
    });
  };

  const handleEmailSupport = () => {
    const email = 'mailto:soporte@motaxi.com?subject=Solicitud de Soporte';
    Linking.canOpenURL(email).then((supported) => {
      if (supported) {
        Linking.openURL(email);
      } else {
        Alert.alert('Error', 'No se puede abrir el cliente de correo.');
      }
    });
  };

  const handleWhatsAppSupport = () => {
    const whatsapp = 'whatsapp://send?phone=573001234567&text=Hola, necesito ayuda con MoTaxi';
    Linking.canOpenURL(whatsapp).then((supported) => {
      if (supported) {
        Linking.openURL(whatsapp);
      } else {
        Alert.alert(
          'WhatsApp no disponible',
          'Por favor instala WhatsApp o contáctanos por otro medio.'
        );
      }
    });
  };

  const handleReportIssue = () => {
    Alert.alert(
      'Reportar Problema',
      'Serás redirigido al formulario de reporte de problemas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            // TODO: Navegar a formulario de reporte
            Alert.alert('Información', 'Formulario de reporte próximamente disponible.');
          },
        },
      ]
    );
  };

  const FAQItem = ({
    question,
    answer,
  }: {
    question: string;
    answer: string;
  }) => {
    const [expanded, setExpanded] = React.useState(false);

    return (
      <TouchableOpacity
        style={styles.faqItem}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.faqHeader}>
          <Text style={styles.faqQuestion}>{question}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#666"
          />
        </View>
        {expanded && <Text style={styles.faqAnswer}>{answer}</Text>}
      </TouchableOpacity>
    );
  };

  const ContactItem = ({
    icon,
    title,
    subtitle,
    onPress,
    color,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity style={styles.contactItem} onPress={onPress}>
      <View style={[styles.contactIcon, { backgroundColor: `${color || '#FF6B6B'}15` }]}>
        <Ionicons name={icon} size={24} color={color || '#FF6B6B'} />
      </View>
      <View style={styles.contactContent}>
        <Text style={styles.contactTitle}>{title}</Text>
        <Text style={styles.contactSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Ionicons name="help-buoy" size={60} color="#FF6B6B" />
          <Text style={styles.headerTitle}>¿Cómo podemos ayudarte?</Text>
          <Text style={styles.headerSubtitle}>
            Estamos aquí para resolver tus dudas y problemas
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contacta con Soporte</Text>

          <ContactItem
            icon="call-outline"
            title="Llamar a Soporte"
            subtitle="Disponible 24/7"
            onPress={handleCallSupport}
            color="#10B981"
          />

          <ContactItem
            icon="mail-outline"
            title="Enviar Email"
            subtitle="soporte@motaxi.com"
            onPress={handleEmailSupport}
            color="#3B82F6"
          />

          <ContactItem
            icon="logo-whatsapp"
            title="Chat por WhatsApp"
            subtitle="Respuesta inmediata"
            onPress={handleWhatsAppSupport}
            color="#25D366"
          />

          <ContactItem
            icon="warning-outline"
            title="Reportar un Problema"
            subtitle="Incidencias técnicas o de seguridad"
            onPress={handleReportIssue}
            color="#F59E0B"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preguntas Frecuentes</Text>

          <FAQItem
            question="¿Cómo solicito un viaje?"
            answer="Desde la pantalla principal, ingresa tu destino y presiona 'Solicitar Viaje'. Los conductores cercanos recibirán tu solicitud y podrás ver la estimación de tarifa antes de confirmar."
          />

          <FAQItem
            question="¿Cómo cancelo un viaje?"
            answer="Puedes cancelar un viaje desde la pantalla del viaje activo presionando el botón 'Cancelar'. Ten en cuenta que pueden aplicarse cargos por cancelación si el conductor ya está en camino."
          />

          <FAQItem
            question="¿Qué métodos de pago aceptan?"
            answer="Aceptamos tarjetas de crédito/débito, pagos en efectivo y billeteras digitales. Puedes configurar tu método de pago preferido en la sección de Métodos de Pago."
          />

          <FAQItem
            question="¿Cómo califico a un conductor?"
            answer="Al finalizar el viaje, se te pedirá que califiques tu experiencia con el conductor en una escala de 1 a 5 estrellas. También puedes dejar comentarios adicionales."
          />

          <FAQItem
            question="¿Es seguro compartir mi ubicación?"
            answer="Sí, tu ubicación solo se comparte con el conductor durante el viaje activo y con nuestros sistemas de seguridad. Puedes configurar tus preferencias de privacidad en Configuración."
          />

          <FAQItem
            question="¿Qué hago en caso de emergencia?"
            answer="Presiona el botón de emergencia en la pantalla del viaje para notificar a las autoridades y compartir tu ubicación en tiempo real. También puedes agregar contactos de emergencia en tu perfil."
          />
        </View>

        <View style={styles.emergencyBox}>
          <Ionicons name="alert-circle" size={24} color="#EF4444" />
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>Emergencia</Text>
            <Text style={styles.emergencyText}>
              Si te encuentras en una situación de emergencia durante un viaje,
              presiona el botón de emergencia o llama al 123.
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
  header: {
    backgroundColor: 'white',
    alignItems: 'center',
    padding: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactContent: {
    flex: 1,
    marginRight: 12,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  contactSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  faqItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    lineHeight: 20,
  },
  emergencyBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    gap: 12,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 5,
  },
  emergencyText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
});

export default HelpSupportScreen;
