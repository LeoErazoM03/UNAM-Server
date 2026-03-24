import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthResponse } from './types/auth-response.type';
import { UsersService } from 'src/users/users.service';
import { LoginInput, SignupInput } from './dto/inputs';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/users/entities/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) { }

  private getJwtToken(userId: string) {
    return this.jwtService.sign({ id: userId });
  }

  async signup(signupInput: SignupInput): Promise<AuthResponse> {
    try {
      this.logger.log(`Intento de registro para email: ${signupInput.email}`);

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

      const user = await this.usersService.create({
        ...signupInput,
      } as any);

      // Asignar valores correctos
      user.is_verified = false;
      user.verification_token = verificationToken;
      user.verification_token_expires = verificationExpires;

      // usar método real del service
      await this.usersService.save(user);

      this.logger.log(
        `Usuario creado (pendiente de verificación): ${user.email}`,
      );

      // ❗ NO regreses token si no está verificado
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

      const user = await this.usersService.findOneByEmail(email);

      if (!bcrypt.compareSync(password, user.password)) {
        throw new UnauthorizedException('Credenciales incorrectas');
      }

      // ❗ bloquear si no verificó
      if (!user.is_verified) {
        throw new UnauthorizedException(
          'Debes verificar tu correo antes de iniciar sesión',
        );
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Cuenta suspendida');
      }

      const token = this.getJwtToken(user.id);

      return { token, user };
    } catch (error) {
      this.logger.error(
        `Error en login para email: ${loginInput.email} - ${error.message}`,
      );
      throw error;
    }
  }

  // VERIFICACIÓN DE EMAIL
  async verifyEmail(token: string): Promise<boolean> {
    try {
      const user = await this.usersService.findByVerificationToken(token);

      if (!user) {
        throw new UnauthorizedException('Token inválido');
      }

      if (
        !user.verification_token_expires ||
        user.verification_token_expires < new Date()
      ) {
        throw new UnauthorizedException('Token expirado');
      }

      user.is_verified = true;

      // ⚠️ NO usar null → usa undefined
      user.verification_token = undefined;
      user.verification_token_expires = undefined;

      await this.usersService.save(user);

      this.logger.log(`Usuario verificado: ${user.email}`);

      return true;
    } catch (error) {
      this.logger.error(`Error verificando email: ${error.message}`);
      throw error;
    }
  }

  async validateUser(id: string): Promise<User> {
    const user = await this.usersService.findOneById(id);

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