import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { User } from './entities/user.entity';
import { SignupInput } from '../auth/dto/inputs/signup.input';
import { UpdateUserInput } from './dto/update-user.input';
import { Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ValidRoles } from '../auth/enums/valid-roles.enum';
import { PaginatedUsers } from './dto/paginated-users.output';
import { UsersFilterArgs } from './dto/args/users-filter.arg';
import { Lenguage } from '../lenguages/entities/lenguage.entity';

@Injectable()
export class UsersService {
  private logger: Logger = new Logger('UsersService');
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(
    signupInput: SignupInput,
    verificationToken: string,
    verificationExpiresAt: Date,
  ): Promise<User> {
    try {
      this.logger.log(`Creando nuevo usuario con email: ${signupInput.email}`);
      const normalizedEmail = signupInput.email.trim().toLowerCase();
      const newUser = this.usersRepository.create({
        ...signupInput,
        email: normalizedEmail,
        fullName: signupInput.fullName.trim(),
        password: bcrypt.hashSync(signupInput.password, 10),
        roles: ['mortal'],
        emailVerified: false,
        emailVerificationToken: this.hashVerificationToken(verificationToken),
        emailVerificationExpiresAt: verificationExpiresAt,
      });
      const savedUser = await this.usersRepository.save(newUser);
      this.logger.log(
        `Usuario creado exitosamente: ${savedUser.email} (ID: ${savedUser.id}) con verificación pendiente`,
      );
      return savedUser;
    } catch (error: unknown) {
      this.logger.error(
        `Error creando usuario con email: ${signupInput.email} - ${this.getErrorMessage(error)}`,
      );
      this.handleDBError(error);
    }
  }

  async markEmailAsVerified(rawToken: string): Promise<User> {
    const hashedToken = this.hashVerificationToken(rawToken);
    const user = await this.usersRepository.findOne({
      where: { emailVerificationToken: hashedToken },
    });

    if (!user) {
      throw new BadRequestException(
        'El enlace de verificación no es válido o ya fue utilizado.',
      );
    }

    if (user.emailVerified) {
      return user;
    }

    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'El enlace de verificación expiró. Solicita uno nuevo.',
      );
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpiresAt = null;

    return this.usersRepository.save(user);
  }

  hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async findAll(roles: ValidRoles[], requestingUser?: User): Promise<User[]> {
    console.log('[DEBUG] findAll called with roles:', roles);
    console.log(
      '[DEBUG] requestingUser:',
      requestingUser
        ? {
            id: requestingUser.id,
            email: requestingUser.email,
            roles: requestingUser.roles,
            assignedLanguageId: requestingUser.assignedLanguageId,
          }
        : 'null',
    );

    let query = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.assignedLanguage', 'assignedLanguage')
      .leftJoinAndSelect('user.assignedLanguages', 'assignedLanguages')
      .leftJoinAndSelect('user.lastUpdateBy', 'lastUpdateBy');

    if (roles.length > 0) {
      query = query.andWhere('user.roles && ARRAY[:...roles]', { roles });
    }

    if (
      requestingUser &&
      this.getHighestRole(requestingUser.roles) === ValidRoles.admin
    ) {
      console.log(
        '[DEBUG] findAll: Admin user detected, roles:',
        requestingUser.roles,
      );
      console.log(
        '[DEBUG] findAll: Admin assignedLanguageId:',
        requestingUser.assignedLanguageId,
      );
      console.log('[DEBUG] findAll: Searching for roles:', roles);

      if (
        requestingUser.assignedLanguageId &&
        roles.includes(ValidRoles.docente)
      ) {
        console.log(
          '[DEBUG] findAll: Applying teacher filter for admin language:',
          requestingUser.assignedLanguageId,
        );
        query = query.andWhere(
          '(assignedLanguages.id IS NULL AND user.assignedLanguageId IS NULL) OR (assignedLanguages.id = :adminLanguageId OR user.assignedLanguageId = :adminLanguageId)',
          { adminLanguageId: requestingUser.assignedLanguageId },
        );
      }
    }

    console.log('[DEBUG] findAll SQL:', query.getSql());
    console.log('[DEBUG] findAll parameters:', query.getParameters());

    const users = await query.getMany();

    console.log('[DEBUG] findAll found users count:', users.length);
    users.forEach((user, index) => {
      console.log(`[DEBUG] findAll User ${index + 1}:`, {
        id: user.id,
        email: user.email,
        roles: user.roles,
        assignedLanguageId: user.assignedLanguageId,
        assignedLanguage: user.assignedLanguage?.name,
        assignedLanguages: user.assignedLanguages?.map((lang) => lang.name),
      });
    });

    return users;
  }

  async findPaginated(
    filters: UsersFilterArgs,
    requestingUser?: User,
  ): Promise<PaginatedUsers> {
    const {
      roles = [],
      search,
      page = 1,
      limit = 10,
      assignedLanguageId,
      isActive,
    } = filters;

    let query = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.assignedLanguage', 'assignedLanguage')
      .leftJoinAndSelect('user.assignedLanguages', 'assignedLanguages')
      .leftJoinAndSelect('user.lastUpdateBy', 'lastUpdateBy');

    if (roles.length > 0) {
      query = query
        .andWhere('user.roles && ARRAY[:...roles]')
        .setParameter('roles', roles);
    }

    if (assignedLanguageId) {
      query = query.andWhere('user.assignedLanguageId = :assignedLanguageId', {
        assignedLanguageId,
      });
    }

    if (typeof isActive === 'boolean') {
      query = query.andWhere('user.isActive = :isActive', { isActive });
    }

    if (
      requestingUser &&
      this.getHighestRole(requestingUser.roles) === ValidRoles.admin
    ) {
      console.log('[DEBUG] Admin user detected, roles:', requestingUser.roles);
      console.log(
        '[DEBUG] Admin assignedLanguageId:',
        requestingUser.assignedLanguageId,
      );
      console.log('[DEBUG] Searching for roles:', roles);

      if (
        requestingUser.assignedLanguageId &&
        roles.includes(ValidRoles.docente)
      ) {
        console.log(
          '[DEBUG] Applying teacher filter for admin language:',
          requestingUser.assignedLanguageId,
        );
        query = query.andWhere(
          '(assignedLanguages.id IS NULL AND user.assignedLanguageId IS NULL) OR (assignedLanguages.id = :adminLanguageId OR user.assignedLanguageId = :adminLanguageId)',
          { adminLanguageId: requestingUser.assignedLanguageId },
        );
      }
    }

    if (search && search.trim()) {
      query = query.andWhere(
        '(LOWER(user.fullName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search: `%${search.trim()}%` },
      );
    }

    query = query.orderBy('user.fullName', 'ASC');

    const total = await query.getCount();
    const offset = (page - 1) * limit;
    query = query.skip(offset).take(limit);

    console.log('[DEBUG] Final query SQL:', query.getSql());
    console.log('[DEBUG] Query parameters:', query.getParameters());

    const users = await query.getMany();

    console.log('[DEBUG] Found users count:', users.length);
    users.forEach((user, index) => {
      console.log(`[DEBUG] User ${index + 1}:`, {
        id: user.id,
        email: user.email,
        roles: user.roles,
        assignedLanguageId: user.assignedLanguageId,
        assignedLanguage: user.assignedLanguage?.name,
        assignedLanguages: user.assignedLanguages?.map((lang) => lang.name),
      });
    });

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      users,
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    };
  }

  async findOneByEmail(email: string): Promise<User> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      this.logger.log(`Buscando usuario por email: ${normalizedEmail}`);
      const user = await this.usersRepository.findOneByOrFail({
        email: normalizedEmail,
      });
      this.logger.log(
        `Usuario encontrado por email: ${normalizedEmail} (ID: ${user.id})`,
      );
      return user;
    } catch {
      this.logger.warn(`Usuario no encontrado con email: ${email}`);
      throw new NotFoundException(`El usuario con este email no existe`);
    }
  }

  async findOneById(id: string): Promise<User> {
    try {
      this.logger.log(`Buscando usuario por ID: ${id}`);
      const user = await this.usersRepository.findOneByOrFail({ id });
      this.logger.log(`Usuario encontrado por ID: ${id} (${user.email})`);
      return user;
    } catch {
      this.logger.warn(`Usuario no encontrado con ID: ${id}`);
      throw new NotFoundException(`${id} no encontrado`);
    }
  }

  async block(id: string, adminUser: User): Promise<User> {
    this.logger.log(
      `Intentando bloquear/desbloquear usuario ${id} por admin ${adminUser.fullName}`,
    );

    const userToBlock = await this.findOneById(id);

    if (!this.canManageUser(adminUser, userToBlock)) {
      throw new BadRequestException(
        'No tienes permisos para bloquear/desbloquear este usuario',
      );
    }

    if (userToBlock.id === adminUser.id) {
      throw new BadRequestException(
        'No puedes bloquear/desbloquear tu propia cuenta',
      );
    }

    userToBlock.isActive = !userToBlock.isActive;
    userToBlock.lastUpdateBy = adminUser;

    this.logger.log(
      `Usuario ${userToBlock.email} ${userToBlock.isActive ? 'activado' : 'bloqueado'} por ${adminUser.fullName}`,
    );

    return await this.usersRepository.save(userToBlock);
  }

  async updateUserRoles(
    id: string,
    roles: ValidRoles[],
    adminUser: User,
  ): Promise<User> {
    this.logger.log(
      `Actualizando roles del usuario ${id} por admin ${adminUser.fullName}`,
    );

    const userToUpdate = await this.findOneById(id);

    if (!this.canManageUser(adminUser, userToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para cambiar los roles de este usuario',
      );
    }

    if (!this.canAssignRoles(adminUser, roles)) {
      throw new BadRequestException(
        'No tienes permisos para asignar uno o más de estos roles',
      );
    }

    const userWithLanguages = await this.usersRepository.findOne({
      where: { id: userToUpdate.id },
      relations: ['assignedLanguages'],
    });

    if (!userWithLanguages) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const newHighestRole = this.getHighestRole(roles);

    const rolesWithLanguages = [
      ValidRoles.admin,
      ValidRoles.docente,
      ValidRoles.superUser,
    ];

    if (!rolesWithLanguages.includes(newHighestRole)) {
      this.logger.log(
        `Removiendo idiomas asignados de ${userToUpdate.email} debido a cambio de rol a ${newHighestRole}`,
      );

      userWithLanguages.assignedLanguages = [];
      userWithLanguages.assignedLanguageId = undefined;
      await this.usersRepository.save(userWithLanguages);
    } else {
      const adminHighestRole = this.getHighestRole(adminUser.roles);
      if (
        adminHighestRole === ValidRoles.admin &&
        adminUser.assignedLanguageId &&
        roles.includes(ValidRoles.docente) &&
        !userToUpdate.roles.includes(ValidRoles.docente)
      ) {
        this.logger.log(
          `Admin ${adminUser.fullName} convirtiendo usuario en maestro. Asignando idioma ${adminUser.assignedLanguageId}`,
        );

        const adminLanguage = await this.usersRepository.manager
          .getRepository(Lenguage)
          .findOne({
            where: { id: adminUser.assignedLanguageId, isActive: true },
          });

        if (adminLanguage) {
          userWithLanguages.assignedLanguages = [adminLanguage];
          userWithLanguages.assignedLanguageId = adminUser.assignedLanguageId;
          await this.usersRepository.save(userWithLanguages);
        }
      }
    }

    userToUpdate.roles = roles;
    userToUpdate.lastUpdateBy = adminUser;

    this.logger.log(
      `Roles actualizados para ${userToUpdate.email}: ${roles.join(', ')}`,
    );
    return await this.usersRepository.save(userToUpdate);
  }

  async updateUser(
    updateUserInput: UpdateUserInput,
    adminUser: User,
  ): Promise<User> {
    const { id, fullName, email, password, isActive } = updateUserInput;

    this.logger.log(
      `Actualizando usuario ${id} por admin ${adminUser.fullName}`,
    );

    const userToUpdate = await this.findOneById(id);

    if (!this.canManageUser(adminUser, userToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para editar este usuario',
      );
    }

    if (email && email.trim()) {
      const emailToCheck = email.trim().toLowerCase();

      if (emailToCheck !== userToUpdate.email.toLowerCase()) {
        const existingUser = await this.usersRepository.findOne({
          where: { email: emailToCheck },
        });

        if (existingUser) {
          throw new BadRequestException('Ya existe un usuario con este email');
        }

        userToUpdate.email = emailToCheck;
      }
    }

    if (fullName && fullName.trim()) {
      userToUpdate.fullName = fullName.trim();
    }

    if (password && password.trim()) {
      userToUpdate.password = bcrypt.hashSync(password, 10);
    }

    if (isActive !== undefined) {
      userToUpdate.isActive = isActive;
    }

    userToUpdate.lastUpdateBy = adminUser;

    this.logger.log(
      `Usuario ${userToUpdate.email} actualizado por ${adminUser.fullName}`,
    );

    return await this.usersRepository.save(userToUpdate);
  }

  async changeUserPassword(
    userId: string,
    newPassword: string,
    superUser: User,
  ): Promise<User> {
    this.logger.log(
      `SuperUser ${superUser.fullName} changing password for user: ${userId}`,
    );

    if (!superUser.roles.includes(ValidRoles.superUser)) {
      throw new BadRequestException(
        'Solo los superAdministradores pueden cambiar contraseñas de usuarios',
      );
    }

    const userToUpdate = await this.findOneById(userId);

    userToUpdate.password = bcrypt.hashSync(newPassword, 10);
    userToUpdate.lastUpdateBy = superUser;

    this.logger.log(
      `Contraseña actualizada para usuario ${userToUpdate.email} por superUser ${superUser.fullName}`,
    );

    return await this.usersRepository.save(userToUpdate);
  }

  async assignLanguageToUser(
    userId: string,
    languageId: string | undefined,
    adminUser: User,
  ): Promise<User> {
    this.logger.log(
      `Asignando idioma ${languageId} al usuario ${userId} por admin ${adminUser.fullName}`,
    );

    const userToUpdate = await this.findOneById(userId);

    if (!this.canManageUser(adminUser, userToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para gestionar este usuario',
      );
    }

    const adminHighestRole = this.getHighestRole(adminUser.roles);
    if (adminHighestRole !== ValidRoles.superUser) {
      throw new BadRequestException(
        'Solo los Super Administradores pueden asignar idiomas a usuarios',
      );
    }

    userToUpdate.assignedLanguageId = languageId;
    userToUpdate.lastUpdateBy = adminUser;

    this.logger.log(
      `Idioma ${languageId ? languageId : 'removido'} asignado a ${userToUpdate.email}`,
    );
    return await this.usersRepository.save(userToUpdate);
  }

  async assignMultipleLanguagesToUser(
    userId: string,
    languageIds: string[] | undefined,
    adminUser: User,
  ): Promise<User> {
    this.logger.log(
      `Asignando múltiples idiomas [${languageIds?.join(', ')}] al usuario ${userId} por admin ${adminUser.fullName}`,
    );

    const userToUpdate = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['assignedLanguages'],
    });

    if (!userToUpdate) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (!this.canManageUser(adminUser, userToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para gestionar este usuario',
      );
    }

    const adminHighestRole = this.getHighestRole(adminUser.roles);
    if (adminHighestRole !== ValidRoles.superUser) {
      throw new BadRequestException(
        'Solo los Super Administradores pueden asignar idiomas a usuarios',
      );
    }

    if (!languageIds || languageIds.length === 0) {
      userToUpdate.assignedLanguages = [];
    } else {
      const languages = await this.usersRepository.manager
        .getRepository(Lenguage)
        .findBy({
          id: In(languageIds),
          isActive: true,
        });

      if (languages.length !== languageIds.length) {
        throw new BadRequestException(
          'Algunos idiomas no existen o no están activos',
        );
      }

      userToUpdate.assignedLanguages = languages;
    }

    userToUpdate.lastUpdateBy = adminUser;

    this.logger.log(
      `Idiomas [${languageIds?.join(', ')}] asignados a ${userToUpdate.email}`,
    );
    return await this.usersRepository.save(userToUpdate);
  }

  async assignAdminLanguageToTeacher(
    teacherId: string,
    adminUser: User,
  ): Promise<User> {
    this.logger.log(
      `Admin ${adminUser.fullName} asignando su idioma a maestro ${teacherId}`,
    );

    const adminHighestRole = this.getHighestRole(adminUser.roles);
    if (
      adminHighestRole !== ValidRoles.admin ||
      !adminUser.assignedLanguageId
    ) {
      throw new BadRequestException(
        'Solo administradores con idioma asignado pueden usar esta función',
      );
    }

    const teacherToUpdate = await this.usersRepository.findOne({
      where: { id: teacherId },
      relations: ['assignedLanguages'],
    });

    if (!teacherToUpdate) {
      throw new BadRequestException('Maestro no encontrado');
    }

    if (!teacherToUpdate.roles.includes(ValidRoles.docente)) {
      throw new BadRequestException('El usuario debe ser un maestro');
    }

    const hasLanguage =
      (teacherToUpdate.assignedLanguages &&
        teacherToUpdate.assignedLanguages.length > 0) ||
      teacherToUpdate.assignedLanguageId;

    if (hasLanguage) {
      throw new BadRequestException(
        'Este maestro ya tiene un idioma asignado. Solo se puede asignar idioma a maestros sin idioma asignado.',
      );
    }

    if (!this.canManageUser(adminUser, teacherToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para gestionar este usuario',
      );
    }

    const adminLanguage = await this.usersRepository.manager
      .getRepository(Lenguage)
      .findOne({
        where: { id: adminUser.assignedLanguageId, isActive: true },
      });

    if (!adminLanguage) {
      throw new BadRequestException(
        'Tu idioma asignado no existe o no está activo',
      );
    }

    teacherToUpdate.assignedLanguages = [adminLanguage];
    teacherToUpdate.assignedLanguageId = adminUser.assignedLanguageId;
    teacherToUpdate.lastUpdateBy = adminUser;

    this.logger.log(
      `Idioma ${adminLanguage.name} asignado a maestro ${teacherToUpdate.email} por admin ${adminUser.fullName}`,
    );

    return await this.usersRepository.save(teacherToUpdate);
  }

  private canManageUser(adminUser: User, targetUser: User): boolean {
    const adminHighestRole = this.getHighestRole(adminUser.roles);
    const targetHighestRole = this.getHighestRole(targetUser.roles);

    const roleHierarchy = {
      superUser: 5,
      admin: 4,
      docente: 3,
      alumno: 2,
      mortal: 1,
    };

    const adminLevel = roleHierarchy[adminHighestRole] || 0;
    const targetLevel = roleHierarchy[targetHighestRole] || 0;

    if (adminHighestRole === ValidRoles.superUser) {
      return true;
    }

    return adminLevel > targetLevel;
  }

  private canAssignRoles(
    adminUser: User,
    rolesToAssign: ValidRoles[],
  ): boolean {
    const adminHighestRole = this.getHighestRole(adminUser.roles);

    for (const role of rolesToAssign) {
      if (adminHighestRole === ValidRoles.superUser) {
        if (
          role === ValidRoles.superUser ||
          role === ValidRoles.admin ||
          role === ValidRoles.docente ||
          role === ValidRoles.alumno ||
          role === ValidRoles.mortal
        ) {
          continue;
        }
      }

      if (adminHighestRole === ValidRoles.admin) {
        if (
          role === ValidRoles.docente ||
          role === ValidRoles.alumno ||
          role === ValidRoles.mortal
        ) {
          continue;
        }
      }

      if (adminHighestRole === ValidRoles.docente) {
        if (role === ValidRoles.alumno || role === ValidRoles.mortal) {
          continue;
        }
      }

      return false;
    }

    return true;
  }

  async deleteUser(id: string, superUser: User): Promise<User> {
    try {
      this.logger.log(
        `SuperUser ${superUser.email} attempting to delete user with ID: ${id}`,
      );

      if (!superUser.roles.includes(ValidRoles.superUser)) {
        throw new BadRequestException(
          'Solo los superUsuarios pueden eliminar usuarios',
        );
      }

      const userToDelete = await this.usersRepository.findOne({
        where: { id, isActive: true },
        relations: ['assignedLanguage', 'assignedLanguages'],
      });

      if (!userToDelete) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      if (userToDelete.id === superUser.id) {
        throw new BadRequestException('No puedes eliminarte a ti mismo');
      }

      if (userToDelete.roles.includes(ValidRoles.superUser)) {
        throw new BadRequestException(
          'No se puede eliminar a otro superUsuario',
        );
      }

      const deletedUserData = { ...userToDelete };
      await this.usersRepository.remove(userToDelete);

      this.logger.log(
        `Usuario ${deletedUserData.email} (ID: ${id}) eliminado exitosamente por ${superUser.email}`,
      );

      return deletedUserData;
    } catch (error: unknown) {
      this.logger.error(
        `Error eliminando usuario con ID: ${id} - ${this.getErrorMessage(error)}`,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.handleDBError(error);
    }
  }

  private getHighestRole(roles: string[]): ValidRoles {
    const roleHierarchy = {
      superUser: 5,
      admin: 4,
      docente: 3,
      alumno: 2,
      mortal: 1,
    };

    let highestRole = ValidRoles.mortal;
    let highestLevel = 0;

    for (const role of roles) {
      const level = roleHierarchy[role as ValidRoles] || 0;
      if (level > highestLevel) {
        highestLevel = level;
        highestRole = role as ValidRoles;
      }
    }

    return highestRole;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Error desconocido';
  }

  private handleDBError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      throw new BadRequestException('Este correo ya esta en uso');
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'error-01'
    ) {
      const detail =
        'detail' in error ? (error as { detail?: string }).detail : undefined;
      throw new BadRequestException(detail ?? 'Error de base de datos');
    }
    this.logger.error(error);
    throw new InternalServerErrorException('Favor de checar los logs');
  }
}
