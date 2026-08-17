const MISSING_DEFINITION = "N/A";
const PLACEHOLDER_DEFINITION = "No definition available";
const PLACEHOLDER_HAN_VIET_DEFINITION = "Chưa có định nghĩa Hán Việt";
const PLACEHOLDER_NOM_DEFINITION = "Chưa có định nghĩa Nôm";
const MISSING_READING = "N/A";

export const SEARCH_FILTERS = [
  "han_viet_reading",
  "nom_reading",
  "definition",
  "han_viet_definition",
  "nom_definition",
];

export const DEFAULT_SEARCH_FILTER = "nom_reading";

export function formatReadingList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return value || "";
}

export function primaryNomReading(char) {
  if (Array.isArray(char?.nom_reading)) return char.nom_reading[0] || "";
  return char?.nom_reading || "";
}

export function primaryHanVietReading(char) {
  if (Array.isArray(char?.han_viet_reading)) return char.han_viet_reading[0] || "";
  return char?.han_viet_reading || "";
}

export function allReadings(char) {
  const han = Array.isArray(char?.han_viet_reading) ? char.han_viet_reading : [];
  const nom = Array.isArray(char?.nom_reading) ? char.nom_reading : [];
  return [...han, ...nom].filter(isRealReading);
}

export function normalizeCharacterQuery(query) {
  return String(query ?? "").trim().normalize("NFC");
}

export function isCharacterGlyphQuery(query) {
  const normalized = normalizeCharacterQuery(query);
  if (!normalized) return false;

  const hasHan =
    /[\u3400-\u9FFF\uF900-\uFAFF]/.test(normalized) || /[\u{20000}-\u{2EBEF}]/u.test(normalized);

  return hasHan && [...normalized].length <= 4;
}

export function characterFieldMatchesQuery(char, query) {
  return normalizeCharacterQuery(char?.character) === normalizeCharacterQuery(query);
}

export function characterGlyphMatchesQuery(char, query) {
  const normalized = normalizeCharacterQuery(query);
  if (!normalized) return false;

  if (characterFieldMatchesQuery(char, query)) {
    return true;
  }

  const variants = Array.isArray(char?.variants) ? char.variants : [];
  return variants.some((variant) => normalizeCharacterQuery(variant) === normalized);
}

export function parseUnicodeQuery(query) {
  const trimmed = String(query ?? "").trim();
  if (/^U\+[0-9A-F]{4,6}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^[0-9A-F]{4,6}$/i.test(trimmed)) {
    return `U+${trimmed.toUpperCase()}`;
  }
  return null;
}

/** Convert a variant token (e.g. "U+5B57" or a raw character) to a normalized U+XXXX unicode string. */
export function variantTokenToUnicode(token) {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) return null;

  if (/^U\+[0-9A-F]{4,6}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const codePoint = trimmed.codePointAt(0);
  if (trimmed.length <= 2 && Number.isInteger(codePoint)) {
    return `U+${codePoint.toString(16).toUpperCase()}`;
  }

  return null;
}

/** Convert a variant token (unicode string or raw character) to its character glyph. */
export function variantTokenToCharacter(token) {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) return null;

  const unicode = variantTokenToUnicode(trimmed);
  if (unicode) {
    const code = Number.parseInt(unicode.slice(2), 16);
    if (!Number.isNaN(code)) {
      return String.fromCodePoint(code);
    }
  }

  return trimmed;
}

export function normalizeReadingForCompare(value) {
  return String(value ?? "").trim().normalize("NFC").toLowerCase();
}

export function isRealReading(value) {
  const text = String(value ?? "").trim();
  return Boolean(text && text !== MISSING_READING);
}

export function readingInColumnMatchesQuery(char, column, query) {
  const normalized = normalizeReadingForCompare(query);
  if (!normalized) return false;

  const readings = Array.isArray(char?.[column]) ? char[column] : [];
  return readings.some(
    (reading) => isRealReading(reading) && normalizeReadingForCompare(reading) === normalized
  );
}

export function readingMatchesQuery(char, query) {
  const normalized = normalizeReadingForCompare(query);
  if (!normalized) return false;

  return allReadings(char).some(
    (reading) => isRealReading(reading) && normalizeReadingForCompare(reading) === normalized
  );
}

/** Admin list search: glyph/unicode exact match, precise reading match when the query is an exact reading somewhere. */
export function adminCharacterMatchesQuery(char, query, { readingMatchExists = false } = {}) {
  const normalized = normalizeCharacterQuery(query);
  if (!normalized) return false;

  const unicodeQuery = parseUnicodeQuery(query);
  if (unicodeQuery) {
    return String(char?.unicode || "").toUpperCase() === unicodeQuery;
  }

  if (isCharacterGlyphQuery(query)) {
    return characterGlyphMatchesQuery(char, query);
  }

  if (characterFieldMatchesQuery(char, query)) return true;

  if (readingMatchExists) {
    return readingMatchesQuery(char, normalized);
  }

  const lowerQuery = normalized.toLowerCase();
  const unicode = String(char?.unicode || "").toLowerCase();
  if (unicode && (unicode === lowerQuery || unicode.includes(lowerQuery))) return true;

  return searchableDefinitions(char).some((definition) => definition.toLowerCase().includes(lowerQuery));
}

export function hanVietReadingMatchesQuery(char, query) {
  return readingInColumnMatchesQuery(char, "han_viet_reading", query);
}

export function nomReadingMatchesQuery(char, query) {
  return readingInColumnMatchesQuery(char, "nom_reading", query);
}

function isSearchableDefinition(value) {
  const text = String(value || "").trim();
  return (
    text &&
    text !== MISSING_DEFINITION &&
    text !== PLACEHOLDER_DEFINITION &&
    text !== PLACEHOLDER_HAN_VIET_DEFINITION &&
    text !== PLACEHOLDER_NOM_DEFINITION
  );
}

export function definitionFieldMatchesQuery(char, field, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;

  const value = char?.[field];
  if (!isSearchableDefinition(value)) return false;

  return String(value).toLowerCase().includes(normalized);
}

export function characterMatchesSearchFilter(char, query, filter) {
  switch (filter) {
    case "han_viet_reading":
      return hanVietReadingMatchesQuery(char, query);
    case "nom_reading":
      return nomReadingMatchesQuery(char, query);
    case "definition":
      return definitionFieldMatchesQuery(char, "definition", query);
    case "han_viet_definition":
      return definitionFieldMatchesQuery(char, "han_viet_definition", query);
    case "nom_definition":
      return definitionFieldMatchesQuery(char, "nom_definition", query);
    default:
      return false;
  }
}

function searchableDefinitions(char) {
  return [char?.definition, char?.han_viet_definition, char?.nom_definition]
    .map((value) => String(value || "").trim())
    .filter(isSearchableDefinition);
}

export function displayDefinition(char, language) {
  if (language === "en") {
    return char?.definition || "";
  }

  const nom = char?.nom_definition?.trim();
  const hanViet = char?.han_viet_definition?.trim();

  if (nom && nom !== PLACEHOLDER_NOM_DEFINITION && nom !== MISSING_DEFINITION) return nom;
  if (hanViet && hanViet !== PLACEHOLDER_HAN_VIET_DEFINITION && hanViet !== MISSING_DEFINITION) return hanViet;
  return char?.definition || "";
}

export function getSortReading(char) {
  const pickFirst = (value) => {
    if (!value || value === MISSING_READING) return "";
    return String(value).split(/[,;|/]/)[0].trim();
  };

  const nom = pickFirst(primaryNomReading(char));
  if (nom) return nom;

  const han = pickFirst(primaryHanVietReading(char));
  if (han) return han;

  return char?.character || char?.unicode || "";
}

export function stripVietnameseTones(value) {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const ALPHABET_FILTER_GROUPS = {
  A: ["a", "ă", "â"],
  Ă: ["ă"],
  Â: ["â"],
  O: ["o", "ô", "ơ"],
  Ô: ["ô"],
  Ơ: ["ơ"],
  U: ["u", "ư"],
  Ư: ["ư"],
  D: ["d", "đ"],
  Đ: ["đ"],
  E: ["e", "ê"],
  Ê: ["ê"],
};

export const VIET_ALPHABET_FILTERS = [
  "A", "Ă", "Â", "B", "C", "D", "Đ", "E", "Ê", "G", "H", "I", "K", "L", "M", "N", "O", "Ô", "Ơ", "P", "Q", "R", "S", "T", "U", "Ư", "V", "X", "Y",
];

export function characterMatchesAlphabetFilter(char, filter) {
  if (!filter || filter === "all") return true;

  const reading = getSortReading(char);
  if (!reading) return false;

  const first = [...reading.normalize("NFC").toLowerCase()][0];
  if (!first) return false;

  const group = ALPHABET_FILTER_GROUPS[filter] || [filter.toLowerCase()];
  return group.includes(first);
}

export function getVietnameseToneOrder(value) {
  if (!value) return 1;

  const syllable = String(value).trim().split(/\s+/)[0];
  const decomposed = [...syllable.normalize("NFD")];

  for (const mark of decomposed) {
    if (mark === "\u0301") return 2; // sắc
    if (mark === "\u0309") return 3; // hỏi
    if (mark === "\u0300") return 4; // huyền
    if (mark === "\u0303") return 5; // ngã
    if (mark === "\u0323") return 6; // nặng
  }

  return 1; // ngang
}

function compareAlphabet(a, b) {
  const readingA = getSortReading(a);
  const readingB = getSortReading(b);
  const baseComparison = stripVietnameseTones(readingA).localeCompare(
    stripVietnameseTones(readingB),
    "vi",
    { sensitivity: "base" }
  );

  if (baseComparison !== 0) return baseComparison;

  return (a.unicode || "").localeCompare(b.unicode || "", "en", { sensitivity: "base" });
}

function compareAlphabetStroke(a, b) {
  const readingA = getSortReading(a);
  const readingB = getSortReading(b);
  const baseComparison = stripVietnameseTones(readingA).localeCompare(
    stripVietnameseTones(readingB),
    "vi",
    { sensitivity: "base" }
  );

  if (baseComparison !== 0) return baseComparison;

  const strokeDiff = (a.stroke_count || 0) - (b.stroke_count || 0);
  if (strokeDiff !== 0) return strokeDiff;

  return (a.unicode || "").localeCompare(b.unicode || "", "en", { sensitivity: "base" });
}

function compareAlphabetToneStroke(a, b) {
  const readingA = getSortReading(a);
  const readingB = getSortReading(b);
  const baseComparison = stripVietnameseTones(readingA).localeCompare(
    stripVietnameseTones(readingB),
    "vi",
    { sensitivity: "base" }
  );

  if (baseComparison !== 0) return baseComparison;

  const toneDiff = getVietnameseToneOrder(readingA) - getVietnameseToneOrder(readingB);
  if (toneDiff !== 0) return toneDiff;

  const strokeDiff = (a.stroke_count || 0) - (b.stroke_count || 0);
  if (strokeDiff !== 0) return strokeDiff;

  return (a.unicode || "").localeCompare(b.unicode || "", "en", { sensitivity: "base" });
}

function compareStroke(a, b) {
  const strokeDiff = (a.stroke_count || 0) - (b.stroke_count || 0);
  if (strokeDiff !== 0) return strokeDiff;

  return compareAlphabet(a, b);
}

function compareTone(a, b) {
  return compareAlphabetToneStroke(a, b);
}

export function compareCharacters(a, b, sortMode = "alphabet") {
  switch (sortMode) {
    case "stroke":
      return compareStroke(a, b);
    case "alphabet-stroke":
      return compareAlphabetStroke(a, b);
    case "alphabet-tone-stroke":
    case "tone":
      return compareAlphabetToneStroke(a, b);
    case "alphabet":
    default:
      return compareAlphabet(a, b);
  }
}

export function sortCharacters(characters, sortMode = "alphabet") {
  return [...(characters || [])].sort((a, b) => compareCharacters(a, b, sortMode));
}

export function isGifImage(value) {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed.endsWith(".gif") || trimmed.includes(".gif?");
}

/** Whether a character row has a usable image URL. */
export function hasCharacterImage(char) {
  return Boolean(char?.image && String(char.image).trim() !== "");
}

export function isAllowedImageFile(file) {
  if (!file) return true;
  if (file.type === "image/gif") return false;
  return !file.name.toLowerCase().endsWith(".gif");
}
