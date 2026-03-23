import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'net';
import { connect as tlsConnect, TLSSocket } from 'tls';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  getVerificationUrl(token: string): string {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_APP_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      'http://localhost:3001';

    return `${frontendUrl.replace(/\/$/, '')}/verificar-email?token=${encodeURIComponent(token)}`;
  }

  async sendVerificationEmail(params: {
    email: string;
    fullName: string;
    token: string;
  }): Promise<void> {
    const verificationUrl = this.getVerificationUrl(params.token);
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpFrom =
      this.configService.get<string>('SMTP_FROM') ||
      smtpUser ||
      'no-reply@example.com';

    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn(
        `SMTP no configurado. Enlace de verificación para ${params.email}: ${verificationUrl}`,
      );
      return;
    }

    const smtpPort = Number(this.configService.get<string>('SMTP_PORT') || 465);
    const secure =
      (this.configService.get<string>('SMTP_SECURE') || 'true') === 'true';
    const shouldUseStartTls =
      !secure &&
      (this.configService.get<string>('SMTP_STARTTLS') || 'true') === 'true';
    const clientHost =
      this.configService.get<string>('SMTP_CLIENT_HOST') || 'localhost';

    const subject = 'Verifica tu cuenta';
    const text = [
      `Hola ${params.fullName},`,
      '',
      'Gracias por registrarte. Para activar tu cuenta y guardar tu progreso, verifica tu correo con el siguiente enlace:',
      verificationUrl,
      '',
      'Si tú no realizaste este registro, ignora este mensaje.',
    ].join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2>Verifica tu cuenta</h2>
        <p>Hola ${this.escapeHtml(params.fullName)},</p>
        <p>Gracias por registrarte. Para activar tu cuenta y guardar tu progreso, confirma tu correo electrónico.</p>
        <p>
          <a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;">Verificar correo</a>
        </p>
        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>Si tú no realizaste este registro, ignora este mensaje.</p>
      </div>
    `;

    const socket = await this.createConnection({
      host: smtpHost,
      port: smtpPort,
      secure,
    });

    try {
      await this.readResponse(socket, [220]);
      await this.sendCommand(socket, `EHLO ${clientHost}`, [250]);

      if (shouldUseStartTls) {
        await this.sendCommand(socket, 'STARTTLS', [220]);
        const upgradedSocket = await this.upgradeToTls(socket, smtpHost);
        await this.readResponse(upgradedSocket, [220], true).catch(
          () => undefined,
        );
        await this.sendCommand(upgradedSocket, `EHLO ${clientHost}`, [250]);
        await this.authenticateAndSendMail(upgradedSocket, {
          smtpUser,
          smtpPass,
          smtpFrom,
          recipient: params.email,
          subject,
          text,
          html,
        });
        await this.sendCommand(upgradedSocket, 'QUIT', [221]);
        upgradedSocket.end();
        return;
      }

      await this.authenticateAndSendMail(socket, {
        smtpUser,
        smtpPass,
        smtpFrom,
        recipient: params.email,
        subject,
        text,
        html,
      });
      await this.sendCommand(socket, 'QUIT', [221]);
    } finally {
      socket.end();
    }
  }

  private async authenticateAndSendMail(
    socket: Socket | TLSSocket,
    params: {
      smtpUser: string;
      smtpPass: string;
      smtpFrom: string;
      recipient: string;
      subject: string;
      text: string;
      html: string;
    },
  ): Promise<void> {
    await this.sendCommand(socket, 'AUTH LOGIN', [334]);
    await this.sendCommand(
      socket,
      Buffer.from(params.smtpUser).toString('base64'),
      [334],
      true,
    );
    await this.sendCommand(
      socket,
      Buffer.from(params.smtpPass).toString('base64'),
      [235],
      true,
    );
    await this.sendCommand(socket, `MAIL FROM:<${params.smtpFrom}>`, [250]);
    await this.sendCommand(socket, `RCPT TO:<${params.recipient}>`, [250, 251]);
    await this.sendCommand(socket, 'DATA', [354]);

    const message = [
      `From: ${params.smtpFrom}`,
      `To: ${params.recipient}`,
      `Subject: ${params.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="boundary-unam-email"',
      '',
      '--boundary-unam-email',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      params.text,
      '',
      '--boundary-unam-email',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      params.html,
      '',
      '--boundary-unam-email--',
      '.',
    ].join('\r\n');

    socket.write(`${message}\r\n`);
    await this.readResponse(socket, [250]);
  }

  private createConnection(params: {
    host: string;
    port: number;
    secure: boolean;
  }): Promise<Socket | TLSSocket> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      const socket = params.secure
        ? tlsConnect({
            host: params.host,
            port: params.port,
            servername: params.host,
          })
        : new Socket();

      socket.once('error', onError);
      socket.once('connect', () => {
        socket.off('error', onError);
        resolve(socket);
      });

      if (!params.secure) {
        socket.connect(params.port, params.host);
      }
    });
  }

  private upgradeToTls(
    socket: Socket | TLSSocket,
    host: string,
  ): Promise<TLSSocket> {
    return new Promise((resolve, reject) => {
      const tlsSocket = tlsConnect({
        socket,
        servername: host,
      });

      tlsSocket.once('secureConnect', () => resolve(tlsSocket));
      tlsSocket.once('error', reject);
    });
  }

  private async sendCommand(
    socket: Socket | TLSSocket,
    command: string,
    expectedCodes: number[],
    sensitive = false,
  ): Promise<string> {
    if (!sensitive) {
      this.logger.debug(`SMTP command: ${command}`);
    }
    socket.write(`${command}\r\n`);
    return this.readResponse(socket, expectedCodes);
  }

  private readResponse(
    socket: Socket | TLSSocket,
    expectedCodes: number[],
    allowReconnectGreeting = false,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = '';

      const cleanup = () => {
        socket.off('data', onData);
        socket.off('error', onError);
        socket.off('close', onClose);
      };

      const finish = (response: string) => {
        cleanup();
        resolve(response);
      };

      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onError = (error: Error) => fail(error);
      const onClose = () =>
        fail(new Error('La conexión SMTP se cerró inesperadamente.'));
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (!lastLine || !/^\d{3}[ -]/.test(lastLine)) {
          return;
        }
        if (/^\d{3}-/.test(lastLine)) {
          return;
        }

        const code = Number(lastLine.slice(0, 3));
        const normalizedExpectedCodes = allowReconnectGreeting
          ? [...new Set([...expectedCodes, 220])]
          : expectedCodes;

        if (!normalizedExpectedCodes.includes(code)) {
          fail(new Error(`SMTP respondió con código ${code}: ${lastLine}`));
          return;
        }

        finish(buffer.trim());
      };

      socket.on('data', onData);
      socket.once('error', onError);
      socket.once('close', onClose);
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
