# ITrack

Sistema web para la gestión y control de activos tecnológicos.

## Descripción

ITrack es un prototipo profesional de una plataforma corporativa para administrar equipos, dispositivos de red, usuarios, áreas y mantenimientos.

## Tecnologías

- Node.js
- Express
- HTML
- CSS
- Bootstrap

## Uso

1. Instala dependencias:

```bash
npm install
```

2. Inicia el servidor:

```bash
npm start
```

3. Abre `http://localhost:3000` en el navegador.

## Nota

La conexión con MongoDB se agrega mediante la variable `MONGODB_URI` en el archivo `.env`.

## Deployment y recuperación de contraseña

- Variables de entorno necesarias en producción (Render / Heroku / Vercel):
  - `MONGODB_URI`
  - `EMAIL_USER` (SMTP user)
  - `EMAIL_PASS` (SMTP password)
  - `SESSION_SECRET`

- Para ejecutar localmente:
```bash
npm install
copy .env.sample .env
# editar .env con tus valores
npm start
```

- Migración de emails (opcional): crea `emails.json` con el formato `{ "username": "email@dominio" }`, o copia `emails.sample.json`, y luego ejecuta:

```bash
npm run migrate-emails
```

- Si usas Render, crea un deploy preview o rama separada primero, y configura estas variables en el panel de Render:
  - `MONGODB_URI`
  - `EMAIL_USER`
  - `EMAIL_PASS`
  - `SESSION_SECRET`

Esto permite probar la función de recuperación de contraseña sin afectar el entorno de producción principal.

Esto actualizará el campo `email` de los usuarios en la colección `AuthUser` en tu base de datos.

**Seguridad:** las rutas de prueba y recuperación de contraseña verifican que `EMAIL_USER` y `EMAIL_PASS` estén configuradas y devolverán un error claro si faltan.
