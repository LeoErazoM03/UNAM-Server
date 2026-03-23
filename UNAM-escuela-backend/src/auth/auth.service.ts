import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthResponse } from './types/auth-response.type';
import { SignupResponse } from './types/signup-response.type';
import { VerifyEmailResponse } from './types/verify-email-response.type';
import { UsersService } from 'src/users/users.service';
import { LoginInput, SignupInput } from './dto/inputs';
import { User } from 'src/users/entities/user.entity';
import { EmailService } from './services/email.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly verificationTokenTtlMs = 1000 * 60 * 60 * 24;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private getJwtToken(userId: string) {
    return this.jwtService.sign({ id: userId });
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Error desconocido';
  }

  async signup(signupInput: SignupInput): Promise<SignupResponse> {
    try {
      this.logger.log(`Intento de registro para email: ${signupInput.email}`);
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpiresAt = new Date(
        Date.now() + this.verificationTokenTtlMs,
      );

      const user = await this.usersService.create(
        signupInput,
        verificationToken,
        verificationExpiresAt,
      );

      await this.emailService.sendVerificationEmail({
        email: user.email,
        fullName: user.fullName,
        token: verificationToken,
      });

      this.logger.log(
        `Registro exitoso para usuario: ${user.email} (ID: ${user.id}) con correo de verificación enviado`,
      );

      return {
        success: true,
        message:
          'Te enviamos un correo para verificar tu cuenta. Revisa tu bandeja de entrada antes de iniciar sesión.',
      };
    } catch (error) {
      this.logger.error(
        `Error en registro para email: ${signupInput.email} - ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<VerifyEmailResponse> {
    const user = await this.usersService.markEmailAsVerified(token);
    this.logger.log(
      `Correo verificado para usuario: ${user.email} (ID: ${user.id})`,
    );

    return {
      success: true,
      message:
        'Tu correo fue verificado correctamente. Ahora ya puedes iniciar sesión y guardar tu progreso.',
    };
  }

  async login(loginInput: LoginInput): Promise<AuthResponse> {
    try {
      const { email, password } = loginInput;
      this.logger.log(`Intento de login para email: ${email}`);

      const user = await this.usersService.findOneByEmail(email);
      if (!bcrypt.compareSync(password, user.password)) {
        this.logger.warn(`Credenciales incorrectas para email: ${email}`);
        throw new Error('Email o password no es correcto');
      }

      if (!user.isActive) {
        this.logger.warn(
          `Usuario bloqueado intentó hacer login: ${user.email} (ID: ${user.id})`,
        );
        throw new UnauthorizedException(
          'Esta cuenta está suspendida temporalmente. Contáctese con un administrador para más detalles.',
        );
      }

      if (!user.emailVerified) {
        this.logger.warn(
          `Usuario sin verificar intentó hacer login: ${user.email} (ID: ${user.id})`,
        );
        throw new UnauthorizedException(
          'Debes verificar tu correo electrónico antes de iniciar sesión.',
        );
      }

      const token = this.getJwtToken(user.id);
      this.logger.log(
        `Login exitoso para usuario: ${user.email} (ID: ${user.id}) - Roles: ${user.roles.join(', ')}`,
      );
      return { token, user };
    } catch (error) {
      this.logger.error(
        `Error en login para email: ${loginInput.email} - ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async validateUser(id: string): Promise<User> {
    try {
      this.logger.log(`Validando usuario con ID: ${id}`);
      const user = await this.usersService.findOneById(id);
      if (!user.isActive) {
        this.logger.warn(
          `Usuario inactivo intentó acceder: ${user.email} (ID: ${id})`,
        );
        throw new UnauthorizedException(
          'Esta cuenta está suspendida temporalmente. Contáctese con un administrador para más detalles.',
        );
      }
      if (!user.emailVerified) {
        throw new UnauthorizedException(
          'Debes verificar tu correo electrónico antes de continuar.',
        );
      }
      const { password: unusedPassword, ...sanitizedUser } = user;
      void unusedPassword;
      this.logger.log(
        `Usuario validado exitosamente: ${user.email} (ID: ${id})`,
      );
      return sanitizedUser as User;
    } catch (error) {
      this.logger.error(
        `Error validando usuario ID: ${id} - ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  revalidateToken(user: User | null): AuthResponse {
    if (!user) {
      this.logger.log('Intento de revalidación sin usuario autenticado');
      throw new UnauthorizedException(
        'Usuario no autenticado, por favor inicie sesión',
      );
    }

    this.logger.log(
      `Revalidando token para usuario: ${user.email} (ID: ${user.id})`,
    );
    const token = this.getJwtToken(user.id);
    return { token, user };
  }

  async revalidateTokenFromString(token?: string): Promise<AuthResponse> {
    if (!token) {
      this.logger.log('Intento de revalidación sin token');
      throw new UnauthorizedException(
        'Usuario no autenticado, por favor inicie sesión',
      );
    }

    try {
      const cleanToken = token.replace('Bearer ', '');
      const payload = this.jwtService.verify<JwtPayload>(cleanToken);
      const user = await this.validateUser(payload.id);

      this.logger.log(
        `Revalidando token para usuario: ${user.email} (ID: ${user.id})`,
      );

      const newToken = this.getJwtToken(user.id);
      return { token: newToken, user };
    } catch (error) {
      this.logger.error(
        `Error revalidando token: ${this.getErrorMessage(error)}`,
      );
      throw new UnauthorizedException(
        'Token inválido o expirado, por favor inicie sesión nuevamente',
      );
    }
  }
}
