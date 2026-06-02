import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin dynamically to avoid requiring credentials files on startup
let messagingModule: any = null;
try {
  if (process.env.FIREBASE_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    messagingModule = admin.messaging();
    console.log("[FIREBASE-ADMIN] Inicializado correctamente para notificaciones push.");
  } else if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    messagingModule = admin.messaging();
    console.log("[FIREBASE-ADMIN] Inicializado con projectId.");
  }
} catch (adminErr) {
  console.warn("FCM Server Admin SDK initialisation skipped/limited (simulation fallback enabled):", adminErr);
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini Client to avoid crashing if API key is missing during container build/startup
let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY_FOR_STARTUP",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API endpoint to send maintenance push notifications
app.post("/api/send-push-notification", async (req, res) => {
  const { fcmToken, title, body } = req.body;

  if (!fcmToken || !title || !body) {
    return res.status(400).json({ error: "Faltan datos obligatorios (fcmToken, title, body)" });
  }

  // Beautiful simulation terminal output
  console.log("\n" + "=".repeat(60));
  console.log(`📱 [SIMVA NOTIFICACIÓN PUSH ENVIADA]`);
  console.log(`Token:      ${fcmToken}`);
  console.log(`Título:     ${title}`);
  console.log(`Mensaje:    ${body}`);
  console.log("=".repeat(60) + "\n");

  if (messagingModule) {
    try {
      const message = {
        notification: {
          title,
          body,
        },
        token: fcmToken,
      };
      const response = await messagingModule.send(message);
      return res.json({
        success: true,
        method: "fcm",
        messageId: response,
        message: "Notificación Push enviada satisfactoriamente con FCM admin."
      });
    } catch (err: any) {
      console.error("[FCM SERVER ERROR] Failed to send via FCM:", err.message);
    }
  }

  return res.json({
    success: true,
    method: "simulation",
    message: `Notificación Push Simulada enviada al token: ${fcmToken.slice(0, 20)}...`
  });
});

// API Proxy endpoints for OpenStreetMap Map and Geocoding lookup to bypass Vercel Blocks/Rate Limits
app.get("/api/geocode", async (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.status(400).json({ error: "Missing address query parameter 'q'" });
  }

  // List of public high-availability Nominatim geocoding instances
  const nominatimSecUrls = [
    "https://nominatim.openstreetmap.org/search",
    "https://nominatim.openstreetmap.fr/search",
    "https://nominatim.qgis.org/search"
  ];

  let searchQuery = String(q).trim();
  // If the search term is a 5-digit Spanish postcode, append España to assist geocoding reliability
  if (/^\d{5}$/.test(searchQuery)) {
    searchQuery = `${searchQuery}, España`;
  }

  let lastError = null;

  for (const baseUrl of nominatimSecUrls) {
    try {
      console.log(`[GEOCODE PROXY] Intentando geolocalizar con ${baseUrl} para la consulta: "${searchQuery}"`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout per mirror

      const response = await fetch(
        `${baseUrl}?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=es`,
        {
          headers: {
            "User-Agent": "SimvaMaintenanceApp/1.0 (espe.freelancer@gmail.com)",
            "Accept-Language": "es"
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // Even if empty, it is an official response from a running endpoint. Let's return it.
        return res.json(data);
      } else {
        console.warn(`[GEOCODE PROXY] El servidor ${baseUrl} retornó código de estado: ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`[GEOCODE PROXY] Error o tiempo de espera agotado con ${baseUrl}:`, err.message);
      lastError = err;
    }
  }

  return res.status(502).json({
    error: "Todos los servidores públicos de geocodificación Nominatim fallaron o superaron el límite de tiempo.",
    detail: lastError?.message
  });
});

app.post("/api/overpass", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing overpass query text" });
  }

  const overpassUrls = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter"
  ];

  let lastError = null;
  for (const url of overpassUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

      const targetUrl = `${url}?data=${encodeURIComponent(query)}`;
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "SimvaMaintenanceApp/1.0 (espe.freelancer@gmail.com)"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      } else {
        console.warn(`[OVERPASS SERVER PROXY] Servidor ${url} retornó un error: ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`[OVERPASS SERVER PROXY] Expiró o falló la conexión con ${url}:`, err.message);
      lastError = err;
    }
  }

  return res.status(502).json({
    error: "Todos los servidores Overpass OSM fallaron o expiraron temporariamente.",
    detail: lastError?.message
  });
});

// API endpoint to fetch maintenance plan
app.post("/api/maintenance-plan", async (req, res) => {
  const { makeModel, fuelType, year, vehicleType, vin } = req.body;

  if (!makeModel || !fuelType || !year) {
    return res.status(400).json({ error: "Faltan datos obligatorios (modelo, combustible o año)" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // If the API key is not configured, we return a clear structured response using standard mock data
    // to keep the app functional / instruct the user on setup.
    console.log("No GEMINI_API_KEY found, falling back to industry defaults.");
    const fallbackPlan = getIndustryFallbackPlan(fuelType, vehicleType);
    return res.json({
      plan: fallbackPlan,
      isFallback: true,
      message: "Se está mostrando el estándar de la industria ya que no se ha configurado la API Key de Gemini."
    });
  }

  try {
    const client = getAiClient();
    const isMoto = (vehicleType || "").toLowerCase() === "moto";
    const prompt = `Calcula el plan de mantenimiento de periodicidad preventivo oficial (o el más recomendado según los estándares del fabricante) para el siguiente vehículo de tipo ${isMoto ? "MOTO / MOTOCICLETA" : "COCHE / AUTOMÓVIL"}:
- Tipo de Vehículo: ${isMoto ? "Moto / Motocicleta" : "Coche / Automóvil"}
- Vehículo/Modelo: ${makeModel}
- Año: ${year}
- Tipo de Motor/Combustible: ${fuelType}
${vin ? `- Número identificador (VIN / Bastidor): ${vin}` : ""}

${vin ? `ATENCIÓN ESPECIAL DE EXHAUSTIVIDAD (CÓDIGO VIN PROPORCIONADO):
Se ha facilitado el número de bastidor (VIN): ${vin}. Como disponemos de este identificador, debes decodificar y analizar detalladamente el tipo de motorización (cilindrada, arquitectura, correa vs cadena, variantes de admisión, especificaciones de bujías correspondientes, fluidos de transmisión específicos, etc.). 
Por lo tanto, la lista de tareas de mantenimiento DEBE SER ALTAMENTE EXHAUSTIVA Y DETALLADA. 
- Debes incluir entre 10 y 15 tareas específicas (en lugar de las básicas estándar).
- Incorpora tareas pormenorizadas como: sustitución de correa de accesorios o distribución según especificaciones del código de motor, cambio de valvulina o fluido de la caja de cambios / diferencial, purga y renovación del líquido refrigerante específico, comprobación del desgaste de bobinas, reglaje o sensores de motor, filtros específicos de combustible según inyección, etc.` : "Si no se indica un VIN, devuelve una lista de las tareas de mantenimiento cíclicas preventivas básicas e intermedias estándar recomendadas (entre 5 y 10 tareas clave principales)."}

Si no encuentras el dato exacto o manual de taller de este modelo en tus fuentes, debes aplicar estrictamente los estándares de la industria para este tipo de vehículo (${isMoto ? "Moto" : "Coche"}) con motor (${fuelType}).

Tu respuesta debe ser un objeto JSON con el siguiente esquema: "plan" (el arreglo de objetos de tareas en español).`;

    let result: any = null;
    let attempt = 0;
    const maxRetries = 2;
    const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const model of models) {
      for (attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`[GEMINI-API] Intentando generar plan con modelo: ${model} (Intento ${attempt + 1}/${maxRetries})...`);
          const response = await client.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  plan: {
                    type: Type.ARRAY,
                    description: "Arreglo de tareas de mantenimiento ordenadas de menor a mayor kilometraje.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        tarea: {
                          type: Type.STRING,
                          description: "Nombre de la tarea de mantenimiento en español.",
                        },
                        cada_km: {
                          type: Type.INTEGER,
                          description: "Periodicidad en kilómetros. 0 si no aplica kilometraje.",
                        },
                        cada_meses: {
                          type: Type.INTEGER,
                          description: "Periodicidad en meses. 0 si no aplica tiempo.",
                        },
                      },
                      required: ["tarea", "cada_km", "cada_meses"],
                    },
                  }
                },
                required: ["plan"],
              },
            },
          });

          const text = response.text;
          if (text) {
            result = JSON.parse(text.trim());
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[GEMINI-API] Advertencia: Intento fallido con ${model} (${attempt + 1}/${maxRetries}): ${err.message || err}`);
          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      if (result) break;
    }

    if (!result) {
      throw lastError || new Error("No se obtuvo respuesta de ningún modelo de IA.");
    }

    const plan = result.plan || [];
    return res.json({ plan, isFallback: false });
  } catch (error: any) {
    console.warn("[GEMINI-API] Servicio temporalmente saturado o no disponible. Iniciando recuperación pasiva con plan por defecto. Mensaje:", error.message || error);
    // Safe standard fallback based on fuel type and brand
    const fallbackPlan = getIndustryFallbackPlan(fuelType, vehicleType);
    return res.status(200).json({
      plan: fallbackPlan,
      isFallback: true,
      error: error.message || "Error al conectar con Gemini",
      message: "Se empleó el plan estándar de la industria debido a un problema con el servicio de IA."
    });
  }
});

// Helper function to return high quality fallback plans (standard of the industry)
function getIndustryFallbackPlan(fuelType: string, vehicleType?: string) {
  const isMoto = (vehicleType || "").toLowerCase() === "moto";

  if (isMoto) {
    const commonMoto = [
      { tarea: "Limpieza, tensión y engrase de cadena", cada_km: 1000, cada_meses: 3 },
      { tarea: "Revisión de líquido de frenos trasero y delantero", cada_km: 10000, cada_meses: 12 },
      { tarea: "Revisión de pastillas de freno y desgaste", cada_km: 5000, cada_meses: 6 },
      { tarea: "Inspección de presión y estado de neumáticos", cada_km: 2000, cada_meses: 3 }
    ];

    if ((fuelType || "").toLowerCase().includes("eléctric")) {
      return [
        { tarea: "Revisión del motor eléctrico de arrastre", cada_km: 10000, cada_meses: 12 },
        { tarea: "Inspección de cables de alta tensión y batería", cada_km: 15000, cada_meses: 12 },
        ...commonMoto.slice(1) // No chain engrase usually if hub-motor, but keep brakes/tyres
      ];
    } else {
      return [
        { tarea: "Cambio de aceite de motor y filtro", cada_km: 5000, cada_meses: 12 },
        { tarea: "Limpieza y engrase de cadena de transmisión", cada_km: 1000, cada_meses: 3 },
        { tarea: "Reemplazo de bujía de encendido", cada_km: 12000, cada_meses: 24 },
        { tarea: "Limpieza o cambio de filtro de aire", cada_km: 10000, cada_meses: 12 },
        { tarea: "Inspección de pastillas de freno y neumáticos", cada_km: 5000, cada_meses: 6 },
        { tarea: "Cambio de líquido de frenos", cada_km: 20000, cada_meses: 24 }
      ];
    }
  }

  // Car Fallbacks
  const common = [
    { tarea: "Cambio de líquido de frenos", cada_km: 60000, cada_meses: 24 },
    { tarea: "Revisión de pastillas y discos de freno", cada_km: 30000, cada_meses: 12 },
    { tarea: "Cambio de filtro del habitáculo (antipolen)", cada_km: 15000, cada_meses: 12 },
    { tarea: "Revisión general de seguridad y niveles", cada_km: 15000, cada_meses: 12 }
  ];

  const typeLower = (fuelType || "").toLowerCase();

  if (typeLower.includes("electric") || typeLower.includes("eléctric")) {
    return [
      { tarea: "Rotación y estado de neumáticos", cada_km: 10000, cada_meses: 12 },
      { tarea: "Filtro de aire del habitáculo (A/C)", cada_km: 20000, cada_meses: 12 },
      ...common.slice(0, 2), // brakes are important for EVs too but less wear
      { tarea: "Test de diagnóstico de salud de batería", cada_km: 30000, cada_meses: 24 },
      { tarea: "Revisión de líquido refrigerante de batería", cada_km: 100000, cada_meses: 60 }
    ];
  } else if (typeLower.includes("diesel") || typeLower.includes("diésel")) {
    return [
      { tarea: "Aceite de motor sintético y filtro", cada_km: 15000, cada_meses: 12 },
      { tarea: "Filtro de combustible (diésel)", cada_km: 30000, cada_meses: 24 },
      { tarea: "Filtro de aire de motor", cada_km: 30000, cada_meses: 24 },
      ...common,
      { tarea: "Revisión de la correa de distribución", cada_km: 120000, cada_meses: 72 }
    ];
  } else if (typeLower.includes("hibrid") || typeLower.includes("híbrid")) {
    return [
      { tarea: "Aceite de motor sintético de baja viscosidad", cada_km: 15000, cada_meses: 12 },
      { tarea: "Filtro de aire de motor", cada_km: 30000, cada_meses: 24 },
      ...common,
      { tarea: "Limpieza del filtro de refrigeración de batería híbrida", cada_km: 30000, cada_meses: 24 },
      { tarea: "Cambio de bujías de encendido", cada_km: 90000, cada_meses: 72 }
    ];
  } else {
    // Gasolina or standard default
    return [
      { tarea: "Aceite de motor sintético y filtro", cada_km: 15000, cada_meses: 12 },
      { tarea: "Filtro de aire de motor", cada_km: 30000, cada_meses: 24 },
      ...common,
      { tarea: "Cambio de bujías de encendido", cada_km: 60000, cada_meses: 48 },
      { tarea: "Cambio de correa de distribución (si aplica)", cada_km: 100000, cada_meses: 72 }
    ];
  }
}

// Vite and static serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted (development mode).");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static assets from dist (production mode).");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
