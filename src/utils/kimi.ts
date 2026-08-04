const KIMI_STORY_MODEL = "kimi-k2.6";

export interface KimiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface KimiResponse {
  content: string;
  model: string;
  usage: any | null;
}

function extractJsonObject(text: string): string {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fence) return extractJsonObject(fence);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(extractJsonObject(text));
  } catch {
    return null;
  }
}

export async function callKimi(
  prompt: string,
  systemInstruction: string | null = null
): Promise<any> {
  const url = "/api/kimi";
  const payload = { prompt, systemInstruction };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || data.error || `Kimi API Error: ${response.status}`;
    throw new Error(typeof errorMsg === "string" ? errorMsg : "Kimi API Error");
  }

  if (data.content) {
    const parsed = safeJsonParse(data.content);
    if (parsed) return parsed;
    return { text: data.content };
  }

  return data;
}

export { KIMI_STORY_MODEL };
export { extractJsonObject, safeJsonParse };
