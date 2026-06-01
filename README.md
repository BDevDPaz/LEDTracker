# W Tracker (v1.0 — Gold Master / PRO MAX)

![React Compiler](https://img.shields.io/badge/React-Compiler_Enabled-087ea4?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript)
![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?style=flat-square&logo=android)
![Lint](https://img.shields.io/badge/ESLint-0_Errors-success?style=flat-square&logo=eslint)
![Status](https://img.shields.io/badge/Status-Production%20Stable-success?style=flat-square)

Sistema profesional **local-first** para rastreo de horas laborales y geolocalización en Android, diseñado para operación en campo con foco en:

- **precisión financiera**
- **trazabilidad forense**
- **resiliencia ante asincronías del sistema operativo**
- **experiencia de usuario premium silenciosa**

---

## ✨ Qué es LED Tracker

LED Tracker permite configurar jornadas por destino, activar geocercas, registrar auto check-in / auto check-out por GPS, calcular horas y nómina, generar reporte semanal en PDF y mantener una auditoría persistente de las operaciones críticas.

El sistema fue construido para escenarios reales de trabajo en campo donde existen riesgos de:

- pérdida de sincronía entre UI y servicios nativos
- disparos concurrentes de tareas de fondo
- drift temporal / timezone leaks
- errores de usuario al editar sesiones
- necesidad de evidencia trazable de cada acción importante

---

## 🧠 Principios de diseño

### 1. Local-first
Toda la operación crítica vive localmente sobre SQLite, permitiendo funcionamiento robusto incluso sin conectividad continua.

### 2. Auditoría forense
Toda operación sensible deja huella en `system_logs` y/o `audit_logs`.

### 3. Resiliencia operativa
La app tolera:

- reinicios de UI
- eventos duplicados del scheduler
- reentradas del sistema operativo
- asincronías de geofence

### 4. UX premium silenciosa
El logger alimenta feedback UI automático solo cuando realmente importa:

- éxito importante → toast
- warning real → toast discreto
- error crítico → diálogo bloqueante
- eventos internos / background / debug → silencio

---

## 🏛️ Arquitectura del sistema

## 1) Capa de Datos (Persistence Layer)

- **Motor:** Expo SQLite
- **Modo:** WAL (Write-Ahead Logging)
- **PRAGMAs:** `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`
- **Objetivo:** consistencia, concurrencia segura y persistencia robusta

### Tablas principales
- `work_sessions`
- `settings`
- `audit_logs`
- `system_logs`

### Capacidades clave
- inicialización segura de DB
- cola de logs antes de que la DB esté lista
- helpers tipados para CRUD y estadísticas semanales
- validación de solapamiento de sesiones

---

## 2) Capa de Servicios y Background

### LocationManager
Responsable de:

- permisos foreground / background
- activación de geocerca
- auto check-in al entrar
- detección de salida del área
- integración con notificaciones del sistema

### BackgroundTasks
Responsable de:

- failsafe de auto check-out por inactividad
- ejecución segura con mutex
- generación de reporte semanal
- notificaciones reactivas del sistema

### Notifications
Responsable de:

- canal Android por defecto
- recordatorio diario configurable
- disparo de notificaciones operativas

---

## 3) Capa de Lógica de Negocio

### Motor temporal
- `dayjs` con configuración centralizada
- normalización de timestamps
- coherencia de zona horaria
- protección contra fugas temporales entre capas

### Motor financiero
- cálculo de duración real de sesión
- soporte de overtime
- deducción de almuerzo
- estimación diaria y semanal

### Utilidades críticas
- `dateUtils`
- `geoUtils`
- `payrollUtils`
- `logger`
- `i18n`

---

## 4) Capa de Presentación

### Stack
- Expo Router
- React Native
- React Compiler
- Reanimated
- LuxuryUI

### Características visuales
- estética dark / glass
- modales custom
- toasts premium
- flujo administrativo protegido
- tarjetas activas y estados visuales de operación

---

## 🔔 Sistema de feedback UX (PRO MAX)

LED Tracker integra un sistema desacoplado de observabilidad → UX:

```text
logger → logBridge → LuxuryUIContext → feedback visual
```

### Reglas activas
- `DEBUG` y categorías internas: silenciosas
- `WARN` relevante: feedback discreto
- `ERROR_CRITICO`: diálogo bloqueante
- éxitos operativos importantes: toast

### Capacidades PRO MAX
- deduplicación temporal
- cola de toasts
- un solo toast visible a la vez
- throttling por `dedupeKey`
- prevención de spam visual

---

## 🛠️ Stack tecnológico

- **Framework:** Expo SDK 54
- **Core:** React 19 + React Compiler
- **Lenguaje:** TypeScript (strict)
- **Base de datos:** Expo SQLite
- **Geolocalización:** `expo-location` + `expo-task-manager`
- **Background:** `expo-background-task`
- **Fechas:** Day.js
- **Animación:** Reanimated
- **Notificaciones:** `expo-notifications`
- **Testing:** Jest + Testing Library
- **Lint:** ESLint

---

## 📂 Estructura del proyecto

```bash
.
├── README.md
├── app
│   ├── _layout.tsx
│   └── (tabs)
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── history.tsx
│       ├── report.tsx
│       └── settings.tsx
├── assets
│   └── images
├── scripts
│   └── audit
│       ├── audits
│       ├── core
│       ├── gold-master.ts
│       └── reports
├── src
│   ├── components
│   ├── constants
│   ├── context
│   ├── database
│   ├── feedback
│   ├── services
│   ├── types
│   └── utils
├── app.json
├── babel.config.js
├── eas.json
├── eslint.config.js
├── jest.config.js
├── metro.config.js
├── package.json
└── tsconfig.json
```

---

## 📁 Estructura funcional destacada

### `src/database/`
Persistencia, inicialización, helpers CRUD y estadísticas.

### `src/services/`
Geofence, background, notificaciones, reportes.

### `src/feedback/`
Bridge de logs hacia UX con reglas de deduplicación y anti-spam.

### `src/context/`
Providers globales (idioma, LuxuryUI).

### `src/utils/`
Motor temporal, logger, cálculos de nómina, i18n y utilidades base.

### `scripts/audit/`
Pipeline de auditoría Gold Master y validaciones estructurales.

---

## 🚀 Instalación

```bash
npm install --legacy-peer-deps
```

> Se usa `--legacy-peer-deps` por compatibilidad entre Expo / React 19 / dependencias de testing del proyecto actual.

---

## 🧪 Desarrollo

### Iniciar Metro
```bash
npx expo start -c
```

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

### Web
```bash
npm run web
```

---

## ✅ Calidad y validación

### Type checking
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

### Tests
```bash
npm run test
```

### Gold Master
```bash
npm run audit:gm
```

### Pipeline completo
```bash
npm run gm
```

---

## 📜 Scripts principales

```json
{
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "lint": "expo lint",
  "test": "jest --no-watchman",
  "typecheck": "tsc --noEmit",
  "audit:gm": "tsx scripts/audit/gold-master.ts",
  "gm": "npm run typecheck && npm run lint && npm run test && npm run audit:gm"
}
```

---

## 📊 Estado de calidad actual

Estado esperado del proyecto:

- TypeScript limpio
- ESLint limpio
- suite de tests pasando
- auditoría Gold Master aprobada

Cobertura funcional validada en utilidades críticas:

- `payrollUtils`
- `dateUtils`
- `geoUtils`

---

## 🧾 Sistema de auditoría y logging

El logger registra en consola + `system_logs` y mantiene cola temporal antes de que la DB esté disponible.

### Colores / intención forense
- 🔴 errores críticos
- 🟡 advertencias
- 🟠 eventos especiales
- 🔵 estado del sistema
- ⚪ trazas / sin cambios
- 🟢 operación exitosa

### Categorías típicas
- `OPERACION_EXITOSA`
- `ERROR_CRITICO`
- `ADVERTENCIA`
- `CONFIG_MODIFICADA`
- `ACCION_DESTRUCTIVA`
- `SERVICIOS_ACTIVOS`
- `ESTADO_SISTEMA`
- `BACKGROUND_TASK`

---

## 📍 Flujo principal de operación

### Iniciar jornada
1. usuario abre modal de destino
2. se geocodifica la dirección
3. se crea sesión `pending_arrival`
4. se activa geocerca
5. al entrar al área se realiza auto check-in

### Salir del área
1. geocerca detecta salida
2. se registra timestamp de salida
3. se muestra decisión al usuario o se espera failsafe
4. si no hay retorno, background ejecuta auto check-out

### Cerrar jornada manualmente
1. usuario termina jornada
2. si falta almuerzo, se solicita confirmación
3. se actualiza sesión
4. se detiene monitoreo
5. se registra auditoría

---

## 📄 Reportes

El proyecto soporta generación de reporte semanal con salida PDF y flujo de compartir / envío.

El reporte está pensado para consolidar:

- horas
- sesiones
- notas
- eventos relevantes de auditoría

---

## 🌐 Internacionalización

Idiomas soportados:

- Español
- Inglés

La capa `i18n` cubre textos clave de:

- Home
- historial
- configuración
- alertas y toasts
- reporte

---

## 🔐 Seguridad y control operativo

- zona administrativa protegida por contraseña
- configuración sensible separada del flujo general
- auditoría persistente de operaciones críticas
- eliminación lógica de registros (`deleted`) en lugar de borrado físico

---

## 🧱 Decisiones arquitectónicas importantes

### SQLite en modo WAL
Elegido para mejorar robustez y concurrencia.

### Mutex en background task
Evita ejecución simultánea no determinista del scheduler.

### dayjs centralizado
Reduce inconsistencias temporales entre DB, UI y reportes.

### Logger como fuente de verdad UX
La UI ya no depende de `showToast` dispersos; el sistema puede convertir logs relevantes en feedback visual consistente.

---

## ⚠️ Limitaciones conocidas / observaciones

- el entorno móvil puede requerir ajustes por límites de file watchers
- el stack actual depende de `--legacy-peer-deps`
- Android tiene comportamientos nativos variables en geofence / background según OEM
- el sistema de feedback UX está optimizado para silencio y relevancia, no para mostrar todos los eventos internos

---

## ✅ Checklist de salida recomendada

Antes de distribución o build de release:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run audit:gm`
- validación en dispositivo real
- validación de permisos GPS foreground/background
- validación de notificaciones
- validación de generación / compartir PDF
- validación de auto check-in / auto check-out

---

## 👨‍💻 Autor

**Byron De Paz**

Propiedad: **BDevDPaz**

---

## 📄 Licencia

**Privada / Propietaria**

Uso restringido. No redistribuir sin autorización del propietario.

---

## 🛡️ Estado del proyecto

**LED Tracker v2.2 — Gold Master / PRO MAX**

Proyecto validado para operación seria, con trazabilidad, UX desacoplada y base robusta para evolución futura.
