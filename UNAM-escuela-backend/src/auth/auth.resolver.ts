import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthResponse } from './types/auth-response.type';
import { SignupResponse } from './types/signup-response.type';
import { VerifyEmailResponse } from './types/verify-email-response.type';
import { LoginInput, SignupInput } from './dto/inputs';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => SignupResponse, { name: 'signin' })
  signup(
    @Args('signUpInput') signupInput: SignupInput,
  ): Promise<SignupResponse> {
    return this.authService.signup(signupInput);
  }

  @Mutation(() => VerifyEmailResponse, { name: 'verifyEmail' })
  verifyEmail(
    @Args('token', { type: () => String }) token: string,
  ): Promise<VerifyEmailResponse> {
    return this.authService.verifyEmail(token);
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
}
