import { createClient } from "@supabase/supabase-js";
import { formatReadingList } from "../../lib/character";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reading = searchParams.get("reading");
  const character = searchParams.get("character");

  try {
    if (reading) {
      const { data, error } = await supabase
        .from("Character")
        .select("character, han_viet_reading, nom_reading, definition, han_viet_definition, nom_definition")
        .contains("nom_reading", [reading])
        .limit(10);

      if (error) throw error;

      let results = data || [];

      if (results.length === 0) {
        const { data: hanMatches, error: hanError } = await supabase
          .from("Character")
          .select("character, han_viet_reading, nom_reading, definition, han_viet_definition, nom_definition")
          .contains("han_viet_reading", [reading])
          .limit(10);

        if (hanError) throw hanError;
        results = hanMatches || [];
      }

      return Response.json({
        results: results.map((row) => ({
          ...row,
          reading: formatReadingList(row.nom_reading) || formatReadingList(row.han_viet_reading),
          definition: row.definition || row.han_viet_definition || row.nom_definition,
        })),
      });
    }

    if (character) {
      const { data, error } = await supabase
        .from("Character")
        .select("character, han_viet_reading, nom_reading, definition, han_viet_definition, nom_definition")
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
