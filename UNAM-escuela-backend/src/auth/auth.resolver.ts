import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthResponse } from './types/auth-response.type';
import {
  VerifyEmailResponse,
  ResendVerificationCodeResponse,
} from './types';
import { LoginInput, SignupInput } from './dto/inputs';

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

  @Mutation(() => VerifyEmailResponse, { name: 'verifyEmailCode' })
  verifyEmailCode(
    @Args('email') email: string,
    @Args('code') code: string,
  ): Promise<VerifyEmailResponse> {
    return this.authService.verifyEmailCode(email, code);
  }

  @Mutation(() => ResendVerificationCodeResponse, {
    name: 'resendVerificationCode',
  })
  resendVerificationCode(
    @Args('email') email: string,
  ): Promise<ResendVerificationCodeResponse> {
    return this.authService.resendVerificationCode(email);
  }
}