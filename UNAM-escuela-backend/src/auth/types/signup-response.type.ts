import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SignupResponse {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;
}
