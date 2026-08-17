"use client";

import { useState, useRef } from "react";
import { useLanguage } from "../components/LanguageContext";
import SectionHeader from "../components/SectionHeader";
import { en } from "../locales/en";
import { vn } from "../locales/vn";
import { wordToQatt } from "../lib/qatt";

export default function TranslatePage() {
  const [inputText, setInputText] = useState("");
  const [outputWords, setOutputWords] = useState([]);
  const [direction, setDirection] = useState("viet-to-nom");
  const [lockedWords, setLockedWords] = useState({});
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const debounceSeq = useRef(0);
  const { language } = useLanguage();
  const t = language === "en" ? en : vn;

  // Fetch candidates for every word in parallel, tolerating individual failures
  // so one bad word never blanks the whole translation. A request-sequence guard
  // drops stale responses when the user types again quickly.
  const translateVietToNom = async (text, locked, seq) => {
    if (!text.trim()) { setOutputWords([]); return; }
    setLoading(true);

    const words = text.trim().split(/\s+/);
    const results = await Promise.all(
      words.map(async (word, i) => {
        // Quốc Âm Tân Tự is always the initial output (rendered with GotichQATT).
        const qatt = wordToQatt(word);

        if (locked[i]) {
          // The user has already chosen a Chữ Nôm character for this word.
          return { word, qatt, character: locked[i], options: [], selected: true };
        }

        let matches = [];
        try {
          const res = await fetch(`/api/translate?reading=${encodeURIComponent(word)}`);
          const data = await res.json();
          matches = res.ok && Array.isArray(data.results) ? data.results : [];
        } catch (err) {
          console.error(`Translate lookup failed for "${word}":`, err);
        }

        // character stays null until the user explicitly picks a meaning, so the
        // output keeps showing the QATT representation.
        return {
          word,
          qatt,
          character: null,
          options: matches,
          multiple: matches.length > 1,
          selected: false,
        };
      })
    );

    if (seq !== debounceSeq.current) return;
    setOutputWords(results);
    setLoading(false);
  };

  const translateNomToViet = async (text, seq) => {
    if (!text.trim()) { setOutputWords([]); return; }
    setLoading(true);

    const chars = [...text];
    const results = await Promise.all(
      chars.map(async (char) => {
        let reading = null;
        try {
          const res = await fetch(`/api/translate?character=${encodeURIComponent(char)}`);
          const data = await res.json();
          reading = res.ok ? data.result?.reading ?? null : null;
        } catch (err) {
          console.error(`Translate lookup failed for "${char}":`, err);
        }
        return { word: char, character: char, reading };
      })
    );

    if (seq !== debounceSeq.current) return;
    setOutputWords(results);
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value);

    const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
    const newLocked = Object.fromEntries(
      Object.entries(lockedWords).filter(([i]) => Number(i) < wordCount)
    );
    setLockedWords(newLocked);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++debounceSeq.current;
    debounceRef.current = setTimeout(() => {
      if (direction === "viet-to-nom") translateVietToNom(value, newLocked, seq);
      else translateNomToViet(value, seq);
    }, 400);
  };

  // User picks a Chữ Nôm meaning on the input side → the output word changes
  // from its QATT representation to the selected character.
  const applySuggestion = (index, char) => {
    const newLocked = { ...lockedWords, [index]: char };
    setLockedWords(newLocked);
    setOutputWords((prev) =>
      prev.map((w, i) => (i === index ? { ...w, character: char, selected: true } : w))
    );
  };

  const toggleDirection = () => {
    const newDir = direction === "viet-to-nom" ? "nom-to-viet" : "viet-to-nom";
    setDirection(newDir);
    setInputText("");
    setOutputWords([]);
    setLockedWords({});
  };

  const hasCandidates = outputWords.some((w) => w.options?.length > 0);

  return (
    <div className="pattern-surround flex min-h-screen flex-col">
      <section className="w-full flex-1">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 md:py-12">
          <SectionHeader
            label={t.translate}
            title={t.translateTitle}
            subtitle={t.translateDescription}
            headingLevel="h1"
          />

          <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex min-h-10 flex-1 items-center justify-center rounded-lg border-2 border-[#a00000]/40 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
              {direction === "viet-to-nom" ? t.vietnamese : t.chuNom}
            </div>
            <button
              type="button"
              onClick={toggleDirection}
              aria-label={t.translate}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-[#a00000] bg-white transition-colors hover:bg-[#a00000]/5"
            >
              <svg width="15" height="15" viewBox="0 0 25 25" fill="none" stroke="#a00000" strokeWidth="2.5">
                <path d="M8 3 4 7l4 4" />
                <path d="M4 7h16" />
                <path d="m16 21 4-4-4-4" />
                <path d="M20 17H4" />
              </svg>
            </button>
            <div className="flex min-h-10 flex-1 items-center justify-center rounded-lg border-2 border-[#a00000]/40 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
              {direction === "viet-to-nom" ? t.chuNom : t.vietnamese}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <textarea
                value={inputText}
                onChange={handleInputChange}
                placeholder={direction === "viet-to-nom" ? t.typeVietnamese : t.pasteChuNom}
                className="h-65 w-full resize-none rounded-xl border-2 border-[#a00000]/40 bg-white p-4 text-2xl text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a00000]"
              />

              {/* Chữ Nôm candidate selection lives on the INPUT side, associated
                  with each word. The output only changes once the user picks. */}
              {direction === "viet-to-nom" && hasCandidates && (
                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#a00000]">
                    {t.multipleMatches}
                  </p>
                  {outputWords.map((w, i) =>
                    w.options?.length ? (
                      <div
                        key={i}
                        className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0"
                      >
                        <span className="min-w-14 text-sm font-semibold text-gray-900">{w.word}</span>
                        {w.options.length === 1 ? (
                          <button
                            type="button"
                            onClick={() => applySuggestion(i, w.options[0].character)}
                            className="flex items-center gap-2 rounded-md border border-[#a00000]/40 bg-white px-3 py-1 transition-colors hover:bg-[#a00000]/5"
                            title={`${w.options[0].reading} — ${w.options[0].definition || ""}`}
                          >
                            <span className="font-han text-xl leading-none">{w.options[0].character}</span>
                            <span className="text-xs text-gray-600">{w.options[0].reading}</span>
                          </button>
                        ) : (
                          <select
                            value={w.character || ""}
                            onChange={(e) => applySuggestion(i, e.target.value)}
                            aria-label={`Choose Chữ Nôm for ${w.word}`}
                            className="max-w-52 cursor-pointer rounded-md border border-[#a00000]/40 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition-colors hover:border-[#a00000] focus:border-[#a00000]"
                          >
                            <option value="" disabled>
                              {w.character ? `✓ ${w.character}` : "—"}
                            </option>
                            {w.options.map((opt, j) => (
                              <option key={j} value={opt.character}>
                                {opt.character} · {opt.reading}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>

            <div>
              <div aria-live="polite" className="h-65 w-full overflow-y-auto rounded-xl border-2 border-[#a00000]/40 bg-gray-50 p-4 text-2xl shadow-sm">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-5 h-5 border-3 border-[#a00000] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : outputWords.length === 0 ? (
                  <p className="text-sm text-gray-400">{t.translationWillAppear}</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                    {outputWords.map((w, i) =>
                      direction === "viet-to-nom" ? (
                        <span
                          key={i}
                          className={`leading-none text-gray-900 ${
                            w.character ? "font-han text-2xl" : "font-qatt text-3xl"
                          }`}
                          title={w.word}
                        >
                          {w.character || w.qatt}
                        </span>
                      ) : (
                        <span key={i} className="font-han text-2xl leading-none text-gray-900">
                          {w.reading || w.word}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}
