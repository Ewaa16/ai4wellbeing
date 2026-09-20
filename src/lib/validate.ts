import { IEEE_RULES } from "./journal-templates";
import type { ValidationRule } from "./types";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractBlock(text: string, headings: string[]): string {
  const lines = text.split("\n");
  const starts: number[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    for (const h of headings) {
      if (trimmed.toLowerCase().startsWith(h.toLowerCase())) {
        starts.push(i);
        break;
      }
    }
  });
  if (starts.length === 0) return "";
  let block = "";
  const start = starts[0];
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^(I{1,3}|IV|V{1,3}|VI{0,3})\.\s+\w/i.test(t) && countWords(t) > 1) break;
    if (/^(Acknowledgment|Acknowledgement|References):?\s*$/i.test(t)) break;
    if (/^##?\s+(Acknowledgment|Acknowledgement|References)\b/i.test(t)) break;
    if (t === "") continue;
    block += t + " ";
  }
  return block.trim();
}

export function validateDraft(text: string): ValidationRule[] {
  const rules: ValidationRule[] = [];
  const lines = text.split("\n");

  const titleLine = lines.find((l) => {
    const t = l.trim();
    return /^#/.test(t) && !/Abstract|Index Terms|Acknowledgment/.test(t) && t.length > 4;
  });

  const titleWords = titleLine ? countWords(titleLine.replace(/^#\s*/, "")) : 0;
  rules.push({
    key: "title",
    label: `Judul ≤ ${IEEE_RULES.titleMaxWords} kata`,
    pass: titleWords > 0 && titleWords <= IEEE_RULES.titleMaxWords,
    detail:
      titleWords === 0
        ? "Judul tidak ditemukan."
        : `Judul ${titleWords} kata.`,
  });

  const abstract = extractBlock(text, ["Abstract", "Abstract—", "Abstract -"]);
  rules.push({
    key: "abstract",
    label: `Abstrak satu paragraf (${IEEE_RULES.abstractMinWords}-${IEEE_RULES.abstractMaxWords} kata)`,
    pass:
      abstract.length > 0 &&
      countWords(abstract) >= IEEE_RULES.abstractMinWords &&
      countWords(abstract) <= IEEE_RULES.abstractMaxWords,
    detail: [
      abstract.length === 0 ? "Bagian Abstract tidak ditemukan." : "",
      abstract.length > 0
        ? `${countWords(abstract)} kata.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  });

  const indexBlock = extractBlock(text, ["Index Terms"]);
  const indexItems = indexBlock
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !s.toLowerCase().startsWith("index terms"));
  rules.push({
    key: "index_terms",
    label: `Index Terms ${IEEE_RULES.indexTermsMin}-${IEEE_RULES.indexTermsMax} keyword`,
    pass:
      indexItems.length >= IEEE_RULES.indexTermsMin &&
      indexItems.length <= IEEE_RULES.indexTermsMax,
    detail:
      indexItems.length === 0
        ? "Index Terms tidak ditemukan."
        : `${indexItems.length} keyword ditemukan.`,
  });

  const requiredSections: [string, RegExp][] = [
    ["I. Introduction", /I\.\s*Introduction/i],
    ["Methodology", /II\.\s*\w+.*(Method|Design|Approach|Model|Framework|Materials|Experiment)/i],
    ["III. Results", /III\.\s*Results?/i],
    ["V. Conclusion", /V\.\s*Conclusion/i],
  ];
  for (const [label, re] of requiredSections) {
    const found = re.test(text);
    rules.push({
      key: `section_${label.toLowerCase()}`,
      label: `Seksi "${label}" ada`,
      pass: found,
      detail: found ? "Ditemukan." : "Tidak ditemukan di draft.",
    });
  }

  const refHeading = /References\b/i.test(text) || /^#+\s*References/i.test(text);
  const refEntries = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\[\d+\]/.test(l));
  rules.push({
    key: "references_format",
    label: `Referensi format IEEE [n] (min ${IEEE_RULES.minReferences})`,
    pass:
      refHeading &&
      refEntries.length > 0 &&
      refEntries.length <= 50 &&
      refEntries.length >= 1,
    detail:
      refEntries.length === 0
        ? "Referensi [n] tidak ditemukan (tambahkan minimal 10 referensi asli di form)."
        : `${refEntries.length} entri referensi.`,
  });

  const citationPattern = /\[\d+(?:,\s*\d+)*-?\w?(?:\s*pp?\.?\s*\d+)?\]/g;
  const citations = text.match(citationPattern);
  rules.push({
    key: "in_text_citations",
    label: "Kutipan dalam teks [n]",
    pass: (citations?.length ?? 0) >= 3,
    detail: `Ditemukan ${citations?.length ?? 0} kutipan [n] dalam teks.`,
  });

  return rules;
}

export function validationScore(rules: ValidationRule[]): { pass: number; total: number } {
  const pass = rules.filter((r) => r.pass).length;
  return { pass, total: rules.length };
}