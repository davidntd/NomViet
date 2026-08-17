import { normalizeVariantsToCharacters } from "./variant-sync";

export function normalizeCharacterPayload(body) {
  const strokeCount = Number.parseInt(String(body.stroke_count ?? ""), 10);

  return {
    character: String(body.character ?? "").trim(),
    han_viet_reading: normalizeStringArray(body.han_viet_reading),
    nom_reading: normalizeStringArray(body.nom_reading),
    definition: String(body.definition ?? "").trim(),
    han_viet_definition: String(body.han_viet_definition ?? "").trim(),
    nom_definition: String(body.nom_definition ?? "").trim(),
    stroke_count: Number.isInteger(strokeCount) && strokeCount >= 0 ? strokeCount : 0,
    unicode: String(body.unicode ?? "")
      .trim()
      .toUpperCase(),
    image: body.image ? String(body.image).trim() : null,
    variants: normalizeVariantsToCharacters(normalizeStringArray(body.variants)),
  };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (value == null) {
    return [];
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateCharacterPayload(payload) {
  if (!payload.character) {
    return "Character is required.";
  }

  if (!payload.unicode || !/^U\+[0-9A-F]{4,6}$/.test(payload.unicode)) {
    return "Unicode must look like U+5B57.";
  }

  return null;
}
