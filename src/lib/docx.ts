import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

function inlineRuns(text: string): TextRun[] {
  return text.split("**").map((segment, i) => {
    const isBold = i % 2 === 1;
    return new TextRun({
      text: segment.replace(/\*/g, ""),
      bold: isBold,
      size: 24,
    });
  });
}

const HEADING_TITLE_RE = /^#\s+(.+)$/;
const HEADING_SUBTITLE_RE = /^##\s+(.+)$/;
const NUMBERED_SECTION_RE = /^(\s*)((?:I|II|III|IV|V|VI|VII|VIII|IX|X)(?:-[A-Z])?)\.?\s+(.+)$/i;
const LABEL_SECTION_RE = /^(Abstract|Index Terms|Acknowledgment|Acknowledgements?|References)\b[:\-]?\s*$/i;
const REFERENCE_RE = /^\[\d+\]/;

export function draftToParagraphs(text: string): Paragraph[] {
  const children: Paragraph[] = [];
  const lines = text.split("\n");

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (trimmed === "") continue;

    if (HEADING_TITLE_RE.test(line)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: inlineRuns(trimmed.replace(HEADING_TITLE_RE, "$1")),
        })
      );
      continue;
    }

    if (HEADING_SUBTITLE_RE.test(line)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: inlineRuns(trimmed.replace(HEADING_SUBTITLE_RE, "$1")),
        })
      );
      continue;
    }

    if (NUMBERED_SECTION_RE.test(trimmed)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: inlineRuns(trimmed),
        })
      );
      continue;
    }

    if (LABEL_SECTION_RE.test(trimmed)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: inlineRuns(trimmed),
        })
      );
      continue;
    }

    if (REFERENCE_RE.test(trimmed)) {
      children.push(
        new Paragraph({
          indent: { left: 480 },
          spacing: { after: 80 },
          children: inlineRuns(trimmed),
        })
      );
      continue;
    }

    if (trimmed.startsWith("|")) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: inlineRuns(trimmed),
        })
      );
      continue;
    }

    children.push(
      new Paragraph({
        spacing: { after: 120, line: 276 },
        alignment: AlignmentType.JUSTIFIED,
        children: inlineRuns(trimmed),
      })
    );
  }

  return children;
}

export async function renderDraftToDocx(text: string, docTitle?: string): Promise<Buffer> {
  const paragraphs = draftToParagraphs(text);
  if (docTitle) {
    paragraphs.unshift(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: inlineRuns(docTitle),
      })
    );
  }
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } },
        },
        children: paragraphs,
      },
    ],
  });
  return Packer.toBuffer(doc);
}