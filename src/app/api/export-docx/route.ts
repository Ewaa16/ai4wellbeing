import { renderDraftToDocx } from "@/lib/docx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { text?: string; title?: string };
  try {
    body = (await request.json()) as { text?: string; title?: string };
  } catch {
    return Response.json({ error: "Body request tidak valid." }, { status: 400 });
  }

  if (!body.text || !body.text.trim()) {
    return Response.json({ error: "Draft kosong, tidak bisa di-export." }, { status: 400 });
  }

  const buffer = await renderDraftToDocx(body.text, body.title?.trim() || "Manuscript Draft");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="manuscript-ieee.docx"`,
    },
  });
}