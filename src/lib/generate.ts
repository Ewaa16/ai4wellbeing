import "server-only";
import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt, buildUserPrompt } from "./journal-templates";
import { DEFAULT_MODEL, type ResearchInput } from "./types";

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
  const candidates =
    model && model !== DEFAULT_MODEL ? [model, DEFAULT_MODEL] : [DEFAULT_MODEL];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const response = await client.models.generateContentStream({
        model: candidate,
        contents: prompt,
        config: {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          temperature,
        },
      });
      for await (const chunk of response) {
        if (chunk.text) yield chunk.text;
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
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