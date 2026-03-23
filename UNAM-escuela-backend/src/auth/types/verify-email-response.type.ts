import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class VerifyEmailResponse {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;
}
