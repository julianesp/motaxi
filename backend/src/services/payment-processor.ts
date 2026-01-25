/**
 * Payment Processor Service
 * Integración con Wompi - Pasarela de pagos para Colombia
 * Soporta: PSE, Nequi, Daviplata, Tarjetas
 */

export interface PaymentIntent {
  amount: number;
  currency: string;
  reference: string;
  customerEmail: string;
  paymentMethod: 'PSE' | 'NEQUI' | 'CARD' | 'BANCOLOMBIA_TRANSFER';
  redirectUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  status: 'pending' | 'approved' | 'declined' | 'error';
  message?: string;
  error?: string;
}

export interface WompiConfig {
  publicKey: string;
  privateKey: string;
  environment: 'production' | 'test';
}

export class PaymentProcessor {
  private static WOMPI_API_URL = 'https://production.wompi.co/v1';
  private static WOMPI_TEST_URL = 'https://sandbox.wompi.co/v1';

  /**
   * Crear una transacción de pago con Wompi
   */
  static async createPayment(
    config: WompiConfig,
    intent: PaymentIntent
  ): Promise<PaymentResult> {
    const apiUrl =
      config.environment === 'production'
        ? this.WOMPI_API_URL
        : this.WOMPI_TEST_URL;

    try {
      // Construir payload según el método de pago
      const payload: any = {
        amount_in_cents: Math.round(intent.amount * 100), // Convertir a centavos
        currency: intent.currency,
        reference: intent.reference,
        customer_email: intent.customerEmail,
        redirect_url: intent.redirectUrl || 'https://motaxi.app/payment/callback',
      };

      // Configurar según método de pago
      if (intent.paymentMethod === 'PSE') {
        payload.payment_method = {
          type: 'PSE',
          user_type: '0', // 0=Persona, 1=Empresa
          user_legal_id_type: 'CC', // CC, NIT, CE
          user_legal_id: '', // Será llenado por el usuario
          financial_institution_code: '', // Banco seleccionado
          payment_description: `Pago MoTaxi - ${intent.reference}`,
        };
      } else if (intent.paymentMethod === 'NEQUI') {
        payload.payment_method = {
          type: 'NEQUI',
          phone_number: '', // Número de Nequi
        };
      } else if (intent.paymentMethod === 'CARD') {
        payload.payment_method = {
          type: 'CARD',
          installments: 1,
        };
      }

      // Hacer petición a Wompi
      const response = await fetch(`${apiUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.publicKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.data) {
        return {
          success: true,
          transactionId: data.data.id,
          paymentUrl: data.data.payment_link_url || data.data.payment_method_url,
          status: data.data.status === 'APPROVED' ? 'approved' : 'pending',
          message: 'Payment created successfully',
        };
      } else {
        return {
          success: false,
          status: 'error',
          error: data.error?.type || 'Payment creation failed',
          message: data.error?.messages?.join(', ') || 'Unknown error',
        };
      }
    } catch (error: any) {
      console.error('Payment processor error:', error);
      return {
        success: false,
        status: 'error',
        error: error.message || 'Network error',
        message: 'Failed to connect to payment processor',
      };
    }
  }

  /**
   * Verificar el estado de una transacción
   */
  static async checkPaymentStatus(
    config: WompiConfig,
    transactionId: string
  ): Promise<PaymentResult> {
    const apiUrl =
      config.environment === 'production'
        ? this.WOMPI_API_URL
        : this.WOMPI_TEST_URL;

    try {
      const response = await fetch(`${apiUrl}/transactions/${transactionId}`, {
        headers: {
          Authorization: `Bearer ${config.publicKey}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.data) {
        const status = this.mapWompiStatus(data.data.status);
        return {
          success: status === 'approved',
          transactionId: data.data.id,
          status,
          message: data.data.status_message || data.data.status,
        };
      } else {
        return {
          success: false,
          status: 'error',
          error: 'Transaction not found',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        error: error.message || 'Network error',
      };
    }
  }

  /**
   * Crear un link de pago para compartir (ideal para PSE)
   */
  static async createPaymentLink(
    config: WompiConfig,
    intent: PaymentIntent
  ): Promise<string | null> {
    const apiUrl =
      config.environment === 'production'
        ? this.WOMPI_API_URL
        : this.WOMPI_TEST_URL;

    try {
      const response = await fetch(`${apiUrl}/payment_links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.privateKey}`,
        },
        body: JSON.stringify({
          name: `Pago MoTaxi - ${intent.reference}`,
          description: `Pago por viaje ${intent.reference}`,
          single_use: true,
          collect_shipping: false,
          amount_in_cents: Math.round(intent.amount * 100),
          currency: intent.currency,
          redirect_url: intent.redirectUrl,
        }),
      });

      const data = await response.json();

      if (response.ok && data.data) {
        return data.data.permalink;
      }

      return null;
    } catch (error) {
      console.error('Error creating payment link:', error);
      return null;
    }
  }

  /**
   * Obtener lista de bancos para PSE
   */
  static async getPSEBanks(config: WompiConfig): Promise<any[]> {
    const apiUrl =
      config.environment === 'production'
        ? this.WOMPI_API_URL
        : this.WOMPI_TEST_URL;

    try {
      const response = await fetch(`${apiUrl}/pse/financial_institutions`, {
        headers: {
          Authorization: `Bearer ${config.publicKey}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.data) {
        return data.data;
      }

      return [];
    } catch (error) {
      console.error('Error fetching PSE banks:', error);
      return [];
    }
  }

  /**
   * Mapear estados de Wompi a nuestros estados
   */
  private static mapWompiStatus(
    wompiStatus: string
  ): 'pending' | 'approved' | 'declined' | 'error' {
    switch (wompiStatus) {
      case 'APPROVED':
        return 'approved';
      case 'DECLINED':
      case 'VOIDED':
        return 'declined';
      case 'PENDING':
        return 'pending';
      case 'ERROR':
      default:
        return 'error';
    }
  }

  /**
   * Validar firma de webhook (para callbacks de Wompi)
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Wompi usa HMAC SHA256
    // Implementación real requiere crypto
    // Por ahora, retornar true (implementar con crypto en producción)
    return true;
  }

  /**
   * Calcular comisión de la plataforma
   */
  static calculateCommission(
    amount: number,
    config: {
      percentage: number;
      min: number;
      max: number;
    }
  ): number {
    let commission = (amount * config.percentage) / 100;

    // Aplicar mínimo y máximo
    commission = Math.max(commission, config.min);
    commission = Math.min(commission, config.max);

    return Math.round(commission);
  }

  /**
   * Calcular tarifa adicional por método de pago
   */
  static calculatePaymentMethodFee(
    amount: number,
    method: string,
    feePercentage: number
  ): number {
    if (feePercentage === 0) return 0;
    return Math.round((amount * feePercentage) / 100);
  }
}
