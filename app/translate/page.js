"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../components/LanguageContext";
import SectionHeader from "../components/SectionHeader";
import { en } from "../locales/en";
import { vn } from "../locales/vn";
import { wordToQatt } from "../lib/qatt";
import { isCharacterImage } from "../lib/character";

// Split text into translatable words (letter/mark runs), punctuation/symbols,
// and whitespace. Word indices are stable, so the candidate popup and locked
// selections stay aligned with the translated words.
function tokenize(text) {
  const tokens = [];
  const re = /[\p{L}\p{M}]+|\s+|[^\p{L}\p{M}\s]+/gu;
  let m;
  while ((m = re.exec(text))) {
    const value = m[0];
    if (/^[\p{L}\p{M}]+$/u.test(value)) tokens.push({ type: "word", value });
    else if (/^\s+$/.test(value)) tokens.push({ type: "space", value });
    else tokens.push({ type: "punct", value });
  }
  return tokens;
}

const getWords = (text) =>
  tokenize(text)
    .filter((t) => t.type === "word")
    .map((t) => t.value);

function getLastWordIndex(text) {
  return getWords(text).length - 1;
}

// Punctuation is rendered with its Chinese (full-width) form where one exists,
// so it displays correctly alongside the Chữ Nôm characters.
const CHINESE_PUNCT = {
  ".": "。", ",": "，", "!": "！", "?": "？", ":": "：", ";": "；",
  "(": "（", ")": "）", "[": "［", "]": "］", "{": "｛", "}": "｝",
  "<": "＜", ">": "＞", "%": "％", "@": "＠", "#": "＃", "&": "＆",
  "*": "＊", "+": "＋", "=": "＝", "^": "＾", "_": "＿", "|": "｜",
  "~": "～", "`": "｀", "$": "＄",
};

function toChinesePunct(value) {
  if (value === "...") return "……";
  return [...value].map((ch) => CHINESE_PUNCT[ch] || ch).join("");
}

// Fetch the Nôm characters that read as `reading` from the translate API,
// tolerating failures so one bad word never blanks the whole translation.
async function fetchReadingMatches(reading) {
  try {
    const res = await fetch(`/api/translate?reading=${encodeURIComponent(reading)}`);
    const data = await res.json();
    return res.ok && Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    console.error(`Translate lookup failed for "${reading}":`, err);
    return [];
  }
}

// Each candidate's definition is shown in the active language:
// Vietnamese mode → Nôm definition (fallback Hán Việt, then English),
// English mode → English definition (fallback Nôm).
function candidateDefinition(candidate, language) {
  const nom = String(candidate?.nom_definition || "").trim();
  const han = String(candidate?.han_viet_definition || "").trim();
  const en = String(candidate?.definition || "").trim();
  const isReal = (value) => value && value !== "N/A";

  if (language === "vn") {
    return isReal(nom) ? nom : isReal(han) ? han : isReal(en) ? en : "";
  }
  return isReal(en) ? en : isReal(nom) ? nom : "";
}

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

  // IME-style candidate popup state (viet-to-nom only).
  const [popupWord, setPopupWord] = useState("");
  const [popupIndex, setPopupIndex] = useState(-1);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(0);
  const popupDebounceRef = useRef(null);
  const popupSeq = useRef(0);
  const popupRef = useRef(null);

  // Clicking anywhere that is not one of the candidate rows closes the popup.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setCandidates([]);
        setPopupWord("");
        setPopupIndex(-1);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Popup is anchored right below the word being typed. A hidden mirror of the
  // textarea measures where the caret is; the popup is placed at the BOTTOM of
  // that text line (line-height below the caret), so it never covers the word.
  const textareaRef = useRef(null);
  const mirrorRef = useRef(null);
  const caretMarkerRef = useRef(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  const lastSpaceIndex = (text) => text.trimEnd().lastIndexOf(" ");

  useEffect(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    const marker = caretMarkerRef.current;
    if (!textarea || !mirror || !marker) return;
    if (candidates.length === 0) return;

    mirror.scrollTop = textarea.scrollTop;
    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();

    const fs = parseFloat(getComputedStyle(textarea).fontSize) || 24;
    const lh = parseFloat(getComputedStyle(textarea).lineHeight) || fs * 1.5;

    // The marker's top sits at the top of the caret's line box. Place the popup
    // below the whole line: caret top + line height + a small gap.
    setPopupPos({
      top: Math.min(markerRect.top - mirrorRect.top + lh + 6, textarea.offsetHeight - 60),
      left: Math.max(markerRect.left - mirrorRect.left, 0),
    });
  }, [candidates, popupWord]);

  // Fetch candidates for every word in parallel, tolerating individual failures
  // so one bad word never blanks the whole translation. A request-sequence guard
  // drops stale responses when the user types again quickly.
  const translateVietToNom = async (text, locked, seq) => {
    if (!text.trim()) { setOutputWords([]); return; }
    setLoading(true);

    const tokens = tokenize(text);
    let wordIndex = 0;
    const results = await Promise.all(
      tokens.map(async (tok) => {
        if (tok.type === "punct") {
          // Render punctuation in its Chinese/full-width form.
          return { type: "punct", value: toChinesePunct(tok.value) };
        }
        if (tok.type === "space") {
          // Spaces are dropped from the output (characters run together);
          // line breaks are preserved as breaks.
          return { type: "space", value: tok.value };
        }

        const i = wordIndex++;
        const word = tok.value;
        // Quốc Âm Tân Tự is always the initial output (rendered with GotichQATT).
        const qatt = wordToQatt(word);

        if (locked[i]) {
          // The user has already chosen a Chữ Nôm character for this word.
          return { type: "word", wordIndex: i, word, qatt, character: locked[i] };
        }

        // character stays null until the user explicitly picks a meaning, so the
        // output keeps showing the QATT representation. (Candidates are fetched
        // on demand by the popup — fetchPopupCandidates — not here.)
        return { type: "word", wordIndex: i, word, qatt, character: null };
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

  // Fetch candidates for the word currently being typed (shown in the popup).
  const fetchPopupCandidates = async (word, index, seq) => {
    if (!word) {
      setCandidates([]);
      return;
    }

    const matches = await fetchReadingMatches(word);

    if (seq !== popupSeq.current) return;
    setCandidates(matches);
    setSelectedCandidate(0);
    setPopupWord(word);
    setPopupIndex(index);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value);

    const wordCount = getWords(value).length;
    const newLocked = Object.fromEntries(
      Object.entries(lockedWords).filter(([i]) => Number(i) < wordCount)
    );
    setLockedWords(newLocked);

    // Main translation (debounced).
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++debounceSeq.current;
    debounceRef.current = setTimeout(() => {
      if (direction === "viet-to-nom") translateVietToNom(value, newLocked, seq);
      else translateNomToViet(value, seq);
    }, 350);

    // Popup candidates for the word being typed (debounced, independent).
    if (direction === "viet-to-nom") {
      // A trailing space means the user moved past the word: close the popup.
      // Backspacing the space re-enters the word, so the fetch below re-opens it.
      if (/\s$/.test(value)) {
        setCandidates([]);
        setPopupWord("");
        setPopupIndex(-1);
      } else {
        const lastIndex = getLastWordIndex(value);
        const lastWord = lastIndex >= 0 ? getWords(value)[lastIndex] : "";

        if (popupDebounceRef.current) clearTimeout(popupDebounceRef.current);
        const popupSeqId = ++popupSeq.current;
        popupDebounceRef.current = setTimeout(() => {
          fetchPopupCandidates(lastWord, lastIndex, popupSeqId);
        }, 250);
      }
    } else {
      setCandidates([]);
      setPopupWord("");
      setPopupIndex(-1);
    }
  };

  // User picks a Chữ Nôm meaning on the input side → the output word changes
  // from its QATT representation to the selected character.
  const applySuggestion = (index, char) => {
    if (!char) return;
    const newLocked = { ...lockedWords, [index]: char };
    setLockedWords(newLocked);
    setOutputWords((prev) =>
      prev.map((w) =>
        w.type === "word" && w.wordIndex === index ? { ...w, character: char } : w
      )
    );
    setCandidates([]);
    setPopupWord("");
    setPopupIndex(-1);
  };

  const handlePopupKeyDown = (e) => {
    if (candidates.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedCandidate((p) => (p + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedCandidate((p) => (p - 1 + candidates.length) % candidates.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const candidate = candidates[selectedCandidate];
      if (candidate && popupIndex >= 0) applySuggestion(popupIndex, candidate.character);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCandidates([]);
      setPopupWord("");
      setPopupIndex(-1);
    } else if (/^[0-9]$/.test(e.key)) {
      const num = e.key === "0" ? 9 : Number(e.key) - 1;
      if (num < candidates.length) {
        e.preventDefault();
        const candidate = candidates[num];
        if (candidate && popupIndex >= 0) applySuggestion(popupIndex, candidate.character);
      }
    }
  };

  const toggleDirection = () => {
    const newDir = direction === "viet-to-nom" ? "nom-to-viet" : "viet-to-nom";
    setDirection(newDir);
    setInputText("");
    setOutputWords([]);
    setLockedWords({});
    setCandidates([]);
    setPopupWord("");
    setPopupIndex(-1);
    setSelectedCandidate(0);
  };

  const showPopup = direction === "viet-to-nom" && candidates.length > 0 && popupWord.trim() !== "";

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
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handlePopupKeyDown}
                placeholder={direction === "viet-to-nom" ? t.typeVietnamese : t.pasteChuNom}
                className="h-65 w-full resize-none rounded-xl border-2 border-[#a00000]/40 bg-white p-4 text-2xl text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a00000]"
              />

              {/* Hidden mirror used to measure the caret position (never visible). */}
              <div
                ref={mirrorRef}
                aria-hidden="true"
                className="pointer-events-none invisible absolute left-0 top-0 w-full overflow-hidden whitespace-pre-wrap break-words rounded-xl border-2 p-4 text-2xl"
              >
                {inputText.slice(0, lastSpaceIndex(inputText) + 1)}
                <span ref={caretMarkerRef} className="font-han">
                  {popupWord || "\u200B"}
                </span>
              </div>

              {/* IME-style candidate popup: anchored right below the typed word. */}
              {showPopup && (
                <div
                  ref={popupRef}
                  className="absolute z-20 overflow-hidden rounded-xl border-2 border-[#a00000]/40 bg-white shadow-lg"
                  style={{ top: popupPos.top, left: popupPos.left, right: 0 }}
                >
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {candidates.map((candidate, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => applySuggestion(popupIndex, candidate.character)}
                          onMouseEnter={() => setSelectedCandidate(i)}
                          className={`flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors ${
                            i === selectedCandidate ? "bg-gray-200" : "hover:bg-gray-100"
                          }`}
                        >
                          <span className="w-4 shrink-0 text-xs font-semibold text-[#a00000]">{i === 9 ? 0 : i + 1}.</span>
                          {isCharacterImage(candidate.character) ? (
                            <img src={candidate.character} alt="" className="h-8 w-8 shrink-0 rounded border border-[#a00000]/30 object-contain bg-white" />
                          ) : (
                            <span className="font-han w-8 shrink-0 text-center text-xl leading-none text-gray-900">
                              {candidate.character}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm italic text-gray-600">{candidate.reading}</span>
                            {candidateDefinition(candidate, language) && (
                              <span className="block truncate text-xs text-gray-500">→ {candidateDefinition(candidate, language)}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
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
                ) : direction === "viet-to-nom" ? (
                  <div className="text-2xl leading-relaxed text-gray-900">
                    {outputWords.map((w, i) => {
                      if (w.type === "space") {
                        // No spaces between characters — only line breaks survive.
                        return /\n/.test(w.value) ? <br key={i} /> : null;
                      }
                      if (w.type === "punct") {
                        return (
                          <span key={i} className="font-han text-2xl leading-none">
                            {w.value}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={i}
                          className={`leading-none ${
                            w.character ? "font-han text-2xl" : "font-qatt text-3xl"
                          }`}
                          title={w.word}
                        >
                          {w.character || w.qatt}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-2xl leading-relaxed text-gray-900">
                    {outputWords.map((w, i) => (
                      <span key={i} className="font-han text-2xl leading-none">
                        {w.reading || w.word}
                      </span>
                    ))}
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
