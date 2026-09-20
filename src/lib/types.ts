export type JournalFormat = "ieee";

export const DEFAULT_MODEL = "gemini-3.6-flash";

export const FREE_MODELS = [
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash (gratis, paling stabil)" },
] as const;

export type ModelId = (typeof FREE_MODELS)[number]["id"];

export interface ResearchInput {
  title: string;
  subjectArea: string;
  focus: string;
  objectives: string;
  methods: string;
  results: string;
  discussion: string;
  references: string;
  indexTerms: string;
  additionalInstructions: string;
}

export const DEFAULT_RESEARCH_INPUT: ResearchInput = {
  title: "",
  subjectArea: "",
  focus: "",
  objectives: "",
  methods: "",
  results: "",
  discussion: "",
  references: "",
  indexTerms: "",
  additionalInstructions: "",
};

export interface DraftPayload {
  mode: "draft" | "revise";
  input: ResearchInput;
  model?: string;
  currentDraft?: string;
  section?: string;
  instruction?: string;
}

export interface ValidationRule {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}