import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { AuthResponse } from './types/auth-response.type';
import { UsersService } from 'src/users/users.service';
import { LoginInput, SignupInput } from './dto/inputs';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/users/entities/user.entity';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) { }

  private getJwtToken(userId: string) {
    return this.jwtService.sign({ id: userId });
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async hashVerificationCode(code: string): Promise<string> {
    return bcrypt.hash(code, 10);
  }

  async signup(signupInput: SignupInput): Promise<AuthResponse> {
    try {
      this.logger.log(`Intento de registro para email: ${signupInput.email}`);

      const user = await this.usersService.create(signupInput);

      const verificationCode = this.generateVerificationCode();
      const verificationCodeHash = await this.hashVerificationCode(verificationCode);
      const verificationCodeExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

      user.is_verified = false;
      user.verification_code_hash = verificationCodeHash;
      user.verification_code_expires = verificationCodeExpires;
      user.verification_attempts = 0;
      user.verification_last_sent_at = new Date();

      await this.usersService.save(user);

      this.logger.log(
        `Usuario creado pendiente de verificación: ${user.email} (ID: ${user.id})`,
      );

      await this.mailService.sendVerificationCode(
        user.email,
        user.fullName,
        verificationCode,
      );

      return {
        user,
      };
    } catch (error) {
      this.logger.error(
        `Error en registro para email: ${signupInput.email} - ${error.message}`,
      );
      throw error;
    }
  }

  async login(loginInput: LoginInput): Promise<AuthResponse> {
    try {
      const { email, password } = loginInput;
      this.logger.log(`Intento de login para email: ${email}`);

      const user = await this.usersService.findOneByEmailWithVerificationCode(email);
      if (!bcrypt.compareSync(password, user.password)) {
        throw new UnauthorizedException('Credenciales incorrectas');
      }

      if (!user.is_verified) {
        throw new UnauthorizedException(
          'Debes verificar tu correo antes de iniciar sesión',
        );
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Cuenta suspendida');
      }

      const token = this.getJwtToken(user.id);

      this.logger.log(`Login exitoso para usuario: ${user.email} (ID: ${user.id})`);

      return { token, user };
    } catch (error) {
      this.logger.error(
        `Error en login para email: ${loginInput.email} - ${error.message}`,
      );
      throw error;
    }
  }

  // VERIFICACIÓN DE EMAIL
  async verifyEmailCode(email: string, code: string): Promise<boolean> {
    try {
      const user = await this.usersService.findOneByEmailWithVerificationCode(email);
      if (user.is_verified) {
        throw new BadRequestException('Este correo ya fue verificado');
      }

      if (!user.verification_code_hash || !user.verification_code_expires) {
        throw new BadRequestException(
          'No existe un código de verificación activo para esta cuenta',
        );
      }

      if (user.verification_code_expires < new Date()) {
        throw new UnauthorizedException('El código de verificación expiró');
      }

      if (user.verification_attempts >= 5) {
        throw new UnauthorizedException(
          'Se alcanzó el máximo de intentos de verificación',
        );
      }

      const isValidCode = await bcrypt.compare(code, user.verification_code_hash);

      if (!isValidCode) {
        user.verification_attempts += 1;
        await this.usersService.save(user);
        throw new UnauthorizedException('Código de verificación incorrecto');
      }

      user.is_verified = true;
      user.verification_code_hash = undefined;
      user.verification_code_expires = undefined;
      user.verification_attempts = 0;
      user.verification_last_sent_at = undefined;

      await this.usersService.save(user);

      this.logger.log(`Usuario verificado correctamente: ${user.email}`);

      return true;
    } catch (error) {
      this.logger.error(`Error verificando email: ${error.message}`);
      throw error;
    }
  }


  // REENVÍO DE CÓDIGO
  async resendVerificationCode(email: string): Promise<boolean> {
    try {
      const user = await this.usersService.findOneByEmailWithVerificationCode(email);
      if (user.is_verified) {
        throw new BadRequestException('Este correo ya fue verificado');
      }

      const now = new Date();

      if (
        user.verification_last_sent_at &&
        now.getTime() - new Date(user.verification_last_sent_at).getTime() < 60 * 1000
      ) {
        throw new BadRequestException(
          'Debes esperar al menos 1 minuto antes de solicitar otro código',
        );
      }

      const verificationCode = this.generateVerificationCode();
      const verificationCodeHash = await this.hashVerificationCode(verificationCode);
      const verificationCodeExpires = new Date(Date.now() + 1000 * 60 * 60);

      user.verification_code_hash = verificationCodeHash;
      user.verification_code_expires = verificationCodeExpires;
      user.verification_attempts = 0;
      user.verification_last_sent_at = now;

      await this.usersService.save(user);

      await this.mailService.sendVerificationCode(
        user.email,
        user.fullName,
        verificationCode,
      );

      this.logger.log(`Código de verificación reenviado para ${user.email}`);

      return true;
    } catch (error) {
      this.logger.error(`Error reenviando código: ${error.message}`);
      throw error;
    }
  }

  async validateUser(id: string): Promise<User> {
    const user = await this.usersService.findOneById(id);

    if (!user.is_verified) {
      throw new UnauthorizedException('Correo no verificado');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Cuenta suspendida');
    }

    delete (user as any).password;

    return user;
  }

  revalidateToken(user: User | null): AuthResponse {
    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const token = this.getJwtToken(user.id);
    return { token, user };
  }

  async revalidateTokenFromString(token?: string): Promise<AuthResponse> {
    if (!token) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    try {
      const cleanToken = token.replace('Bearer ', '');
      const payload = this.jwtService.verify(cleanToken);
      const user = await this.validateUser(payload.id);

      const newToken = this.getJwtToken(user.id);

      return { token: newToken, user };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}