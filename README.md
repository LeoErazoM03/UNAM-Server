# UNAM Server – Monorepo Frontend + Backend

Monorepo que contiene:
- unam-frontend: aplicación web en Next.js (React) que consume GraphQL.
- UNAM-escuela-backend: API en NestJS con GraphQL sobre PostgreSQL.
- docker-compose.yml: orquestación de servicios (PostgreSQL, pgAdmin, backend, frontend, Nginx, Certbot).

Puertos por convención:
- Backend GraphQL: 3000
- Frontend: 3001

## Requisitos
- Docker y Docker Compose
- Node.js 20+
- npm (para el frontend)
- Yarn 1.x (para el backend)
- Nest CLI (global): `npm i -g @nestjs/cli`
- Git

## Configuración de entorno
1. Copia el archivo `.env.template` a `.env` en la raíz del repo:

```bash
cp .env.template .env
```

2. Ajusta variables según tu entorno (ejemplos):
- DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
- JWT_SECRET
- FRONTEND_APP_URL
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM

> Las variables definidas en `.env` son utilizadas por Docker Compose y los servicios.

## Levantar el proyecto (Docker Compose)
La forma más sencilla es levantar todo con Docker:

```bash
docker compose up --build -d
```

Servicios incluidos:
- db: PostgreSQL (expuesto en localhost:5432)
- pgadmin: UI de administración (localhost:5050)
- backend: NestJS GraphQL en `http://localhost:3000/graphql`
- frontend: Next.js en `http://localhost:3001`
- nginx: reverse proxy (puertos 80/443) para despliegues con TLS (Certbot)

Para ver logs:
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Para detener:
```bash
docker compose down
```

## Levantar en desarrollo local (sin contenedores para app)
Puedes usar Docker únicamente para la base de datos y ejecutar frontend/backend localmente.

1) Base de datos:
```bash
docker compose up -d db pgadmin
```

2) Backend (NestJS):
```bash
cd UNAM-escuela-backend
yarn
yarn start:dev
```
Arranca en `http://localhost:3000/graphql`.

3) Frontend (Next.js):
```bash
cd unam-frontend
npm install
npm run dev
```
Arranca en `http://localhost:3001`.

## Builds y verificación
- Frontend:
```bash
cd unam-frontend
npm run build
```

- Backend:
```bash
cd UNAM-escuela-backend
yarn build
```

Lint y tests (opcional durante el desarrollo):
```bash
# Frontend
cd unam-frontend
npm run lint

# Backend
cd UNAM-escuela-backend
yarn lint
yarn test
```

## Tecnologías clave
- Frontend: Next.js 15, React 19, TailwindCSS, shadcn/ui, Apollo Client, Zod, Sonner.
- Backend: NestJS 11, GraphQL (Apollo), TypeORM, PostgreSQL, Zod.
- Infraestructura: Docker Compose, Nginx (reverse proxy), Certbot (TLS).

## Convenciones del proyecto
- Backend expone solo GraphQL (prohibido usar backend de Next.js).
- Puertos fijos: frontend 3001 y backend 3000.
- Validaciones con Zod.
- El registro de usuarios requiere configurar SMTP para enviar correos de verificación y activar la cuenta antes del primer login.
- UI con componentes shadcn/ui, sin animaciones ni colores personalizados.
- Notificaciones con Sonner.
- Pide solo los campos necesarios del schema GraphQL.
- No instales dependencias en la raíz. Si requieres un proyecto para pruebas, colócalo fuera del raíz principal.
- Limpia scripts que ya no uses.

## Nginx y HTTPS (despliegue)
- El contenedor `nginx` actúa como reverse proxy para frontend/backend.
- Certbot gestiona certificados TLS (montajes en `nginx/certbot`).
- Configuración base en `nginx/default.conf`.

## Solución de problemas
- Puerto en uso: cierra procesos que usen 3000/3001 o ajusta puertos locales durante pruebas.
- DB no disponible: revisa `docker compose logs db` y credenciales en `.env`.
- Reconstrucción limpia:
```bash
docker compose down -v
docker compose up --build -d
```

## Estructura del repositorio (resumen)
- `unam-frontend/`: app Next.js
- `UNAM-escuela-backend/`: API NestJS GraphQL
- `nginx/`: configuración de Nginx y Certbot
- `docker-compose.yml`: orquestación de servicios
