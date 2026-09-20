import { generateDraftStream, reviseStream } from "@/lib/generate";
import { DEFAULT_MODEL, DEFAULT_RESEARCH_INPUT, type DraftPayload, type ResearchInput } from "@/lib/types";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function friendlyError(raw: string): string {
  if (/no longer available|not found|not supported/i.test(raw)) {
    return "Model yang diminta tidak lagi didukung. Server otomatis memakai model default (gemini-3.6-flash).";
  }
  if (/high demand|503|overloaded/i.test(raw)) {
    return "Model sedang penuh permintaan (kuota gratis Gemini). Tunggu sebentar lalu coba lagi.";
  }
  if (/429|quota|rate limit/i.test(raw)) {
    return "Kuota gratis harian untuk Gemini habis. Tunggu hingga reset kuota, atau hubungi pengelola app untuk upgrade.";
  }
  const inner = raw.match(/"message":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  return inner ? inner[1].replace(/\\n/g, " ") : raw;
}

export async function POST(request: NextRequest) {
  let body: DraftPayload;
  try {
    body = (await request.json()) as DraftPayload;
  } catch {
    return Response.json({ error: "Body request tidak valid." }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      {
        error:
          "GEMINI_API_KEY belum diatur. Salin .env.example ke .env.local dan isi API key kamu dari Google AI Studio (ai-studio.google.com).",
      },
      { status: 500 }
    );
  }

  const input: ResearchInput = { ...DEFAULT_RESEARCH_INPUT, ...body.input };
  const model = body.model ?? DEFAULT_MODEL;

  let generator: AsyncGenerator<string>;
  if (body.mode === "revise") {
    if (!body.currentDraft || !body.section) {
      return Response.json({ error: "Draft dan bagian yang direvisi wajib diisi." }, { status: 400 });
    }
    generator = reviseStream(
      input,
      body.currentDraft,
      body.section,
      body.instruction ?? "perbaiki bagian ini",
      model
    );
  } else {
    generator = generateDraftStream(input, model);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        const raw = error instanceof Error ? error.message : "Gagal menghubungi model AI.";
        controller.enqueue(encoder.encode(`\n\n[ERROR] ${friendlyError(raw)}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}