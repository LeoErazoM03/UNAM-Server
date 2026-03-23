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

  @Column({ type: 'boolean', default: false })
  @Field(() => Boolean)
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpiresAt?: Date | null;

  // Campo para asignar idioma específico a usuarios admin (mantener por compatibilidad)
  @Column({ nullable: true })
  @Field(() => ID, { nullable: true })
  assignedLanguageId?: string;

  // Relación con el idioma asignado (mantener por compatibilidad)
  @ManyToOne(() => Lenguage, { nullable: true })
  @JoinColumn({ name: 'assignedLanguageId' })
  @Field(() => Lenguage, { nullable: true })
  assignedLanguage?: Lenguage;

  // Nuevos campos para múltiples idiomas
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
}
