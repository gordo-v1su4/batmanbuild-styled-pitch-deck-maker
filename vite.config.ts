import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import type { ViteDevServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Retry helper with exponential backoff for upstream API calls */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }
      if (!response.ok && response.status !== 429) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const waitTime = Math.pow(2, i) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Max retries exceeded");
}

function apiProxyPlugin(geminiKey: string, kimiKey: string) {
  return {
    name: "api-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || "";
        if (url.startsWith("/api/gemini")) {
          handleGemini(req, res, geminiKey);
        } else if (url.startsWith("/api/imagen")) {
          handleImagen(req, res, geminiKey);
        } else if (url.startsWith("/api/kimi")) {
          handleKimi(req, res, kimiKey);
        } else {
          next();
        }
      });
    },
  };
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function handleGemini(req: any, res: any, apiKey: string) {
  if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
  readBody(req).then(async (body) => {
    try {
      const { prompt, imageBase64Data, systemInstruction, responseMimeType } = JSON.parse(body);
      const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent";
      const parts: any[] = [{ text: prompt }];
      if (imageBase64Data) {
        parts.push({ inlineData: { mimeType: imageBase64Data.mimeType, data: imageBase64Data.base64 } });
      }
      const payload: any = { contents: [{ parts }] };
      if (systemInstruction) { payload.systemInstruction = { parts: [{ text: systemInstruction }] }; }
      if (responseMimeType === "application/json") { payload.generationConfig = { responseMimeType: "application/json" }; }

      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.error) { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: data.error.message || "Gemini API Error" })); return; }
      if (!data.candidates || data.candidates.length === 0) { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "No candidates in response" })); return; }
      const candidate = data.candidates[0];
      if (candidate.finishReason && candidate.finishReason !== "STOP") { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: `Generation stopped: ${candidate.finishReason}` })); return; }
      const text = candidate.content?.parts?.[0]?.text;
      if (!text) { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "No text generated" })); return; }
      try { const parsed = JSON.parse(text); res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(parsed)); }
      catch { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ text })); }
    } catch (error: any) {
      res.statusCode = 500; res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message || "AI Generation Failed" }));
    }
  });
}

function handleImagen(req: any, res: any, apiKey: string) {
  if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
  readBody(req).then(async (body) => {
    try {
      const { prompt } = JSON.parse(body);
      if (!prompt) { res.statusCode = 400; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "Prompt is required" })); return; }
      const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "16:9", imageSize: "2K" } },
      };
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!imageData) { res.statusCode = 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "No image generated" })); return; }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ predictions: [{ bytesBase64Encoded: imageData }] }));
    } catch (error: any) {
      res.statusCode = 500; res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message || "Image Generation Failed" }));
    }
  });
}

function handleKimi(req: any, res: any, apiKey: string) {
  if (req.method !== "POST") { res.statusCode = 405; res.end("Method not allowed"); return; }
  readBody(req).then(async (body) => {
    try {
      const { prompt, systemInstruction } = JSON.parse(body);
      if (!prompt) { res.statusCode = 400; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "Prompt is required" })); return; }

      const env = process.env;
      const apiBase = env.KIMI_API_BASE || (apiKey.startsWith("sk-kimi-") ? "https://api.kimi.com/coding" : "https://api.moonshot.ai/v1");
      const apiProtocol = env.KIMI_API_PROTOCOL || (apiBase.includes("api.kimi.com/coding") ? "anthropic" : "openai");
      const configuredModel = env.KIMI_MODEL;
      const model = apiProtocol === "anthropic"
        ? (!configuredModel || configuredModel === "kimi-k2.6" ? "kimi-for-coding" : configuredModel)
        : (configuredModel || "kimi-k2.6");

      const sysContent = systemInstruction || "You are a world-class Film Director and screenwriter. Return strict JSON only.";
      const messages = [
        { role: "system", content: sysContent },
        { role: "user", content: prompt },
      ];

      let response: Response;
      if (apiProtocol === "anthropic") {
        const url = apiBase.endsWith("/v1") ? `${apiBase}/messages` : `${apiBase}/v1/messages`;
        response = await fetchWithRetry(url, {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            system: sysContent,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 12000,
          }),
        });
      } else {
        const url = apiBase.endsWith("/chat/completions") ? apiBase : `${apiBase}/chat/completions`;
        response = await fetchWithRetry(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages,
            response_format: { type: "json_object" },
            thinking: { type: "disabled" },
            max_completion_tokens: 12000,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        const message = data?.error?.message || data?.message || `Kimi API failed (${response.status})`;
        res.statusCode = response.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: { message } }));
        return;
      }

      let content: string;
      if (apiProtocol === "anthropic") {
        const rawContent = data?.content;
        if (typeof rawContent === "string") content = rawContent;
        else if (Array.isArray(rawContent)) content = rawContent.map((p: any) => typeof p === "string" ? p : p?.text || "").filter(Boolean).join("\n");
        else content = "";
      } else {
        content = data?.choices?.[0]?.message?.content || "";
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ content, model: data?.model || model, usage: data?.usage || null }));
    } catch (error: any) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: error.message || "Kimi API Error" } }));
    }
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const geminiKey = env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const kimiKey = env.KIMI_API_KEY || env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...((geminiKey || kimiKey) ? [apiProxyPlugin(geminiKey || "", kimiKey || "")] : []),
      viteSingleFile(),
    ],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  };
});
