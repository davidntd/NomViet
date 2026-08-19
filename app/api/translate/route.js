import { createClient } from "@supabase/supabase-js";
import { formatReadingList } from "../../lib/character";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SELECT_FIELDS =
  "character, han_viet_reading, nom_reading, definition, han_viet_definition, nom_definition";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reading = searchParams.get("reading");
  const character = searchParams.get("character");

  try {
    if (reading) {
      // Match Nôm readings only — Hán Việt readings are not used for
      // translation candidates (they're rarely recognized in modern Vietnamese).
      const { data, error } = await supabase
        .from("Character")
        .select(SELECT_FIELDS)
        .contains("nom_reading", [reading])
        .limit(10);

      if (error) throw error;

      return Response.json({
        results: (data || []).map((row) => ({
          ...row,
          reading: formatReadingList(row.nom_reading),
          definition: row.definition || row.nom_definition,
        })),
      });
    }

    if (character) {
      const { data, error } = await supabase
        .from("Character")
        .select(SELECT_FIELDS)
        .eq("character", character)
        .single();

      if (error) throw error;

      return Response.json({
        result: {
          ...data,
          reading: formatReadingList(data.nom_reading) || formatReadingList(data.han_viet_reading),
        },
      });
    }

    return Response.json({ results: [] });
  } catch (error) {
    console.error("Translate error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
