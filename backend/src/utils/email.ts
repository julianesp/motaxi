import { Resend } from 'resend';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Utilidad para enviar emails usando Resend
 */
export class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor(apiKey: string | undefined, fromEmail: string | undefined) {
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
    this.fromEmail = fromEmail || 'onboarding@resend.dev';
  }

  /**
   * Enviar un email
   */
  async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
      }

      console.log('Email sent successfully:', data);
      return { success: true };
    } catch (error: any) {
      console.error('Exception sending email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar código de recuperación de contraseña
   */
  async sendPasswordResetCode(
    email: string,
    resetCode: string,
    userName?: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperación de Contraseña - MoTaxi</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #555;
          }
          .code-container {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 24px;
            margin: 30px 0;
            border-radius: 8px;
          }
          .code-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .reset-code {
            font-size: 42px;
            font-weight: 700;
            color: #667eea;
            letter-spacing: 8px;
            text-align: center;
            font-family: 'Courier New', monospace;
            margin: 10px 0;
          }
          .expiry {
            color: #e74c3c;
            font-size: 14px;
            margin-top: 12px;
            text-align: center;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning-text {
            color: #856404;
            font-size: 14px;
            margin: 0;
          }
          .footer {
            background: #f8f9fa;
            padding: 24px;
            text-align: center;
            color: #666;
            font-size: 13px;
            border-top: 1px solid #e9ecef;
          }
          .footer a {
            color: #667eea;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚖 MoTaxi</h1>
          </div>

          <div class="content">
            <p class="greeting">
              Hola${userName ? ` ${userName}` : ''},
            </p>

            <p>
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en MoTaxi.
              Usa el siguiente código de recuperación:
            </p>

            <div class="code-container">
              <div class="code-label">Tu código de recuperación:</div>
              <div class="reset-code">${resetCode}</div>
              <div class="expiry">⏰ Este código expirará en 15 minutos</div>
            </div>

            <p>
              Ingresa este código en la aplicación para restablecer tu contraseña.
            </p>

            <div class="warning">
              <p class="warning-text">
                <strong>⚠️ Importante:</strong> Si no solicitaste este cambio,
                por favor ignora este correo. Tu cuenta permanecerá segura.
              </p>
            </div>
          </div>

          <div class="footer">
            <p>
              Este es un correo automático, por favor no respondas a este mensaje.
            </p>
            <p>
              © ${new Date().getFullYear()} MoTaxi. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: email,
      subject: 'Recuperación de Contraseña - MoTaxi',
      html,
    });
  }
}
