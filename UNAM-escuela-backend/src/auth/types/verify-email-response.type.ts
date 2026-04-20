import { Field, ObjectType } from '@nestjs/graphql';
import { User } from 'src/users/entities/user.entity';

@ObjectType()
export class VerifyEmailResponse {
    @Field(() => Boolean)
    success: boolean;

    @Field(() => String)
    message: string;

    @Field(() => User, { nullable: true })
    user?: User;

    @Field(() => String, { nullable: true })
    token?: string;
}