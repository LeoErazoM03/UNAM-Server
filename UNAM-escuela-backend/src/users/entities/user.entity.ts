import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lenguage } from 'src/lenguages/entities/lenguage.entity';

@Entity({ name: 'users' })
@ObjectType()
export class User {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field(() => String)
  fullName: string;

  @Column({ unique: true })
  @Field(() => String)
  email: string;

  @Column()
  password: string;

  @Column({ type: 'text', array: true, default: ['alumno'] })
  @Field(() => [String])
  roles: string[];

  @Column({ type: 'boolean', default: true })
  @Field(() => Boolean)
  isActive: boolean;

  @Column({ nullable: true })
  @Field(() => ID, { nullable: true })
  assignedLanguageId?: string;

  @ManyToOne(() => Lenguage, { nullable: true })
  @JoinColumn({ name: 'assignedLanguageId' })
  @Field(() => Lenguage, { nullable: true })
  assignedLanguage?: Lenguage;

  @ManyToMany(() => Lenguage, { nullable: true })
  @JoinTable({
    name: 'user_assigned_languages',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'languageId', referencedColumnName: 'id' },
  })
  @Field(() => [Lenguage], { nullable: true })
  assignedLanguages?: Lenguage[];

  @ManyToOne(() => User, (user) => user.lastUpdateBy, { nullable: true })
  @JoinColumn({ name: 'lastUpdateBy' })
  @Field(() => User, { nullable: true })
  lastUpdateBy?: User;

  @Column({ default: false })
  @Field(() => Boolean)
  is_verified: boolean;

  @Column({ nullable: true, select: false })
  verification_code_hash?: string;

  @Column({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  verification_code_expires?: Date;

  @Column({ type: 'int', default: 0 })
  @Field(() => Number)
  verification_attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  verification_last_sent_at?: Date;
}