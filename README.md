<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# SIMVA — Vehicle Maintenance & Smart Monitoring App

SIMVA es una aplicación web diseñada para el control, seguimiento y gestión inteligente del mantenimiento de vehículos. Permite a los usuarios llevar un registro preciso del estado de su flota personal, anticiparse a revisiones mecánicas y almacenar la documentación técnica y legal de forma centralizada.

---

## 🛠️ Stack Tecnológico & Herramientas

* **Desarrollo Asistido por IA / No-Code:** Google AI Studio, Stitch.
* **Frontend / Lenguaje:** TypeScript, HTML5, CSS / UI Framework.
* **Backend & Servicios (BaaS):** Firebase (Authentication, Cloud Firestore, Cloud Storage).
* **Notificaciones:** Firebase Cloud Messaging (Service Worker).
* **Despliegue & Hosting:** Vercel.

---

## ✨ Características Principales

* **Alertas de Mantenimiento Inteligente:** Notificaciones y avisos de revisiones mecánicas basados en el kilometraje recorrido o en el tiempo transcurrido desde la última revisión.
* **Gestión Multivehículo:** Posibilidad de registrar, administrar y hacer seguimiento de más de un coche desde una sola cuenta.
* **Buscador de Talleres:** Localización de talleres mecánicos y centros de servicio según la ubicación del usuario.
* **Almacenamiento de Documentación:** Guardado de fotografías y archivos de los documentos del vehículo (ITV, seguro, ficha técnica, facturas) en la nube.
* **Autenticación Segura:** Registro e inicio de sesión simplificado a través de cuenta de Google (Gmail) e integración con Firebase Auth.
* **Panel de Ajustes:** Configuración personalizada de preferencias y notificaciones de la aplicación.

---

## 📁 Estructura del Proyecto

```text
SIMVA_OFICIAL/
├── public/
│   └── firebase-messaging-sw.js  # Service Worker para notificaciones push
├── src/                          # Código fuente de la interfaz y componentes
├── .env.example                  # Plantilla de variables de entorno
├── AGENTS.md                     # Definiciones y contexto de desarrollo asistido
├── firebase-applet-config.json   # Configuración del proyecto Firebase
├── firebase-blueprint.json       # Esquema y reglas de arquitectura
├── firestore.rules               # Reglas de seguridad de Cloud Firestore
├── security_spec.md              # Especificaciones de seguridad y accesos
├── index.ts                      # Punto de entrada de TypeScript
├── server.ts                     # Configuración del servidor de desarrollo/producción
└── package.json                  # Dependencias y scripts del proyecto

---

## Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/370d5bb6-3f41-4540-a872-2de3b20f2cd0

## Run Locally

**Prerequisites:**  Node.js
1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
