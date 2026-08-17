import { variantTokenToCharacter, variantTokenToUnicode } from "../../lib/character";

const MISSING_READING = "N/A";
const MISSING_DEFINITION = "N/A";

export function normalizeVariantsToCharacters(variants) {
  return [...new Set((variants || []).map((token) => variantTokenToCharacter(token)).filter(Boolean))];
}

export function variantListToUnicodes(variants) {
  return [
    ...new Set(
      (variants || [])
        .map((token) => variantTokenToUnicode(token))
        .filter(Boolean)
    ),
  ];
}

export function getRemovedVariantUnicodes(previousVariants, nextVariants) {
  const nextSet = new Set(variantListToUnicodes(nextVariants));
  return variantListToUnicodes(previousVariants).filter((unicode) => !nextSet.has(unicode));
}

function normalizeUnicode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function buildGroupMembersFromRows(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row?.unicode) continue;
    map.set(normalizeUnicode(row.unicode), {
      character: row.character,
      unicode: row.unicode,
    });
  }

  return [...map.values()];
}

/** Each member lists every other group member's character glyph (never itself). */
export function buildVariantsForMember(memberRow, groupMembers) {
  return groupMembers
    .filter((member) => normalizeUnicode(member.unicode) !== normalizeUnicode(memberRow.unicode))
    .map((member) => member.character);
}

export function buildVariantSyncPayload(sourcePayload, variantRow, groupMembers) {
  return {
    character: variantRow.character,
    unicode: variantRow.unicode,
    han_viet_reading: [...(sourcePayload.han_viet_reading || [])],
    nom_reading: [...(sourcePayload.nom_reading || [])],
    definition: sourcePayload.definition,
    han_viet_definition: sourcePayload.han_viet_definition,
    nom_definition: sourcePayload.nom_definition,
    stroke_count: variantRow.stroke_count ?? 0,
    image: variantRow.image ?? null,
    variants: buildVariantsForMember(variantRow, groupMembers),
  };
}

function buildRemovedVariantResetPayload(row) {
  return {
    character: row.character,
    unicode: row.unicode,
    han_viet_reading: [MISSING_READING],
    nom_reading: [MISSING_READING],
    definition: MISSING_DEFINITION,
    han_viet_definition: MISSING_DEFINITION,
    nom_definition: MISSING_DEFINITION,
    stroke_count: 0,
    image: null,
    variants: [],
  };
}

async function lookupVariantRows(admin, variantList) {
  const unicodes = [
    ...new Set(
      normalizeVariantsToCharacters(variantList)
        .map((token) => variantTokenToUnicode(token))
        .filter(Boolean)
    ),
  ];

  if (unicodes.length === 0) {
    return [];
  }

  const { data, error } = await admin.from("Character").select("*").in("unicode", unicodes);

  if (error) {
    throw new Error(`Variant sync lookup failed: ${error.message}`);
  }

  return data || [];
}

async function resetRemovedVariantCharacters(admin, removedUnicodes) {
  if (removedUnicodes.length === 0) {
    return [];
  }

  const { data: rows, error } = await admin
    .from("Character")
    .select("*")
    .in("unicode", removedUnicodes);

  if (error) {
    throw new Error(`Removed variant lookup failed: ${error.message}`);
  }

  const reset = [];

  for (const row of rows || []) {
    const { data, error: updateError } = await admin
      .from("Character")
      .update(buildRemovedVariantResetPayload(row))
      .eq("id", row.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`Removed variant reset failed for ${row.unicode}: ${updateError.message}`);
    }

    reset.push(data);
  }

  return reset;
}

async function findParentsReferencingCharacter(admin, row) {
  const lookupTokens = [row.unicode, row.character, variantTokenToCharacter(row.unicode)].filter(Boolean);

  const parents = new Map();

  for (const token of lookupTokens) {
    const { data, error } = await admin.from("Character").select("*").contains("variants", [token]);

    if (error) {
      throw new Error(`Variant parent lookup failed: ${error.message}`);
    }

    for (const parent of data || []) {
      if (parent.id !== row.id) {
        parents.set(parent.id, parent);
      }
    }
  }

  return [...parents.values()];
}

async function syncVariantGroup(admin, sourceRow, sourcePayload, variantList, options = {}) {
  const variantRows = await lookupVariantRows(admin, variantList);
  const groupMembers = buildGroupMembersFromRows([
    sourceRow,
    ...(options.extraTargets || []),
    ...variantRows,
  ]);

  if (groupMembers.length < 2) {
    return [];
  }

  const synced = [];

  for (const row of options.extraTargets || []) {
    const syncPayload = buildVariantSyncPayload(sourcePayload, row, groupMembers);
    const { data, error } = await admin
      .from("Character")
      .update(syncPayload)
      .eq("id", row.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Variant sync failed for ${row.unicode}: ${error.message}`);
    }

    synced.push(data);
  }

  for (const row of variantRows) {
    if (row.id === sourceRow.id) continue;

    const syncPayload = buildVariantSyncPayload(sourcePayload, row, groupMembers);
    const { data, error } = await admin
      .from("Character")
      .update(syncPayload)
      .eq("id", row.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Variant sync failed for ${row.unicode}: ${error.message}`);
    }

    synced.push(data);
  }

  if (options.updateSourceVariants) {
    const variants = buildVariantsForMember(sourceRow, groupMembers);
    const { data, error } = await admin
      .from("Character")
      .update({ variants })
      .eq("id", sourceRow.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Variant sync failed for ${sourceRow.unicode}: ${error.message}`);
    }

    synced.push(data);
  }

  return synced;
}

function dedupeCharactersById(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return [...map.values()];
}

export async function syncAfterAdminUpdate(admin, sourceRow, sourcePayload, previousRow = null) {
  const synced = [];
  const handledParentIds = new Set();

  const normalizedPayload = {
    ...sourcePayload,
    variants: normalizeVariantsToCharacters(sourcePayload.variants),
  };

  if (previousRow?.id === sourceRow.id) {
    const removedUnicodes = getRemovedVariantUnicodes(previousRow.variants, normalizedPayload.variants);
    if (removedUnicodes.length > 0) {
      synced.push(...(await resetRemovedVariantCharacters(admin, removedUnicodes)));
    }
  }

  if (normalizedPayload.variants.length > 0) {
    synced.push(
      ...(await syncVariantGroup(admin, sourceRow, normalizedPayload, normalizedPayload.variants))
    );
  }

  const parents = await findParentsReferencingCharacter(admin, sourceRow);

  for (const parent of parents) {
    if (handledParentIds.has(parent.id)) continue;
    handledParentIds.add(parent.id);

    synced.push(
      ...(await syncVariantGroup(admin, sourceRow, normalizedPayload, parent.variants, {
        extraTargets: [parent],
        updateSourceVariants: true,
      }))
    );
  }

  return dedupeCharactersById(synced);
}
