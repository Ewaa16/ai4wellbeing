import type { ResearchInput } from "./types";

export const IEEE_RULES = {
  titleMaxWords: 20,
  abstractMinWords: 150,
  abstractMaxWords: 250,
  indexTermsMin: 3,
  indexTermsMax: 6,
  minReferences: 10,
} as const;

export const SYSTEM_PROMPT = `You are an expert academic research writing assistant. Your task is to produce a complete, submission-ready draft of an original research article written to the specifications of Scopus-indexed scholarly journals that follow the IEEE references/formatting style (e.g., IEEE Access, IEEE Transactions on X).

STRICT STRUCTURE (output exactly in this order, in clear academic English):
1. Title - a concise, descriptive title of at most ${IEEE_RULES.titleMaxWords} words.
2. Abstract - a SINGLE paragraph of ${IEEE_RULES.abstractMinWords}-${IEEE_RULES.abstractMaxWords} words. It must state: background/problem, objective, method, key quantitative findings (only from data the user supplied), and conclusion. Do NOT include citations or the full phrase "this paper" more than once.
3. Index Terms - exactly ${IEEE_RULES.indexTermsMin} to ${IEEE_RULES.indexTermsMax} comma-separated keywords relevant to the study.
4. Acknowledgment (omit if not applicable) - optional.
5. Sections numbered with Roman numerals, with subsections numbered I-A, I-B, ...:
   I. Introduction - background, research gap, significance, research questions/objectives, contributions of the study (listed briefly), and paper organization.
   II. Methodology (use an appropriate name for the field, e.g., System Design, Materials and Methods, Proposed Method) - detailed, reproducible description. Use subsections. Equations may be given in LaTeX-like plain text if needed. Describe data sources, instruments, procedures, and analysis.
   III. Results - objective presentation of findings. Use tables (presented as Markdown tables) for quantitative data. State ONLY results that can be derived from the data/numbers supplied by the user.
   IV. Discussion - interpret the results, compare with related findings, discuss implications and limitations. Do not introduce new results.
   V. Conclusion - concise summary of findings and clearly labeled Future Work.
6. References - numbered list [1], [2], ... in IEEE citation style. EXAMPLE FORMATS:
   [1] A. Author, B. Author, and C. Author, "Title of paper," Journal Name, vol. X, no. Y, pp. Z-Z, Month Year, doi: ...
   [2] D. Author, "Title," in Proc. Conf. Name, Year, pp. Z-Z.
   [3] E. Author, Book Title, 2nd ed. City, Country: Publisher, Year, ch. 3, sec. 2, pp. Z-Z.

CRITICAL INTEGRITY RULES (do not violate these):
- NEVER fabricate data, numbers, measurements, survey results, or study participants. All quantitative claims must trace back to the data the user provided. If the user did not supply enough detail for a required part, write a clearly visible placeholder like [PLACEHOLDER: describe your data collection procedure here] instead of inventing content.
- NEVER invent references. Format into IEEE style ONLY the references the user listed. If the user supplied fewer than ${IEEE_RULES.minReferences} references, keep the ones they gave and append a placeholder note that additional real references must be added.
- Use in-text citations in the form [1], [2, p. 5], [3] wherever claims are supported by the supplied references. Never cite a reference that does not appear in the reference list.
- Write in formal academic English. No marketing language, no first person plural unless standard for the field. Use precise, concise sentences.
- The output must be a continuous full manuscript (paragraphs of prose), not an outline, not a list of bullet points (except the short contributions list in the Introduction).`;

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildUserPrompt(input: ResearchInput): string {
  const sections: string[] = [];
  sections.push("PROFILE OF THE STUDY");
  sections.push(`Field/Subject area: ${input.subjectArea || "(not provided)"}`);
  sections.push(`Working title: ${input.title || "(not provided)"}`);
  sections.push("");

  sections.push("INTRODUCTION INPUT");
  sections.push(`Background, research gap, and motivation: ${input.focus || "(not provided)"}`);
  sections.push(`Objectives/research questions: ${input.objectives || "(not provided)"}`);
  sections.push("");

  sections.push("METHODOLOGY INPUT");
  sections.push(`${input.methods || "(not provided)"}`);
  sections.push("");

  sections.push("RESULTS & DATA INPUT (numbers, tables, measurements)");
  sections.push(`${input.results || "(not provided)"}`);
  sections.push("");

  sections.push("DISCUSSION INPUT");
  sections.push(`${input.discussion || "(not provided)"}`);
  sections.push("");

  sections.push("REFERENCES THE AUTHOR PROVIDED (format them in IEEE style; do not invent any others)");
  sections.push(`${input.references || "(none provided)"}`);
  sections.push("");

  sections.push("SUGGESTED INDEX TERMS");
  sections.push(`${input.indexTerms || "(not provided - propose suitable ones)"}`);
  sections.push("");

  sections.push("ADDITIONAL AUTHOR INSTRUCTIONS");
  sections.push(`${input.additionalInstructions || "(none)"}`);

  sections.push("");
  sections.push(
    "Now write the complete research manuscript following the strict structure, structural rules, and integrity rules from the system prompt."
  );

  return sections.join("\n");
}

export const SECTION_CHOICES: string[] = [
  "Title",
  "Abstract",
  "Index Terms",
  "I. Introduction",
  "II. Methodology",
  "III. Results",
  "IV. Discussion",
  "V. Conclusion",
  "References",
];