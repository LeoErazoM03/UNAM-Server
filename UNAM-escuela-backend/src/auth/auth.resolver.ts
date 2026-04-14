import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthResponse } from './types/auth-response.type';
import { LoginInput, SignupInput } from './dto/inputs';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from 'src/users/entities/user.entity';
import { ValidRoles } from './enums/valid-roles.enum';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) { }

  @Mutation(() => AuthResponse, { name: 'signin' })
  signup(@Args('signUpInput') signupInput: SignupInput): Promise<AuthResponse> {
    return this.authService.signup(signupInput);
  }

  @Mutation(() => AuthResponse, { name: 'login' })
  login(@Args('loginInput') loginInput: LoginInput): Promise<AuthResponse> {
    return this.authService.login(loginInput);
  }

  @Query(() => AuthResponse, { name: 'revalidate' })
  async revalidateToken(
    @Args('token', { nullable: true }) token?: string,
  ): Promise<AuthResponse> {
    return this.authService.revalidateTokenFromString(token);
  }

  @Mutation(() => Boolean, { name: 'verifyEmailCode' })
  verifyEmailCode(
    @Args('email') email: string,
    @Args('code') code: string,
  ): Promise<boolean> {
    return this.authService.verifyEmailCode(email, code);
  }

  @Mutation(() => Boolean, { name: 'resendVerificationCode' })
  resendVerificationCode(
    @Args('email') email: string,
  ): Promise<boolean> {
    return this.authService.resendVerificationCode(email);
  }
}