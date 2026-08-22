import { initializeApp } from "firebase-admin/app";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

initializeApp();
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const SCHOOL_DOMAIN = "kangoeroeschool.com";

function authorized(request) {
  const email = String(request.auth?.token?.email || "")
    .trim()
    .toLowerCase();
  return (
    request.auth?.token?.email_verified === true &&
    email.endsWith(`@${SCHOOL_DOMAIN}`)
  );
}

export const askAimsAssistant = onCall(
  {
    region: "southamerica-east1",
    secrets: [anthropicApiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!authorized(request))
      throw new HttpsError(
        "permission-denied",
        "A verified school account is required.",
      );
    const query = String(request.data?.query || "")
      .trim()
      .slice(0, 2000);
    const language = request.data?.language === "nl" ? "nl" : "en";
    const context = request.data?.context;
    if (!query)
      throw new HttpsError("invalid-argument", "A question is required.");
    if (!context || JSON.stringify(context).length > 120000)
      throw new HttpsError(
        "invalid-argument",
        "Assistant context is invalid or too large.",
      );

    const system =
      language === "nl"
        ? "Je bent de behulpzame AIMS-platformassistent. Voer een normaal gesprek en beantwoord algemene vragen over het gebruik, de schermen, modules en workflows van AIMS aan de hand van platformGuide. Gebruik voor actuele aantallen en records uitsluitend permittedCategories en verzin nooit gegevens. Leg bij actievragen duidelijk uit welke stappen de gebruiker zelf in AIMS kan volgen; voer zelf geen wijzigingen uit. Als toegang ontbreekt, leg de rolbeperking uit. Antwoord helder en natuurlijk in het Nederlands. Retourneer uitsluitend geldige JSON met answer, workflowKey en citationIds."
        : "You are the helpful AIMS platform assistant. Hold a natural conversation and answer general questions about using AIMS, its screens, modules, and workflows using platformGuide. For current counts and records, use only permittedCategories and never invent data. For action requests, clearly explain the steps the user can follow in AIMS; never perform changes yourself. Explain role restrictions when access is missing. Answer clearly and naturally in English. Return only valid JSON with answer, workflowKey, and citationIds.";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey.value(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        temperature: 0.2,
        system,
        messages: [
          {
            role: "user",
            content: `${language === "nl" ? "Vraag" : "Question"}: ${query}\n\nContext: ${JSON.stringify(context)}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error("Anthropic request failed", response.status);
      throw new HttpsError(
        "unavailable",
        "The AI provider is temporarily unavailable.",
      );
    }
    const payload = await response.json();
    const text = payload?.content?.find((item) => item.type === "text")?.text;
    if (!text)
      throw new HttpsError("internal", "The AI provider returned no answer.");
    try {
      return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      return { answer: text, workflowKey: "none", citationIds: [] };
    }
  },
);
