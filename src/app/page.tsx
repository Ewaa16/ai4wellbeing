"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useLocalStorage, useLocalStorageObject } from "@/lib/autosave";
import { SECTION_CHOICES } from "@/lib/journal-templates";
import { validateDraft, validationScore } from "@/lib/validate";
import {
  DEFAULT_MODEL,
  DEFAULT_RESEARCH_INPUT,
  FREE_MODELS,
  type ResearchInput,
  type ValidationRule,
} from "@/lib/types";

interface HistoryItem {
  id: string;
  title: string;
  text: string;
  savedAt: string;
}

const HISTORY_KEY = "jurnal-history";
const DRAFT_KEY = "jurnal-draft";
const INPUT_KEY = "jurnal-input";
let historyCache: HistoryItem[] | null = null;

function getHistorySnapshot(): HistoryItem[] {
  if (historyCache) return historyCache;
  if (typeof window === "undefined") return [];
  try {
    historyCache = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    historyCache = [];
  }
  return historyCache ?? [];
}

function subscribeHistory(callback: () => void): () => void {
  window.addEventListener("jurnal-history-change", callback);
  return () => window.removeEventListener("jurnal-history-change", callback);
}

function writeHistory(items: HistoryItem[]): void {
  historyCache = items;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* storage penuh/diblokir — abaikan */
  }
  window.dispatchEvent(new Event("jurnal-history-change"));
}

const FIELDS: { key: keyof ResearchInput; label: string; hint: string; rows: number }[] = [
  { key: "subjectArea", label: "Bidang / subjek studi", hint: "Contoh: Sistem Informasi, Kecerdasan Buatan, Kesehatan Digital", rows: 1 },
  { key: "title", label: "Working title (opsional)", hint: "AI akan merapikan bila perlu", rows: 1 },
  { key: "focus", label: "Latar belakang, gap riset & motivasi", hint: "Masalah yang kamu teliti, celah penelitian, kenapa penting", rows: 3 },
  { key: "objectives", label: "Tujuan / pertanyaan riset", hint: "Pisahkan dengan baris baru", rows: 2 },
  { key: "methods", label: "Metodologi", hint: "Data, sampel, instrumen, prosedur, analisis", rows: 4 },
  { key: "results", label: "Hasil & data (angka, tabel)", hint: "Masukkan angka/statistik ASLI risetmu — AI dilarang mengarang data", rows: 4 },
  { key: "discussion", label: "Catatan pembahasan (opsional)", hint: "Interpretasi, perbandingan, limitasi", rows: 3 },
  { key: "references", label: "Daftar referensi awal", hint: "Referensi aslimu, satu per baris. AI hanya merapikan ke gaya IEEE.", rows: 4 },
  { key: "indexTerms", label: "Index terms (opsional)", hint: "Pisahkan dengan koma, 3–6 kata kunci", rows: 1 },
  { key: "additionalInstructions", label: "Instruksi tambahan (opsional)", hint: "Contoh: fokus ke aspek X, target 12 halaman", rows: 2 },
];

export default function Home() {
  const [input, setInput] = useLocalStorageObject<ResearchInput>(
    INPUT_KEY,
    DEFAULT_RESEARCH_INPUT
  );
  const [draft, setDraft] = useLocalStorage(DRAFT_KEY);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [section, setSection] = useState(SECTION_CHOICES[0]);
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [exporting, setExporting] = useState(false);
  const history = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    () => []
  );

  const setField = useCallback(
    (key: keyof ResearchInput, value: string) => {
      setInput((prev) => ({ ...prev, [key]: value }));
    },
    [setInput]
  );

  const rules: ValidationRule[] = validateDraft(draft);
  const words = draft.trim().split(/\s+/).filter(Boolean).length;

  async function runStream(mode: "draft" | "revise") {
    setError("");
    setLoading(true);
    setRevising(true);
    const payload = {
      mode,
      input,
      model,
      currentDraft: mode === "revise" ? draft : undefined,
      section: mode === "revise" ? section : undefined,
      instruction: mode === "revise" ? instruction : undefined,
    };
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Terjadi kesalahan pada server.");
      }
      if (!res.body) throw new Error("Stream tidak tersedia.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setDraft("");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setDraft(acc);
      }
      if (acc.includes("[ERROR]")) {
        setError(acc.slice(acc.lastIndexOf("[ERROR]") + 8).trim());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memanggil server.");
    } finally {
      setLoading(false);
      setRevising(false);
    }
  }

  async function exportDocx() {
    setExporting(true);
    try {
      const res = await fetch("/api/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft, title: input.title || "Manuscript Draft" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Gagal membuat file .docx.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "manuscript-ieee.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal export.");
    } finally {
      setExporting(false);
    }
  }

  function saveToHistory() {
    if (!draft.trim()) return;
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      title: input.title || `Draft ${new Date().toLocaleString("id-ID")}`,
      text: draft,
      savedAt: new Date().toISOString(),
    };
    writeHistory([item, ...history].slice(0, 20));
  }

  function loadFromHistory(item: HistoryItem) {
    setDraft(item.text);
  }

  async function copyDraft() {
    const text = draft;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function exportPdf() {
    window.print();
  }

  const score = validationScore(rules);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
          AI Journal Draft — IEEE → Scopus
        </h1>
        <p className="text-sm text-slate-600">
          Prompting risetmu menjadi draft manuskrip berformat IEEE, siap Anda tinjau sebelum
          diserahkan ke jurnal intensif Scopus.
        </p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 print:hidden">
          <b>Penting:</b> Draft dihasilkan AI. Semua data, angka, dan referensi wajib{" "}
          <b>berasal dari riset aslimu</b>. Tinjau, verifikasi, dan susun ulang kalimat sesuai
          kebijakan jurnal targetmu. Kebijakan banyak jurnal Scopus mewajibkan keterlibatan penulis
          dalam tiap fase penulisan.
        </div>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
            Input Riset
          </h2>
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700">{f.label}</span>
              <textarea
                rows={f.rows}
                value={input[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.hint}
                className="resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Model AI (gratis)</span>
            {FREE_MODELS.length > 1 ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {FREE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {FREE_MODELS[0].label}
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Jika model dipilih ternyata tidak lagi didukung, server otomatis memakai{" "}
              {DEFAULT_MODEL}.
            </p>
          </label>
          <button
            onClick={() => runStream("draft")}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Menyusun draft…" : "Generate Full Draft"}
          </button>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
              Draft Manuskrip
            </h2>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                onClick={copyDraft}
                disabled={loading || !draft}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {copied ? "Tersalin ✓" : "Copy"}
              </button>
              <button
                onClick={saveToHistory}
                disabled={loading || !draft}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Simpan Riwayat
              </button>
              <button
                onClick={exportDocx}
                disabled={loading || exporting || !draft}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {exporting ? "Membuat file…" : "Export .docx"}
              </button>
              <button
                onClick={exportPdf}
                disabled={loading || !draft}
                className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
              >
                Export PDF
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
              {error}
            </div>
          )}

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              "Draft akan muncul di sini setelah Anda menekan \"Generate Full Draft\".\n\nAnda juga bisa menempelkan draft dari tempat lain untuk divalidasi atau di-export."
            }
            className="min-h-[420px] flex-1 resize-y rounded-xl border border-slate-300 p-4 font-mono text-[13px] leading-relaxed text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 print:hidden"
          />

          <pre className="hidden whitespace-pre-wrap break-words font-serif text-[12px] leading-relaxed text-black print:block">
            {draft}
          </pre>

          <p className="text-xs text-slate-500 print:hidden">
            {words} kata · {draft.length} karakter — draft otomatis tersimpan di browser.
          </p>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 print:hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                Validasi Kepatuhan IEEE ({score.pass}/{score.total})
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  score.pass === score.total
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {score.pass === score.total && score.total > 0 ? "LULUS" : "BELUM PENUH"}
              </span>
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {rules.map((r) => (
                <li
                  key={r.key}
                  className="flex items-start gap-2 text-xs text-slate-700"
                  title={r.detail}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      r.pass ? "bg-emerald-500" : "bg-red-400"
                    }`}
                  >
                    {r.pass ? "✓" : "!"}
                  </span>
                  <span>
                    <span className="font-medium">{r.label}</span> — {r.detail}
                  </span>
                </li>
              ))}
              {rules.length === 0 && (
                <li className="text-xs text-slate-500">Validasi berjalan otomatis saat ada draft.</li>
              )}
            </ul>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
            <h3 className="text-sm font-semibold text-slate-800">Revisi Bagian</h3>
            <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                disabled={revising}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {SECTION_CHOICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={revising}
                placeholder='Contoh: "perjelas metode sampling, tambah 1 kalimat limitasi"'
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                onClick={() => runStream("revise")}
                disabled={revising || !draft}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revising ? "Merevisi…" : "Revisi"}
              </button>
            </div>
          </div>

          {history.length > 0 && (
            <div className="flex flex-col gap-2 print:hidden">
              <h3 className="text-sm font-semibold text-slate-800">Riwayat (tersimpan otomatis)</h3>
              <ul className="flex flex-col gap-1.5">
                {history.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <button
                      onClick={() => loadFromHistory(item)}
                      className="truncate text-left text-sm text-blue-700 hover:underline"
                    >
                      {item.title}
                    </button>
                    <span className="shrink-0 text-xs text-slate-400">
                      {new Date(item.savedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}