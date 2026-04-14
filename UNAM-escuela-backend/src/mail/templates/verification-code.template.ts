export function buildVerificationCodeEmailTemplate(fullName: string, code: string) {
    return {
        subject: 'Verifica tu correo - UNAM Inclusión',
        text: `Hola ${fullName},

Tu código de verificación es: ${code}

Este código vence en 1 hora.

Si tú no solicitaste esta cuenta, puedes ignorar este correo.`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>Verifica tu correo</h2>
        <p>Hola <strong>${fullName}</strong>,</p>
        <p>Tu código de verificación es:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 20px 0;">
          ${code}
        </div>
        <p>Este código vence en <strong>1 hora</strong>.</p>
        <p>Si tú no solicitaste esta cuenta, puedes ignorar este correo.</p>
      </div>
    `,
    };
}