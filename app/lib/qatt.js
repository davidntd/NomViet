/**
 * Quốc Âm Tân Tự (QATT) conversion for the GotichQATT font.
 *
 * The GotichQATT font (by Nguyễn Nhật Quang) encodes every Vietnamese syllable
 * as a character in the Supplementary Private Use Area (U+100000 … U+105D95).
 * The syllable blocks are laid out as:
 *
 *   Block 4  (base syllables):  U+100568 + syllableIndex * Block 5  (toned syllables): U+100F36 + syllableIndex * 8 + toneSlot
 *
 * where
 *   syllableIndex = initialIndex * 110 + finalIndex
 *
 * The 22 initials ("cán tự") and 110 finals ("chi tự") are the standard QATT
 * inventory (verified against the community's published conversion tables and
 * the original manuscript).
 *
 * Each syllable has 8 tone slots. The slot order follows the order of the
 * standalone tone marks at U+100000–U+100007, which matches the original
 * QATT manuscript (verified directly from the font's composite glyphs:
 * block-5 slot t is built as the base syllable + the mark at U+100000+t):
 *
 *   slot 0  huyền   (grave)      — circle, bottom-left
 *   slot 1  ngã     (tumbling)   — circle, top-left
 *   slot 2  nặng khứ (heavy, open)   — circle, top-right
 *   slot 3  nặng nhập (heavy, checked) — circle, bottom-right
 *   slot 4  ngang   (level)      — stroke, bottom-left
 *   slot 5  hỏi     (asking)     — stroke, top-left
 *   slot 6  sắc khứ  (acute, open)   — stroke, top-right
 *   slot 7  sắc nhập (acute, checked) — stroke, bottom-right
 *
 * Checked syllables (ending in c / ch / p / t) are written in the font using
 * the equivalent nasal final plus the "nhập" slot, e.g. "lúc" = (l, ung, sắc nhập).
 */

// 22 "cán tự" (initial consonants), order matches the font's syllable blocks.
export const QATT_INITIALS = [
  "", "ng", "h", "g", "c", "l", "tr", "đ", "n", "t", "th", "nh", "ch",
  "d", "x", "kh", "s", "r", "m", "b", "v", "ph",
];

// 110 "chi tự" (rhymes), order matches the font's syllable blocks.
export const QATT_FINALS = [
  "oe", "oan", "ung", "uy", "âm",
  "e", "an", "ông", "i", "uâm",
  "oa", "oeng", "oen", "ưa", "em",
  "a", "eng", "en", "ư", "uôm",
  "uê", "uênh", "uơn", "ơ", "ôm",
  "ê", "ênh", "ơn", "uơ", "um",
  "âu", "ưng", "ai", "ưn", "om",
  "uâu", "ooeng", "oai", "ươn", "ơm",
  "ao", "âng", "ay", "ăn", "ươm",
  "oao", "uâng", "oay", "oăn", "uơm",
  "au", "ăng", "ơi", "ân", "êm",
  "oau", "oăng", "uơi", "uân", "im",
  "uông", "iêng", "ia", "ên", "iêm",
  "uưng", "uyêng", "uay", "uên", "am",
  "ương", "anh", "ây", "iên", "oam",
  "ang", "oanh", "uây", "uyên", "ăm",
  "oang", "inh", "ưi", "in", "oăm",
  "ong", "uynh", "ươi", "uyn", "ưm",
  "ô", "ôn", "ôi", "ưu", "ươu",
  "o", "un", "ui", "iu", "iêu",
  "ua", "on", "oi", "êu", "eo",
  "u", "uôn", "uôi", "uêu", "oeo",
];

// Codepoint bases inside the GotichQATT font (verified from the font's cmap).
const BASE_SYLLABLE_CP = 0x100568; // Block 4: plain syllable characters
const TONED_SYLLABLE_CP = 0x100f36; // Block 5: syllable * 8 tone slots

// Vietnamese tone marks (combining diacritics after NFD normalization).
const TONE_MARKS = {
  "\u0301": "sắc", // ́
  "\u0300": "huyền", // `
  "\u0309": "hỏi", // ̉
  "\u0303": "ngã", // ̃
  "\u0323": "nặng", // ̣
};

// Initial candidates tried longest-first (except "g" before "gi" — see below).
// Aliases (gi→d, ngh→ng, gh→g, k/q→c) map to the "cán tự" index that QATT
// uses for that sound.
//
// "g" is tried before "gi": words like "gia", "giếm", "giếng" decompose as
// g + "ia"/"iêm"/"iêng" (the i belongs to the rhyme), while words like
// "giữa", "giòng" (where the i-rhyme does not exist) fall back to gi→d,
// matching the reference table where "gi" is written with the "d" cán tự.
const INITIAL_CANDIDATES = [
  ["ngh", 1],
  ["nh", 11],
  ["ng", 1],
  ["th", 10],
  ["tr", 6],
  ["ch", 12],
  ["ph", 21],
  ["kh", 15],
  ["gh", 3],
  ["gi", 13],
  ["g", 3],
  ["đ", 7],
  ["k", 4],
  ["q", 4],
  ["c", 4],
  ["l", 5],
  ["d", 13],
  ["n", 8],
  ["t", 9],
  ["h", 2],
  ["s", 16],
  ["r", 17],
  ["m", 18],
  ["b", 19],
  ["v", 20],
  ["x", 14],
  ["", 0],
];

// Checked endings: these syllables are written with the "nhập" tone slot and
// the equivalent nasal final (c→ng, ch→nh, p→m, t→n).
const CHECKED_END = /(c|ch|p|t)$/;

/**
 * Convert a nasal/other final to its "nhập" (checked) form:
 * ng→c, nh→ch, m→p, n→t. Used both to recognise checked syllables and to
 * match them back to the base final in the finals list.
 */
export function qattNhapFinal(final) {
  return final
    .replace(/ng$/, "c")
    .replace(/nh$/, "ch")
    .replace(/m$/, "p")
    .replace(/n$/, "t");
}

/**
 * Detect the Vietnamese tone of a syllable.
 * @returns {"ngang"|"sắc"|"huyền"|"hỏi"|"ngã"|"nặng"}
 */
export function detectTone(word) {
  for (const ch of word.normalize("NFD")) {
    const tone = TONE_MARKS[ch];
    if (tone) return tone;
  }
  return "ngang";
}

/** Remove the tone diacritic from a syllable, keeping base vowels (a, ă, â, ê, ô, ơ, ư …). */
export function stripTone(word) {
  return word
    .normalize("NFD")
    .replace(/[\u0301\u0300\u0309\u0303\u0323]/g, "")
    .normalize("NFC");
}

/**
 * Match a base rhyme (no tone marks) against the finals list.
 * @returns {{index: number, checked: boolean} | null}
 */
function matchFinal(baseRest) {
  const direct = QATT_FINALS.indexOf(baseRest);
  if (direct !== -1) return { index: direct, checked: false };

  if (CHECKED_END.test(baseRest)) {
    for (let k = 0; k < QATT_FINALS.length; k++) {
      if (qattNhapFinal(QATT_FINALS[k]) === baseRest) {
        return { index: k, checked: true };
      }
    }
  }
  return null;
}

/**
 * Decompose a single Vietnamese syllable into (initial, final, tone) and map
 * it to its tone slot.
 * @returns {{initial: number, final: number, checked: boolean, tone: string, slot: number, syllableIndex: number} | null}
 */
export function decomposeSyllable(word) {
  const nfd = word.normalize("NFD").toLowerCase();
  const tone = detectTone(nfd);
  const base = stripTone(nfd);

  const tryInitial = (initStr, initIdx) => {
    if (!base.startsWith(initStr)) return null;
    const rest = base.slice(initStr.length);
    if (!rest) return null;
    const m = matchFinal(rest);
    if (!m) return null;
    return buildResult(initIdx, m.index, m.checked, tone);
  };

  for (const [initStr, initIdx] of INITIAL_CANDIDATES) {
    const r = tryInitial(initStr, initIdx);
    if (r) return r;
  }

  // "qu" fallback: when q + "u…" fails to match a final (e.g. "quan", "quen"),
  // treat "qu" as the initial so the remaining rhyme can still be matched.
  if (base.startsWith("qu")) {
    const rest = base.slice(2);
    if (rest) {
      const m = matchFinal(rest);
      if (m) return buildResult(4, m.index, m.checked, tone);
    }
  }

  return null;
}

function buildResult(initial, final, checked, tone) {
  const syllableIndex = initial * QATT_FINALS.length + final;
  return {
    initial,
    final,
    checked,
    tone,
    slot: toneSlot(tone, checked),
    syllableIndex,
  };
}

/**
 * Map a tone (and whether the syllable is checked) to the 8-slot index of the
 * GotichQATT font. The slot order matches the standalone tone marks
 * (U+100000–U+100007) and the original manuscript, NOT the common
 * "ngang-first" ordering.
 */
export function toneSlot(tone, checked = false) {
  switch (tone) {
    case "ngang":
      return 4;
    case "huyền":
      return 0;
    case "ngã":
      return 1;
    case "nặng":
      return checked ? 3 : 2;
    case "hỏi":
      return 5;
    case "sắc":
      return checked ? 7 : 6;
    default:
      return 4;
  }
}

/**
 * The QATT character (PUA codepoint) for a decomposed syllable.
 * @param {{syllableIndex: number, slot: number}} syllable
 */
export function qattCharForSyllable(syllable) {
  return String.fromCodePoint(TONED_SYLLABLE_CP + syllable.syllableIndex * 8 + syllable.slot);
}

/** The plain (no tone mark) QATT character for a decomposed syllable. */
export function qattPlainChar(syllableIndex) {
  return String.fromCodePoint(BASE_SYLLABLE_CP + syllableIndex);
}

/**
 * Best-effort fallback: map a letter that has no Vietnamese syllable to the
 * closest Vietnamese syllable (letter names / sounds), so any input can still
 * be rendered phonetically in QATT.
 */
export const LETTER_FALLBACK = {
  a: "a", ă: "ă", â: "â", e: "e", ê: "ê", i: "i", o: "o", ô: "ô", ơ: "ơ",
  u: "u", ư: "ư", y: "i",
  b: "bê", c: "xê", d: "dê", đ: "đê", g: "gờ", h: "hờ", k: "ca",
  l: "lờ", m: "mờ", n: "nờ", p: "bê", q: "cu", r: "rờ", s: "sờ",
  t: "tê", v: "vê", x: "xờ", f: "phờ", j: "dờ", w: "vê", z: "dờ",
};

/**
 * Convert a word to its QATT representation.
 * @returns {string} The QATT characters (PUA codepoints). Falls back
 *                   letter-by-letter when the word is not a Vietnamese syllable.
 */
export function wordToQatt(word) {
  if (!word) return "";

  const decomposed = decomposeSyllable(word);
  if (decomposed) return qattCharForSyllable(decomposed);

  // Not a recognised Vietnamese syllable — represent it phonetically,
  // letter by letter.
  let out = "";
  for (const letter of word) {
    const fallback = LETTER_FALLBACK[letter.toLowerCase()];
    if (!fallback) {
      out += letter;
      continue;
    }
    const d = decomposeSyllable(fallback);
    if (d) out += qattCharForSyllable(d);
  }
  return out;
}

/**
 * Convert a whole piece of Vietnamese text to QATT, preserving spaces and
 * punctuation.
 */
export function vietnameseToQatt(text) {
  if (!text) return "";
  // Split into words (letters incl. Vietnamese diacritics) and everything else.
  const tokens = String(text).match(/[\p{L}\p{M}]+|[^\p{L}\p{M}]/gu) || [];
  return tokens.map((tok) => (/^[\p{L}\p{M}]+$/u.test(tok) ? wordToQatt(tok) : tok)).join("");
}

/** True when a character lives in the GotichQATT font's PUA range. */
export function isQattChar(ch) {
  const cp = ch.codePointAt(0);
  return cp >= 0x100000 && cp <= 0x105d95;
}
