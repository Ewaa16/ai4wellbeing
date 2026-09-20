import "server-only";
import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt, buildUserPrompt } from "./journal-templates";
import type { ResearchInput } from "./types";

export const DEFAULT_MODEL = "gemini-2.5-flash";
export const FREE_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (gratis, cepat)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (gratis tier, lebih teliti)" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (gratis, paling cepat)" },
] as const;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY belum diatur. Salin .env.example ke .env.local dan isi API key kamu dari Google AI Studio (ai-studio.google.com)."
    );
  }
  return new GoogleGenAI({ apiKey });
}

async function* streamContent(
  systemPrompt: string,
  prompt: string,
  model: string,
  temperature: number
): AsyncGenerator<string> {
  const client = getClient();
  const response = await client.models.generateContentStream({
    model,
    contents: prompt,
    config: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      temperature,
    },
  });
  for await (const chunk of response) {
    if (chunk.text) yield chunk.text;
  }
}

export function generateDraftStream(
  input: ResearchInput,
  model: string = DEFAULT_MODEL
): AsyncGenerator<string> {
  return streamContent(buildSystemPrompt(), buildUserPrompt(input), model, 0.5);
}

export function reviseStream(
  input: ResearchInput,
  currentDraft: string,
  section: string,
  instruction: string,
  model: string = DEFAULT_MODEL
): AsyncGenerator<string> {
  const prompt = [
    "The user has a full draft manuscript (shown below between the markers).",
    `They want you to revise the following part: "${section}".`,
    `Revision request: ${instruction}`,
    "",
    "Rules:",
    "- Rewrite ONLY the requested part. Keep every other part of the manuscript exactly as-is.",
    "- Return the COMPLETE, full revised manuscript (all sections), not just the changed part.",
    "- Follow the same strict structure and IEEE formatting rules as before.",
    "- Do not invent data or references.",
    "",
    "<<<CURRENT_DRAFT_START>>>",
    currentDraft,
    "<<<CURRENT_DRAFT_END>>>",
  ].join("\n");
  return streamContent(buildSystemPrompt(), prompt, model, 0.4);
}