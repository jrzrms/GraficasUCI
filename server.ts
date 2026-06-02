/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser configuration for handling high-resolution camera photos
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for the Gemini Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("La clave de API GEMINI_API_KEY no está configurada en el servidor. Configúrela en Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Medical graph analyzing API Endpoint
app.post("/api/analyze-chart", async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      res.status(400).json({ error: "No se proporcionó ninguna imagen para procesar." });
      return;
    }

    const ai = getGeminiClient();

    const systemPrompt = `Eres un experto asistente médico y de enfermería especializado en digitalizar gráficas y registros clínicos en papel.
Tu tarea es analizar detalladamente la foto del gráfico/tabla de enfermería de un paciente y extraer las constantes de vitales que se observan.

Instrucciones específicas de extracción:
1. Identifica los metadatos del Paciente en las secciones laterales o cabecera:
   - "DATA" o "FECHA": Extrae la fecha indicada (por ejemplo, "16/05/26").
   - "PES" o "PESO": Extrae el peso del paciente (por ejemplo, "92" o "92 Kg").
   - "TALLA": Extrae la talla si está escrita (por ejemplo, si tiene valores o dejar vacío si no hay).
   - "FULL NÚM." o "CAMA": Es el identificador de la gráfica u hoja (por ejemplo, "4").

2. Para cada una de las 24 columnas correspondientes a las horas (0 a 23), analiza y extrae los siguientes parámetros:
   - "tas" (Tensión Arterial Sistólica): Busca los puntos o marcas graficadas en la zona superior de "PRESSIÓ" correspondientes a la Tensión Arterial Sistólica. El eje vertical a la izquierda ('PA') te da la escala (50 a 240). Obtén el número entero estimado basándote en la cuadrícula. Devuelve null si no hay registro para esa hora.
   - "tad" (Tensión Arterial Diastólica): Busca los puntos inferiores de la gráfica de presión correspondientes a la Tensión Diastólica. Escala en eje 'PA' (50 a 240). Devuelve null si no hay registro para esa hora.
   - "fc" (Frecuencia Cardíaca): Lee los puntos graficados en la línea de 'FREQ. CARD.' o 'F.C.'. La escala vertical está en la columna 'F.C.' (de 40 a 240). Devuelve null si no hay registro para esa hora.
   - "temperatura": Busca si hay cifras numéricas escritas (como "36'2" o "36") sobre el gráfico o la línea de temperatura ('T (ºC)'), o estima la temperatura en base a la línea/puntos situados en la sección de temperatura (valores de 34,5 a 41,5). Devuelve un número decimal o null si no se registra.
   - "freq_respiratoria" (Frecuencia Respiratoria): Lee el texto o número que se encuentra escrito de forma manuscrita en la fila etiquetada como "FREQ. RESPIRATORIA" (situada en la parte central, justo debajo de la sección de gráficas). Los ejemplos de valores válidos son "9", "10", "15/AC", "AC", "16", "17", etc. Devuelve null o "-" si solo hay una línea/guión o celda vacía.
   - "diuresis": Lee el valor numérico o anotación escrita en la fila de "DIÜRESIS" bajo la sección de "SORTIDES" (salidas u orina). Puede tener valores como "10", "5", etc., un guión "-" o estar vacía. Extrae literalmente lo que esté escrito.

Haz un esfuerzo meticuloso para leer todos los valores escritos a mano en el gráfico y los campos numéricos de frecuencia respiratoria y diuresis para cada hora individual.`;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: image,
      },
    };

    const textPart = {
      text: "Por favor, analiza esta gráfica de enfermería y extrae los datos estructurados en formato JSON.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            paciente: {
              type: Type.OBJECT,
              properties: {
                fecha: { type: Type.STRING, description: "La fecha del documento (campo DATA) p.ej. '16/05/26'" },
                peso: { type: Type.STRING, description: "El peso (campo PES) p.ej. '92 Kg'" },
                talla: { type: Type.STRING, description: "La talla si la tiene, p.ej. ''" },
                cama: { type: Type.STRING, description: "El identificador o cama de la gráfica (campo FULL NÚM.) p.ej. '4'" },
              },
              required: ["fecha", "peso", "talla", "cama"],
            },
            constantes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  hora: { type: Type.INTEGER, description: "La hora de la columna de 0 a 23" },
                  tas: { type: Type.INTEGER, description: "Tensión Arterial Sistólica en mmHg (si está graficada, estimar valor entre 40 y 240, nulo si no hay marca)" },
                  tad: { type: Type.INTEGER, description: "Tensión Arterial Diastólica en mmHg (si está graficada, estimar valor entre 40 y 240, nulo si no hay marca)" },
                  fc: { type: Type.INTEGER, description: "Frecuencia Cardíaca en lpm (estimar valor de gráfica p.ej. 80, o nulo si no hay marca)" },
                  temperatura: { type: Type.NUMBER, description: "Temperatura en ºC (escribir el número manuscrito p.ej. 36.2, 36 o estimar punto, o nulo)" },
                  freq_respiratoria: { type: Type.STRING, description: "Valor escrito a mano en FREQ. RESPIRATORIA p.ej. '9', '10', '15/AC', o nulo si está vacío o es un guión" },
                  diuresis: { type: Type.STRING, description: "Valor escrito a mano en la fila DIÜRESIS p.ej. '10', '5', o nulo si está vacío o es un guión" },
                },
                required: ["hora"],
              },
            },
            rawAnalysisExplanation: { type: Type.STRING, description: "Breve reporte textual explicando qué datos principales se han digitalizado y cualquier anomalía o anotación importante detectada en el gráfico." },
          },
          required: ["paciente", "constantes", "rawAnalysisExplanation"],
        },
      },
    });

    const textOutput = response.text || "{}";
    res.json(JSON.parse(textOutput));
  } catch (error: any) {
    console.error("Error al procesar la imagen con Gemini:", error);
    res.status(500).json({ error: error.message || "Error al procesar la gráfica con la inteligencia artificial." });
  }
});

// Setup Vite development server or production static serving
async function main() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets or built react files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express] Servidor corriendo en el puerto ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fallo al arrancar el servidor:", err);
});
