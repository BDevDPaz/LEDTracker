# LED Tracker (v2.1 - Gold Master) 🛡️📍

![Version](https://img.shields.io/badge/version-2.1-gold?style=flat-square)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-54-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript)
![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?style=flat-square&logo=android)
![License](https://img.shields.io/badge/License-Private-red?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen?style=flat-square)
![Status](https://img.shields.io/badge/Status-Production%20Stable-success?style=flat-square)

**Sistema profesional de rastreo de horas laborales y geolocalización** para Android, diseñado con estándares de auditoría forense, resiliencia y precisión financiera.

---

## 📋 Descripción General

**LED Tracker** es una plataforma **local-first** de gestión de jornadas en campo, optimizada para entornos de alta exigencia. Combina geofencing inteligente, cálculo automático de nómina y un robusto sistema de auditoría que registra todas las operaciones críticas.

## 🏛️ Arquitectura del Sistema

### 1. Capa de Datos (Persistence Layer)
- **Motor:** Expo SQLite con modo **WAL** (Write-Ahead Logging) para concurrencia segura.
- **Integridad:** Prevención de solapamiento de sesiones (`checkSessionOverlap`) y trazabilidad completa de modificaciones.
- **Auditoría:** Sistema centralizado `logger.ts` con clasificación por severidad (🔴 🟡 🟢 🔵).

### 2. Capa de Servicios y Background (Intelligent Core)
- **LocationManager:** Geofencing configurable con Auto Check-in/out.
- **Background Tasks:** Ejecución *fail-safe* mediante `expo-task-manager`.
- **Notificaciones:** Sistema inteligente con `expo-notifications`.

### 3. Capa de Lógica de Negocio (Business Layer)
- **Motor Financiero (`payrollUtils`):** Cálculo preciso de horas regulares, extras y deducción automática de almuerzo.
- **Utilidades:** `geoUtils`, `dateUtils`, `i18n` y soporte multi-sitio.

### 4. Capa de Presentación (UI/UX)
- **Stack:** Expo Router + React Native + Reanimated + LuxuryUI.
- **Características:** Modales adaptativos y flujos administrativos protegidos.

## 🛠️ Stack Tecnológico

- **Framework:** Expo SDK 54
- **Lenguaje:** TypeScript (Strict Mode)
- **Base de Datos:** Expo SQLite (WAL)
- **Geolocalización:** `expo-location` + `expo-task-manager`
- **Testing:** Jest + Testing Library

## 📂 Estructura del Proyecto

```bash
.
├── app/                    # Rutas con Expo Router
├── src/
│   ├── components/
│   ├── context/
│   ├── database/
│   ├── services/
│   ├── utils/
│   └── types/
└── assets/

```
## 🚀 Instalación y Desarrollo
```bash
# Instalar dependencias
npm install --legacy-peer-deps

# Iniciar desarrollo
npx expo start -c

# Verificar tipos
npm run typecheck

# Ejecutar pruebas
npm run test

```
## 🧪 Testing y Calidad
 * **Pruebas unitarias:** 14 tests en payrollUtils (todos pasando).
 * **Type checking:** Limpio (tsc --noEmit).
 * **Auditoría:** Logging completo en operaciones críticas.
## 🔐 Sistema de Auditoría y Logging
 * **🔴 Rojo:** Errores críticos.
 * **🟡 Amarillo:** Advertencias.
 * **🟢 Verde:** Operaciones exitosas.
 * **🔵 Azul:** Eventos de sistema.
## ⚠️ Deuda Técnica y Observaciones
Para mantener la transparencia sobre el estado actual del desarrollo, documentamos los siguientes puntos que requieren atención futura:
 * **Gestión de File Watchers (Termux):** Debido a las limitaciones de inotify en entornos Termux, se ha configurado un límite extendido de observadores. Si el proyecto escala significativamente, se recomienda evaluar herramientas de empaquetado más ligeras o migrar a un entorno de desarrollo con mayores recursos.
 * **Flexibilidad de Dependencias:** Se ha utilizado --legacy-peer-deps para gestionar la instalación de paquetes debido a conflictos de versiones con React 19. Es recomendable realizar una auditoría periódica de las dependencias (npm audit) para actualizar a versiones compatibles de forma nativa.
 * **Librería dayjs (En espera):** Se ha incluido dayjs como dependencia, pero aún no se ha integrado en la lógica de negocio. Se recomienda su uso para futuras refactorizaciones en el manejo de fechas complejas, reemplazando el Intl.DateTimeFormat nativo.
 * **Uso de Console Logs:** Aunque se ha implementado un estándar de auditoría mediante src/utils/logger.ts, aún existen logs nativos de desarrollo en componentes de terceros. Se planea una limpieza gradual en futuras iteraciones.
**Desarrollado por:** Byron De Paz
**Propiedad:** BDevDPaz
**Licencia:** Privada / Propietaria

