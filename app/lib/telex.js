/**
 * Pure Vietnamese Telex input-method engine.
 *
 * Works with the device's own keyboard: while Telex mode is on, typing
 * plain letters composes Vietnamese the way Vietnamese IMEs do:
 *   - absolute vowel pairs:  aa→â  aw→ă  ee→ê  oo→ô  ow→ơ  uw→ư  dd→đ
 *   - relative pairs:        ie→iê  ye→yê  uo→ươ  (at the end of the word
 *                            being typed; "uoo" → "uô" disambiguates muôn
 *                            from mươn, "iee" absorbs the extra e)
 *   - tone keys:    s→sắc  f→huyền  r→hỏi  x→ngã  j→nặng  (applied to the
 *                   main vowel of the word being typed; the key is not
 *                   inserted as a letter; typing the same tone key toggles
 *                   the tone off)
 *   - backspace undoes the tone before deleting the letter
 *
 * Tone placement follows the standard Vietnamese rule (âm chính), see
 * findTonePositionInWord. A "u" directly after "q" is treated as part of
 * the "qu" consonant cluster, not a vowel (quá, quý, quốc).
 */

const TONE_MARKS_RE = /[\u0300\u0301\u0303\u0309\u0323]/g;

const TONE_KEYS = {
  s: "\u0301", // sắc
  f: "\u0300", // huyền
  r: "\u0309", // hỏi
  x: "\u0303", // ngã
  j: "\u0323", // nặng
};

const PAIR_MAP = {
  aa: "â",
  aw: "ă",
  ee: "ê",
  oo: "ô",
  ow: "ơ",
  uw: "ư",
  dd: "đ",
  ie: "iê",
  ye: "yê",
  uo: "ươ",
};

/** Base letter of a character with tone marks stripped (ư → u, ơ → o, ấ → a…). */
function baseOf(char) {
  return (char.normalize("NFD").replace(TONE_MARKS_RE, "")[0] || "").toLowerCase();
}

function isVowelChar(char) {
  return /[aeiouy]/.test(baseOf(char));
}

/**
 * Index (within `word`) of the vowel that carries the tone, per the standard
 * Vietnamese tone-placement rule (âm chính):
 *  - "u" right after "q" is a consonant (quá → a, quý → y)
 *  - one vowel → itself
 *  - ends in i/y → the vowel before the final i/y (tài, hỏi, bưởi, thủy)
 *  - iêu/yêu → the middle ê (yếu, iếu)
 *  - uyu → the middle y (khuỷu)
 *  - ends in u → the first vowel (sáu, cầu, cứu, ríu)
 *  - ia/ua/ưa → the first vowel (chìa, của, cửa)
 *  - yê (as in quyên, yến) → the ê
 *  - starts with i/u/o → the last vowel (tiếng, nước, muốn, toán, quyền)
 *  - otherwise → the first vowel (áo, béo, hòa)
 */
export function findTonePositionInWord(word) {
  const positions = [];
  for (let i = 0; i < word.length; i += 1) {
    if (isVowelChar(word[i])) {
      // "u" immediately after "q" is part of the "qu" consonant cluster.
      if (baseOf(word[i]) === "u" && i > 0 && word[i - 1].toLowerCase() === "q") continue;
      positions.push(i);
    }
  }
  // An "i" right after a leading "g" is part of the "gi" consonant cluster
  // (giữa, giả, giáo) — unless it is the only vowel (gì, gí).
  if (positions.length >= 2 && positions[0] === 1 && word[0].toLowerCase() === "g" && baseOf(word[1]) === "i") {
    positions.shift();
  }
  if (positions.length === 0) return -1;
  if (positions.length === 1) return positions[0];

  const last = positions.length - 1;
  const firstBase = baseOf(word[positions[0]]);
  const lastBase = baseOf(word[positions[last]]);

  if (/[iy]/.test(lastBase)) {
    // Closed "uy"/"ui" syllables put the tone on the final i/y (suýt, huýt,
    // tuýt), while open ones keep it on the u (thủy, Thúy).
    if (
      positions.length === 2 &&
      baseOf(word[positions[0]]) === "u" &&
      !isVowelChar(word[word.length - 1])
    ) {
      return positions[last];
    }
    return positions[last - 1];
  }
  if (positions.length === 3 && /[iy]/.test(firstBase) && lastBase === "u") return positions[1]; // iêu/yêu
  if (positions.length === 3 && firstBase === "u" && lastBase === "u") return positions[1]; // uyu
  if (lastBase === "u") return positions[0];
  if (
    positions.length === 2 &&
    /[iu]/.test(firstBase) &&
    word[positions[1]].normalize("NFD").replace(TONE_MARKS_RE, "") === "a"
  ) {
    return positions[0]; // ia/ua (plain a only — not â/ă: thuật, xuất)
  }
  if (positions.length === 2 && firstBase === "y" && lastBase === "e") return positions[1]; // quyên, yến
  if (/[iuo]/.test(firstBase)) return positions[last];
  return positions[0];
}

function applyToneToWord(word, mark) {
  const position = findTonePositionInWord(word);
  if (position === -1) return null;

  const decomposed = word[position].normalize("NFD");
  const base = decomposed.replace(TONE_MARKS_RE, "");
  const composed = (base + mark).normalize("NFC");
  return word.slice(0, position) + composed + word.slice(position + 1);
}

/** Compose the current word with a freshly typed character; returns the new word. */
export function telexComposeWord(word, char) {
  const lower = char.toLowerCase();

  // Tone key — only lowercase; only when the word has a vowel to tone.
  if (TONE_KEYS[lower] && char === lower) {
    const position = findTonePositionInWord(word);
    if (position === -1) return word + char; // no vowel → it's an ordinary letter

    const mark = TONE_KEYS[lower];
    const existing = word[position].normalize("NFD").match(TONE_MARKS_RE)?.[0] || "";

    if (existing === mark) {
      // Same tone pressed again → toggle it off ("bá" + s → "ba").
      const base = word[position].normalize("NFD").replace(TONE_MARKS_RE, "");
      return word.slice(0, position) + base.normalize("NFC") + word.slice(position + 1);
    }
    return applyToneToWord(word, mark) ?? word + char;
  }

  // "ươ" + o → "uô": disambiguates muôn (muoon) from mươn (muon).
  if (lower === "o" && word.endsWith("ươ")) {
    return word.slice(0, -2) + "uô";
  }
  // "iê"/"yê" + e → the extra e is absorbed ("tiee" → "tiê").
  if (lower === "e" && (word.endsWith("iê") || word.endsWith("yê"))) {
    return word;
  }

  // Vowel-pair composition (aa, aw, ee, oo, ow, uw, dd, ie, ye, uo).
  // Case-insensitive on the input so "Dd" composes to "Đ" like "dd" does.
  const lastChar = word[word.length - 1] || "";
  const replacement = PAIR_MAP[(lastChar + lower).toLowerCase()];
  if (replacement) {
    const cased = lastChar === lastChar.toUpperCase() ? replacement.toUpperCase() : replacement;
    return word.slice(0, -1) + cased;
  }

  return word + char;
}

/**
 * Insert a typed character at the caret position of a full input value,
 * composing only the word being typed. Returns the new value and caret.
 */
export function telexInsert(text, start, end, char) {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const match = before.match(/(\S*)$/);
  const wordStart = match ? match.index : before.length;
  const word = match ? match[0] : "";
  const nextWord = telexComposeWord(word, char);
  return {
    value: before.slice(0, wordStart) + nextWord + after,
    caret: wordStart + nextWord.length,
  };
}

/**
 * Backspace: with a selection, delete the selection; otherwise delete the
 * character before the caret. (Tone-undo is handled separately by
 * telexUndoTone so it only fires when the last keystroke was a tone key.)
 */
export function telexBackspace(text, start, end) {
  if (start !== end) {
    return { value: text.slice(0, start) + text.slice(end), caret: start };
  }
  if (start === 0) return { value: text, caret: 0 };
  return { value: text.slice(0, start - 1) + text.slice(start), caret: start - 1 };
}

/**
 * Undo the tone on the main vowel of the word being typed ("nước" + ⌫ → "nươc"
 * when the tone was the last keystroke). No-op if the word has no tone.
 */
export function telexUndoTone(text, start) {
  const before = text.slice(0, start);
  const after = text.slice(start);
  const match = before.match(/(\S*)$/);
  const wordStart = match ? match.index : before.length;
  const word = match ? match[0] : "";
  const position = findTonePositionInWord(word);
  if (position === -1) return { value: text, caret: start };

  const index = wordStart + position;
  const nfd = text[index].normalize("NFD");
  if (!nfd.match(TONE_MARKS_RE)) return { value: text, caret: start };

  const base = nfd.replace(TONE_MARKS_RE, "").normalize("NFC");
  return { value: text.slice(0, index) + base + text.slice(index + 1), caret: start };
}
