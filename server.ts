import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

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

// API endpoint to fetch maintenance plan
app.post("/api/maintenance-plan", async (req, res) => {
  const { makeModel, fuelType, year } = req.body;

  if (!makeModel || !fuelType || !year) {
    return res.status(400).json({ error: "Faltan datos obligatorios (modelo, combustible o año)" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // If the API key is not configured, we return a clear structured response using standard mock data
    // to keep the app functional / instruct the user on setup.
    console.log("No GEMINI_API_KEY found, falling back to industry defaults.");
    const fallbackPlan = getIndustryFallbackPlan(fuelType);
    return res.json({
      plan: fallbackPlan,
      isFallback: true,
      message: "Se está mostrando el estándar de la industria ya que no se ha configurado la API Key de Gemini."
    });
  }

  try {
    const client = getAiClient();
    const prompt = `Calcula el plan de mantenimiento de periodicidad preventivo oficial (o el más recomendado según los estándares del fabricante) para el siguiente vehículo:
- Vehículo/Modelo: ${makeModel}
- Año: ${year}
- Tipo de Motor/Combustible: ${fuelType}

Si no encuentras el dato exacto o manual de taller de este modelo de coche en tus fuentes, debes aplicar estrictamente los estándares de la industria automotriz para este tipo de motor (${fuelType}).

Devuelve una lista de las tareas de mantenimiento cíclicas preventivas básicas e intermedias recomendadas (por ejemplo: cambio de aceite y filtro de motor, cambio de filtro de aire, cambio de filtro de habitáculo, cambio de líquido de frenos, líquido refrigerante, revisión de pastillas de freno, cambio de bujías o calentadores si aplica, cambio de correa de distribución o accesorios si aplica).

Tu respuesta debe ser un arreglo de objetos JSON en español, donde cada objeto tenga exactamente estos campos:
- "tarea": Descripción muy corta y concisa en español de la tarea de mantenimiento (ej: "Cambio de aceite y filtro de motor", "Cambio de filtro de aire"). Máximo 50 caracteres.
- "cada_km": Kilometraje recomendado para realizar la tarea (número entero positivo, ej. 15000, 30000, 60000). Si la tarea solo depende de meses, usa 0.
- "cada_meses": Tiempo en meses recomendado para realizar la tarea (número entero positivo, ej. 12, 24, 48). Si la tarea solo depende de kilómetros, usa 0.

El arreglo de tareas debe contener de 5 a 10 tareas clave principales, ordenadas de menor a mayor periodicidad de kilómetros (y meses de forma secundaria). No mezcles tareas duplicadas.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
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
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No se recibió respuesta válida del modelo Gemini.");
    }

    const plan = JSON.parse(text.trim());
    return res.json({ plan, isFallback: false });
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    // Safe standard fallback based on fuel type
    const fallbackPlan = getIndustryFallbackPlan(fuelType);
    return res.status(200).json({
      plan: fallbackPlan,
      isFallback: true,
      error: error.message || "Error al conectar con Gemini",
      message: "Se empleó el plan estándar de la industria para este tipo de motor debido a un problema con el servicio de IA."
    });
  }
});

// Helper function to return high quality fallback plans (standard of the industry)
function getIndustryFallbackPlan(fuelType: string) {
  const common = [
    { tarea: "Cambio de líquido de frenos", cada_km: 60000, cada_meses: 24 },
    { tarea: "Revisión de pastillas y discos de freno", cada_km: 30000, cada_meses: 12 },
    { tarea: "Cambio de filtro del habitáculo (antipolen)", cada_km: 15000, cada_meses: 12 },
    { tarea: "Revisión general de seguridad y niveles", cada_km: 15000, cada_meses: 12 }
  ];

  const typeLower = fuelType.toLowerCase();

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

startServer();
