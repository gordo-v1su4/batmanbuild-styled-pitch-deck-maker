import type { ImageData } from "../types";

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...options.headers, "X-Retry-Count": attempt.toString() },
      });
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const waitTime = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function callGemini(
  prompt: string,
  imageBase64Data: ImageData | null = null,
  systemInstruction: string | null = null
): Promise<any> {
  const url = "/api/gemini";
  const payload = { prompt, imageBase64Data, systemInstruction, responseMimeType: "application/json" };

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (data.error) {
    const errorMsg = typeof data.error === "string" ? data.error : `${data.error}${data.finishReason ? ` (finishReason: ${data.finishReason})` : ""}`;
    throw new Error(errorMsg);
  }
  return data;
}

export async function callImagen(prompt: string): Promise<string> {
  const url = "/api/imagen";
  const payload = { prompt };

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64Image) throw new Error("No image generated");
  return `data:image/png;base64,${base64Image}`;
}
