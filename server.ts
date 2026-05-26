import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

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

// API endpoint to send maintenance alert emails
app.post("/api/send-alert-email", async (req, res) => {
  const { userEmail, vehicleName, taskName, status, kmRemaining, currentKm } = req.body;

  if (!userEmail || !vehicleName || !taskName || !status) {
    return res.status(450).json({ error: "Faltan datos obligatorios para enviar el aviso por email" });
  }

  const isDanger = status === "danger";
  const statusLabel = isDanger ? "CRÍTICO (ROJO)" : "PREVENTIVO (ÁMBAR)";
  const statusColorHex = isDanger ? "#ef4444" : "#f59e0b";

  const emailHtml = `
    <div style="background-color: #0b0f19; color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
      <div style="text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #2ac1ff; font-size: 24px; margin: 0; text-transform: uppercase; letter-spacing: 2px;">SIMVA ALERTA</h1>
        <p style="color: #64748b; font-size: 11px; margin: 5px 0 0 0; text-transform: uppercase; font-family: monospace;">SISTEMA INTELIGENTE DE MANTENIMIENTO VEHICULAR AUTOMOTRIZ</p>
      </div>

      <div style="background-color: #111827; border-left: 4px solid ${statusColorHex}; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: ${statusColorHex}; margin: 0 0 5px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
          NIVEL DE AVISO: ${statusLabel}
        </h3>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #cbd5e1;">
          La pieza o servicio de mantenimiento <strong>"${taskName}"</strong> ha alcanzado el límite de advertencia establecido para tu vehículo.
        </p>
      </div>

      <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
        <h4 style="color: #e2e8f0; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase;">Detalles del Vehículo</h4>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="color: #94a3b8; padding: 4px 0;">Vehículo:</td>
            <td style="color: #ffffff; font-weight: bold; text-align: right; padding: 4px 0;">${vehicleName}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 4px 0;">Kilometraje Actual:</td>
            <td style="color: #4ade80; font-weight: bold; font-family: monospace; text-align: right; padding: 4px 0;">${(currentKm || 0).toLocaleString("es-ES")} KMs</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 4px 0;">KMs Restantes para Cambio:</td>
            <td style="color: ${statusColorHex}; font-weight: bold; font-family: monospace; text-align: right; padding: 4px 0;">
              ${kmRemaining <= 0 ? "Excedido" : `${kmRemaining.toLocaleString("es-ES")} KMs`}
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 15px;">Por favor, programa una cita con tu taller de confianza lo antes posible.</p>
      </div>

      <div style="border-top: 1px solid #1e293b; margin-top: 30px; padding-top: 15px; text-align: center; font-size: 11px; color: #64748b;">
        Este es un correo automático provisto por el Módulo de IA y Telemetría de SIMVA.<br>
        Recibes este aviso porque has configurado notificaciones automáticas en tu dispositivo.
      </div>
    </div>
  `;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAILS_FROM || '"SIMVA Alertas" <alerts@simva.com>',
        to: userEmail,
        subject: `⚠️ ALERTA SIMVA [${statusLabel}] - ${vehicleName}: ${taskName}`,
        html: emailHtml,
      });

      console.log(`[EMAIL COMPLETO ENVIADO] Alerta para ${userEmail} enviada con éxito (pieza: ${taskName}).`);
      return res.json({ success: true, method: "smtp", message: "Alerta de correo enviada satisfactoriamente con SMTP." });
    } catch (err: any) {
      console.error("Error sending real SMTP email:", err);
    }
  }

  // Beautiful simulation output
  console.log("\n" + "=".repeat(60));
  console.log(`📧 [SIMVA ALERTA DE CORREO ELECTRONICO SIMULADO]`);
  console.log(`Para:       ${userEmail}`);
  console.log(`Asunto:     ⚠️ ALERTA SIMVA [${statusLabel}] - ${vehicleName}: ${taskName}`);
  console.log(`Vehículo:   ${vehicleName}`);
  console.log(`Pieza:      ${taskName}`);
  console.log(`Detalle:    Restan ${kmRemaining} KMs (Lector total: ${currentKm} KMs)`);
  console.log("=".repeat(60) + "\n");

  return res.json({
    success: true,
    method: "simulation",
    message: `Alerta Simulada: Correo enviado a ${userEmail} (Vehículo: ${vehicleName}, Tarea: ${taskName}, KMs: ${kmRemaining}). Configura el archivo .env.example para correo SMTP real.`
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
${vin ? `- Número identificador (VIN / Bastidor): ${vin} (Úsalo para verificar de manera híper-precisa la variante del motor, especificaciones de bujías, transmisión o cadena/correa, etc.)` : ""}

Si no encuentras el dato exacto o manual de taller de este modelo en tus fuentes, debes aplicar estrictamente los estándares de la industria para este tipo de vehículo (${isMoto ? "Moto" : "Coche"}) con motor (${fuelType}).

Devuelve una lista de las tareas de mantenimiento cíclicas preventivas básicas e intermedias recomendadas (por ejemplo, para coches: cambio de aceite y filtro, bujías, filtros de habitáculo/aire, líquido de frenos; para motos: lubricación y tensión de cadena de arrastre cada 1000km, reglaje de válvulas, aceite de horquilla, cambio de refrigerante si aplica, etc.).

Tu respuesta debe ser un arreglo de objetos JSON en español, donde cada objeto tenga exactamente estos campos:
- "tarea": Descripción muy corta y concisa en español de la tarea de mantenimiento (ej: "Cambio de aceite y filtro de motor", "Tensión y engrase de cadena"). Máximo 50 caracteres.
- "cada_km": Kilometraje recomendado para realizar la tarea (número entero positivo, ej. 5000, 10000, 15000, 30000). Si la tarea solo depende de meses, usa 0.
- "cada_meses": Tiempo en meses recomendado para realizar la tarea (número entero positivo, ej. 6, 12, 24). Si la tarea solo depende de kilómetros, usa 0.

El arreglo de tareas debe contener de 5 a 10 tareas clave principales del plan, ordenadas de menor a mayor periodicidad de kilómetros (y meses de forma secundaria). No mezclas tareas duplicadas.`;

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

startServer();
