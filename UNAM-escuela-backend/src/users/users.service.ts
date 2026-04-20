import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
  ) { }

  async create(signupInput: SignupInput): Promise<User> {
    try {
      this.logger.log(`Creando nuevo usuario con email: ${signupInput.email}`);
      const newUser = this.usersRepository.create({
        ...signupInput,
        password: bcrypt.hashSync(signupInput.password, 10),
        roles: ['alumno'], // Asigna automáticamente el rol de alumno
      });
      const savedUser = await this.usersRepository.save(newUser);
      this.logger.log(
        `Usuario creado exitosamente: ${savedUser.email} (ID: ${savedUser.id}) con rol de alumno`,
      );
      return savedUser;
    } catch (error) {
      this.logger.error(
        `Error creando usuario con email: ${signupInput.email} - ${error.message}`,
      );
      this.handleDBError(error);
    }
  }

  async save(user: User): Promise<User> {
    return this.usersRepository.save(user);
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

    // Si se especifican roles, filtrar por ellos
    if (roles.length > 0) {
      query = query.andWhere('user.roles && ARRAY[:...roles]', { roles });
    }

    // Si el usuario que hace la petición es admin con idioma asignado, filtrar profesores
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
        // Para admins con idioma asignado buscando profesores:
        // Mostrar profesores SIN idioma asignado (para poder asignarles su idioma)
        // Y TAMBIÉN mostrar profesores de su mismo idioma (para gestionar contenido)
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

  // BUSCAR USUARIO POR EMAIL CON CÓDIGO DE VERIFICACIÓN
  async findOneByEmailWithVerificationCode(email: string): Promise<User> {
    try {
      this.logger.log(`Buscando usuario por email con código de verificación: ${email}`);

      const user = await this.usersRepository
        .createQueryBuilder('user')
        .addSelect('user.verification_code_hash')
        .where('LOWER(user.email) = LOWER(:email)', { email })
        .getOne();

      if (!user) {
        this.logger.warn(`Usuario no encontrado con email: ${email}`);
        throw new NotFoundException('El usuario con este email no existe');
      }

      return user;
    } catch (error) {
      this.logger.error(
        `Error buscando usuario por email con código de verificación: ${email} - ${error.message}`,
      );
      throw error;
    }
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

    // Filtrar por roles si se especifican
    if (roles.length > 0) {
      query = query
        .andWhere('user.roles && ARRAY[:...roles]')
        .setParameter('roles', roles);
    }

    // Filtrar por idioma asignado si se especifica
    if (assignedLanguageId) {
      query = query.andWhere('user.assignedLanguageId = :assignedLanguageId', {
        assignedLanguageId,
      });
    }

    // Filtrar por estado activo si se especifica
    if (typeof isActive === 'boolean') {
      query = query.andWhere('user.isActive = :isActive', { isActive });
    }

    // Si el usuario que hace la petición es admin con idioma asignado, filtrar profesores
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
        // Para admins con idioma asignado buscando profesores:
        // Mostrar profesores SIN idioma asignado (para poder asignarles su idioma)
        // Y TAMBIÉN mostrar profesores de su mismo idioma (para gestionar contenido)
        query = query.andWhere(
          '(assignedLanguages.id IS NULL AND user.assignedLanguageId IS NULL) OR (assignedLanguages.id = :adminLanguageId OR user.assignedLanguageId = :adminLanguageId)',
          { adminLanguageId: requestingUser.assignedLanguageId },
        );
      }
    }

    // Filtrar por búsqueda si se especifica
    if (search && search.trim()) {
      query = query.andWhere(
        '(LOWER(user.fullName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search: `%${search.trim()}%` },
      );
    }

    // Ordenar por nombre completo
    query = query.orderBy('user.fullName', 'ASC');

    // Obtener el total de registros
    const total = await query.getCount();

    // Aplicar paginación
    const offset = (page - 1) * limit;
    query = query.skip(offset).take(limit);

    // Debug logging
    console.log('[DEBUG] Final query SQL:', query.getSql());
    console.log('[DEBUG] Query parameters:', query.getParameters());

    // Obtener los usuarios
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

    // Calcular metadatos de paginación
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
      this.logger.log(`Buscando usuario por email: ${email}`);
      const user = await this.usersRepository.findOneByOrFail({ email });
      this.logger.log(
        `Usuario encontrado por email: ${email} (ID: ${user.id})`,
      );
      return user;
    } catch (error) {
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
    } catch (error) {
      this.logger.warn(`Usuario no encontrado con ID: ${id}`);
      throw new NotFoundException(`${id} no encontrado`);
    }
  }

  async block(id: string, adminUser: User): Promise<User> {
    this.logger.log(
      `Intentando bloquear/desbloquear usuario ${id} por admin ${adminUser.fullName}`,
    );

    const userToBlock = await this.findOneById(id);

    // Verificar que el admin puede bloquear/desbloquear este usuario
    if (!this.canManageUser(adminUser, userToBlock)) {
      throw new BadRequestException(
        'No tienes permisos para bloquear/desbloquear este usuario',
      );
    }

    // No permitir que un usuario se bloquee a sí mismo
    if (userToBlock.id === adminUser.id) {
      throw new BadRequestException(
        'No puedes bloquear/desbloquear tu propia cuenta',
      );
    }

    // Alternar el estado activo
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

    // Verificar que el admin puede cambiar los roles del usuario objetivo
    if (!this.canManageUser(adminUser, userToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para cambiar los roles de este usuario',
      );
    }

    // Verificar que el admin puede asignar los roles solicitados
    if (!this.canAssignRoles(adminUser, roles)) {
      throw new BadRequestException(
        'No tienes permisos para asignar uno o más de estos roles',
      );
    }

    // Cargar las relaciones del usuario para poder modificar assignedLanguages
    const userWithLanguages = await this.usersRepository.findOne({
      where: { id: userToUpdate.id },
      relations: ['assignedLanguages'],
    });

    if (!userWithLanguages) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Determinar el rol más alto que tendrá el usuario después del cambio
    const newHighestRole = this.getHighestRole(roles);

    // Solo los roles admin, docente y superUser pueden tener idiomas asignados
    const rolesWithLanguages = [
      ValidRoles.admin,
      ValidRoles.docente,
      ValidRoles.superUser,
    ];

    if (!rolesWithLanguages.includes(newHighestRole)) {
      // Si el nuevo rol no permite idiomas, quitar todos los idiomas asignados
      this.logger.log(
        `Removiendo idiomas asignados de ${userToUpdate.email} debido a cambio de rol a ${newHighestRole}`,
      );

      userWithLanguages.assignedLanguages = [];
      userWithLanguages.assignedLanguageId = undefined;
      await this.usersRepository.save(userWithLanguages);
    } else {
      // Lógica especial: Si un admin con idioma asignado convierte a un usuario en maestro,
      // asignar automáticamente el idioma del admin usando la tabla de múltiples idiomas
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

        // Buscar el idioma del admin
        const adminLanguage = await this.usersRepository.manager
          .getRepository(Lenguage)
          .findOne({
            where: { id: adminUser.assignedLanguageId, isActive: true },
          });

        if (adminLanguage) {
          // Asignar el idioma del admin al nuevo maestro usando la tabla de múltiples idiomas
          userWithLanguages.assignedLanguages = [adminLanguage];
          userWithLanguages.assignedLanguageId = adminUser.assignedLanguageId; // Mantener compatibilidad
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

    // Verificar que el admin puede editar este usuario
    if (!this.canManageUser(adminUser, userToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para editar este usuario',
      );
    }

    // Validar email único si se proporciona
    if (email && email.trim()) {
      const emailToCheck = email.trim().toLowerCase();

      // Solo validar si el email es diferente al actual
      if (emailToCheck !== userToUpdate.email.toLowerCase()) {
        const existingUser = await this.usersRepository.findOne({
          where: { email: emailToCheck },
        });

        if (existingUser) {
          throw new BadRequestException(
            'Ya existe un usuario con este email',
          );
        }

        userToUpdate.email = emailToCheck;
      }
    }

    // Actualizar nombre si se proporciona
    if (fullName && fullName.trim()) {
      userToUpdate.fullName = fullName.trim();
    }

    // Actualizar contraseña si se proporciona
    if (password && password.trim()) {
      userToUpdate.password = bcrypt.hashSync(password, 10);
    }

    // Actualizar estado activo si se proporciona
    if (isActive !== undefined) {
      userToUpdate.isActive = isActive;
    }

    // Registrar quién hizo la actualización
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

    // Verificar que el usuario que hace el cambio es superUser
    if (!superUser.roles.includes(ValidRoles.superUser)) {
      throw new BadRequestException(
        'Solo los superAdministradores pueden cambiar contraseñas de usuarios',
      );
    }

    const userToUpdate = await this.findOneById(userId);

    // Hashear la nueva contraseña
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

    // Verificar que el admin puede gestionar este usuario
    if (!this.canManageUser(adminUser, userToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para gestionar este usuario',
      );
    }

    // Solo SuperUsers pueden asignar idiomas a admins
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

    // Verificar que el admin puede gestionar este usuario
    if (!this.canManageUser(adminUser, userToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para gestionar este usuario',
      );
    }

    // Solo SuperUsers pueden asignar idiomas múltiples
    const adminHighestRole = this.getHighestRole(adminUser.roles);
    if (adminHighestRole !== ValidRoles.superUser) {
      throw new BadRequestException(
        'Solo los Super Administradores pueden asignar idiomas a usuarios',
      );
    }

    // Si no se proporcionan idiomas, limpiar la asignación
    if (!languageIds || languageIds.length === 0) {
      userToUpdate.assignedLanguages = [];
    } else {
      // Buscar los idiomas por ID
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

    // Verificar que el usuario que hace la petición es admin con idioma asignado
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

    // Verificar que es un maestro
    if (!teacherToUpdate.roles.includes(ValidRoles.docente)) {
      throw new BadRequestException('El usuario debe ser un maestro');
    }

    // Verificar que el maestro no tiene idioma asignado
    const hasLanguage =
      (teacherToUpdate.assignedLanguages &&
        teacherToUpdate.assignedLanguages.length > 0) ||
      teacherToUpdate.assignedLanguageId;

    if (hasLanguage) {
      throw new BadRequestException(
        'Este maestro ya tiene un idioma asignado. Solo se puede asignar idioma a maestros sin idioma asignado.',
      );
    }

    // Verificar que el admin puede gestionar este usuario
    if (!this.canManageUser(adminUser, teacherToUpdate)) {
      throw new BadRequestException(
        'No tienes permisos para gestionar este usuario',
      );
    }

    // Buscar el idioma del admin
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

    // Asignar el idioma del admin al maestro
    teacherToUpdate.assignedLanguages = [adminLanguage];
    teacherToUpdate.assignedLanguageId = adminUser.assignedLanguageId; // Mantener compatibilidad
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

    // SuperUser puede gestionar cualquier usuario, incluyendo otros superUsers
    if (adminHighestRole === 'superUser') {
      return true;
    }

    // Para otros roles, solo pueden gestionar usuarios con nivel menor
    return adminLevel > targetLevel;
  }

  private canAssignRoles(
    adminUser: User,
    rolesToAssign: ValidRoles[],
  ): boolean {
    const adminHighestRole = this.getHighestRole(adminUser.roles);

    // Verificar que puede asignar todos los roles solicitados
    for (const role of rolesToAssign) {
      // superUser puede asignar: superUser, admin, docente, alumno, mortal
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

      // admin puede asignar: docente, alumno, mortal
      if (adminHighestRole === ValidRoles.admin) {
        if (
          role === ValidRoles.docente ||
          role === ValidRoles.alumno ||
          role === ValidRoles.mortal
        ) {
          continue;
        }
      }

      // docente puede asignar: alumno, mortal
      if (adminHighestRole === ValidRoles.docente) {
        if (role === ValidRoles.alumno || role === ValidRoles.mortal) {
          continue;
        }
      }

      // Si llega aquí, no puede asignar este rol
      return false;
    }

    return true;
  }

  async deleteUser(id: string, superUser: User): Promise<User> {
    try {
      this.logger.log(`SuperUser ${superUser.email} attempting to delete user with ID: ${id}`);

      // Verificar que el usuario que ejecuta la acción sea superUser
      if (!superUser.roles.includes(ValidRoles.superUser)) {
        throw new BadRequestException('Solo los superUsuarios pueden eliminar usuarios');
      }

      // Buscar el usuario a eliminar
      const userToDelete = await this.usersRepository.findOne({
        where: { id, isActive: true },
        relations: ['assignedLanguage', 'assignedLanguages']
      });

      if (!userToDelete) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Verificar que no se esté intentando eliminar a sí mismo
      if (userToDelete.id === superUser.id) {
        throw new BadRequestException('No puedes eliminarte a ti mismo');
      }

      // Verificar que no se esté intentando eliminar a otro superUser
      if (userToDelete.roles.includes(ValidRoles.superUser)) {
        throw new BadRequestException('No se puede eliminar a otro superUsuario');
      }

      // Guardar una copia del usuario antes de eliminarlo
      const deletedUserData = { ...userToDelete };

      // Eliminar el usuario de la base de datos
      await this.usersRepository.remove(userToDelete);

      this.logger.log(`Usuario ${deletedUserData.email} (ID: ${id}) eliminado exitosamente por ${superUser.email}`);

      return deletedUserData;
    } catch (error) {
      this.logger.error(`Error eliminando usuario con ID: ${id} - ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
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

  private handleDBError(error: any): never {
    if (error.code === '23505') {
      throw new BadRequestException('Este correo ya esta en uso');
    }
    if (error.code === 'error-01') {
      throw new BadRequestException(error.detail);
    }
    this.logger.error(error);
    throw new InternalServerErrorException('Favor de checar los logs');
  }
}
