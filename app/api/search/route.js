import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  DEFAULT_SEARCH_FILTER,
  SEARCH_FILTERS,
  characterMatchesSearchFilter,
  isCharacterGlyphQuery,
  normalizeCharacterQuery,
  readingInColumnMatchesQuery,
  sortCharacters,
} from "../../lib/character";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PAGE_SIZE = 1000;
// Cap the number of rows returned to the client — the UI paginates locally
// (10 per tab), so returning every match for a broad query (e.g. 10k rows for
// a common definition) wastes bandwidth, memory, and render time.
const MAX_RESULTS = 400;
const DEFINITION_FILTERS = new Set(["definition", "han_viet_definition", "nom_definition"]);
const READING_FILTERS = new Set(["han_viet_reading", "nom_reading"]);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const filter = searchParams.get("filter") || DEFAULT_SEARCH_FILTER;

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (!SEARCH_FILTERS.includes(filter)) {
    return NextResponse.json({ error: "Invalid search filter" }, { status: 400 });
  }

  try {
    if (isCharacterGlyphQuery(query)) {
      const glyphMatches = await fetchCharactersByGlyph(query);

      if (glyphMatches.length === 1) {
        return NextResponse.json({
          redirect: `/character/${glyphMatches[0].id}`,
        });
      }

      if (glyphMatches.length > 1) {
        return NextResponse.json({
          results: sortCharacters(glyphMatches, "alphabet-tone-stroke").slice(0, MAX_RESULTS),
          filter,
        });
      }
    }

    let rows = [];

    if (DEFINITION_FILTERS.has(filter)) {
      rows = await fetchCharactersByDefinition(filter, query);
    } else if (READING_FILTERS.has(filter)) {
      rows = await fetchCharactersByReading(filter, query);
    }

    const filtered = rows.filter((row) => characterMatchesSearchFilter(row, query, filter));
    const sorted = sortCharacters(filtered, "alphabet-tone-stroke");

    return NextResponse.json({ results: sorted.slice(0, MAX_RESULTS), filter });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

async function fetchCharactersByGlyph(query) {
  const normalized = normalizeCharacterQuery(query);
  const matches = new Map();

  const { data: byCharacter, error: characterError } = await supabase
    .from("Character")
    .select("*")
    .eq("character", normalized);

  if (characterError) {
    throw characterError;
  }

  for (const row of byCharacter || []) {
    matches.set(row.id, row);
  }

  const { data: byVariant, error: variantError } = await supabase
    .from("Character")
    .select("*")
    .contains("variants", [normalized]);

  if (variantError) {
    throw variantError;
  }

  for (const row of byVariant || []) {
    matches.set(row.id, row);
  }

  return [...matches.values()];
}

async function fetchCharactersByReading(column, reading) {
  const rpcRows = await fetchCharactersByReadingRpc(column, reading);
  if (rpcRows !== null) {
    return rpcRows;
  }

  return fetchCharactersByReadingContains(column, reading);
}

async function fetchCharactersByReadingRpc(column, reading) {
  try {
    const { data, error } = await supabase.rpc("search_characters_by_reading", {
      p_column: column,
      p_query: reading.trim(),
    });

    if (error) {
      if (/search_characters_by_reading|function .* does not exist/i.test(error.message || "")) {
        return null;
      }
      throw error;
    }

    return data || [];
  } catch (error) {
    if (/search_characters_by_reading|function .* does not exist/i.test(error.message || "")) {
      return null;
    }
    throw error;
  }
}

// PostgREST array-containment fallback used when the search_characters_by_reading
// RPC has not been created in the database. Readings are stored lowercase, so
// the query is normalized before matching. The client-side filter in GET()
// still applies the case-insensitive comparison for defense.
async function fetchCharactersByReadingContains(column, reading) {
  const normalized = String(reading).trim().toLowerCase();
  if (!normalized) return [];

  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("Character")
      .select("*")
      .contains(column, [normalized])
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    rows.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchCharactersByDefinition(column, query) {
  const rows = [];
  const pattern = `%${escapeIlikePattern(query)}%`;

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from("Character").select("*").ilike(column, pattern).range(from, to);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    rows.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function escapeIlikePattern(value) {
  return String(value).replace(/[%_\\]/g, "\\$&");
}
