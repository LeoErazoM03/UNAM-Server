import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { buildVerificationCodeEmailTemplate } from './templates/verification-code.template';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    private readonly transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT || 465),
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASSWORD,
        },
    });

    async sendVerificationCode(email: string, fullName: string, code: string): Promise<void> {
        const template = buildVerificationCodeEmailTemplate(fullName, code);

        const info = await this.transporter.sendMail({
            from: process.env.MAIL_FROM,
            to: email,
            subject: template.subject,
            text: template.text,
            html: template.html,
        });

        this.logger.log(`Correo de verificación enviado a ${email}. Message ID: ${info.messageId}`);
    }
}