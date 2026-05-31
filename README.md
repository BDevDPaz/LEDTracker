# LED Tracker (v2.2 - Gold Master) 🛡️📍

![Version](https://img.shields.io/badge/version-2.2-gold?style=flat-square)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-54-blue?style=flat-square)
![React Compiler](https://img.shields.io/badge/React-Compiler_Enabled-087ea4?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript)
![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?style=flat-square&logo=android)
![Lint](https://img.shields.io/badge/ESLint-0_Errors-success?style=flat-square&logo=eslint)
![Tests](https://img.shields.io/badge/Tests-17_Passing-brightgreen?style=flat-square)
![Status](https://img.shields.io/badge/Status-Production%20Stable-success?style=flat-square)

**Sistema profesional de rastreo de horas laborales y geolocalización** para Android, diseñado con estándares de auditoría forense, resiliencia contra limitaciones de hardware y precisión financiera.

---

## 📋 Descripción General

**LED Tracker** es una plataforma **local-first** de gestión de jornadas en campo, optimizada para entornos de alta exigencia. Combina geofencing nativo de alto rendimiento, cálculo automático de nómina y un robusto sistema de auditoría que registra todas las operaciones críticas, garantizando inmutabilidad y precisión absoluta.

## 🏛️ Arquitectura del Sistema

### 1. Capa de Datos (Persistence Layer)
- **Motor:** Expo SQLite con modo **WAL** (Write-Ahead Logging) para concurrencia segura.
- **Integridad:** Prevención de solapamiento de sesiones (`checkSessionOverlap`) y trazabilidad completa de modificaciones.
- **Auditoría:** Sistema centralizado `logger.ts` con clasificación forense por severidad (🔴 🟡 🟢 🔵 ⚪️).

### 2. Capa de Servicios y Background (Intelligent Core)
- **LocationManager:** Geofencing automatizado con *GPS Warm-up* y patrón arquitectónico de sobrescritura (Overwrite) para neutralizar asincronías y *Race Conditions* del motor nativo de Android.
- **Control de Concurrencia:** Implementación de patrón **Mutex** en `BackgroundTasks` para proteger la base de datos contra ejecuciones concurrentes y no deterministas del *Scheduler* del Sistema Operativo.
- **Notificaciones:** Sistema inteligente y reactivo impulsado por `expo-notifications`.

### 3. Capa de Lógica de Negocio (Business Layer)
- **Motor Financiero (`payrollUtils`):** Cálculo algorítmico preciso de horas regulares, Overtime (OT) y deducción automática de almuerzo.
- **Motor de Fechas (Immutable Time Engine):** Integración centralizada estricta mediante `dayjsSetup` para garantizar coherencia absoluta de husos horarios y protección total contra *Timezone Leaks* en las capas de presentación.
- **Utilidades:** `geoUtils`, `dateUtils`, `i18n` y soporte multi-sitio.

### 4. Capa de Presentación (UI/UX)
- **Stack:** Expo Router + React Native + Reanimated + LuxuryUI.
- **Optimización:** Ciclo de vida y memorización gestionados por **React Compiler** bajo el capó.
- **Características:** Modales adaptativos, flujos administrativos protegidos y diseño estético *Glassmorphism* y *OLED Dark*.

## 🛠️ Stack Tecnológico

- **Framework:** Expo SDK 54
- **Core:** React 19 + React Compiler
- **Lenguaje:** TypeScript (Strict Mode)
- **Base de Datos:** Expo SQLite (WAL)
- **Geolocalización:** `expo-location` + `expo-task-manager`
- **Fechas y Tiempos:** Day.js (Timezone & UTC Plugins)
- **Testing:** Jest + Testing Library
- **Análisis Estático:** ESLint (Configuración híbrida estricta para React Compiler)

## 📂 Estructura del Proyecto

```bash
.
├── app/                    # Enrutamiento basado en archivos (Expo Router)
├── src/
│   ├── components/         # Sistema de diseño LuxuryUI y modales
│   ├── constants/          # Temas y variables globales
│   ├── context/            # Estado global (Language, LuxuryUI)
│   ├── database/           # Consultas SQLite y transacciones
│   ├── services/           # Background Tasks (Mutex), Geofencing, PDF Generator
│   ├── types/              # Definiciones de TypeScript e interfaces
│   └── utils/              # Immutable Time Engine (dayjsSetup), utilidades y Logger
└── assets/                 # Recursos gráficos y multimedia genéricos

```
## 🚀 Instalación y Desarrollo
```bash
# Instalar dependencias (resolución legacy por anclaje estricto de Expo a React 19)
npm install --legacy-peer-deps

# Iniciar entorno de desarrollo
npx expo start -c

# Análisis estático y validación de código limpio
npm run lint

# Verificación de tipado estricto
npx tsc --noEmit --project tsconfig.json

# Ejecutar suite de pruebas unitarias
npm run test

```
## 🧪 Testing y Calidad
 * **Pruebas unitarias:** Cobertura estable con 17/17 *tests* exitosos sobre utilidades críticas (payrollUtils, dateUtils, geoUtils).
 * **Type checking:** Limpio. 0 errores de TypeScript.
 * **Análisis estático:** Configuración híbrida de ESLint superada (0 errores, 0 advertencias, código muerto eliminado).
 * **Auditoría:** Logging completo, transaccional y persistente en operaciones de DB, concurrencia de SO y GPS.
## 🔐 Sistema de Auditoría y Logging
 * **🔴 Rojo:** Errores críticos (Fallas de base de datos, colapso de servicios).
 * **🟡 Amarillo:** Advertencias (Ediciones manuales de nómina, colisiones de horario).
 * **🟢 Verde:** Operaciones exitosas (Auto Check-in, reportes generados, transacciones completadas).
 * **🔵 Azul:** Eventos de estado del sistema (Inicialización de DB, registro de listeners).
 * **⚪️ Blanco:** Traza de depuración y bloqueos de concurrencia (Mutex locks).
## ⚠️ Observaciones y Evolución Continua
Para mantener la transparencia sobre la arquitectura y la escalabilidad del sistema, se documentan los siguientes vectores de optimización futura:
 * **Gestión de File Watchers (Entorno Móvil):** Debido a las limitaciones de inotify nativo en entornos de emulación y terminales móviles, el límite de observadores ha sido extendido. Si el proyecto escala masivamente en número de archivos, se evaluará la reconfiguración del entorno de compilación.
 * **Resolución Estricta de NPM:** Se requiere --legacy-peer-deps temporalmente para conciliar las dependencias de testing (react-test-renderer) con la versión fijada de React por el motor de Expo (Hermes/Fabric).
**Desarrollado por:** Byron De Paz
**Propiedad:** BDevDPaz
**Licencia:** Privada / Propietaria
