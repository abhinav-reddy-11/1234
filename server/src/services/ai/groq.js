import { env } from "../../config/env.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile was retired by Groq on 16 Aug 2026.
// Configurable so future retirements only need an env change.
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const TIMEOUT_MS = 20000;

export class AIUnavailableError extends Error {}

// Calls Groq and returns the reply parsed as JSON.
// Any problem (no key, network, timeout, rate limit, bad JSON) becomes
// AIUnavailableError, which every AI feature turns into a safe fallback.
export async function groqJSON(systemPrompt, userPrompt, { temperature = 0.1, maxTokens = 2000 } = {}) {
  if (!env.groqApiKey) throw new AIUnavailableError("GROQ_API_KEY is not configured");

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.groqApiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature,
        max_tokens: maxTokens,
        reasoning_effort: "low", // gpt-oss is a reasoning model; keep thinking short
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === "TimeoutError" ? "Groq request timed out" : `Groq request failed: ${err.message}`;
    throw new AIUnavailableError(reason);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AIUnavailableError(`Groq returned HTTP ${response.status} ${detail.slice(0, 200)}`);
  }
  try {
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch {
    throw new AIUnavailableError("Groq returned an invalid response");
  }
}