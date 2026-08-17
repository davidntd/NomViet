import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const strokes = parseInt(searchParams.get("strokes") || "0");

  if (!strokes) return NextResponse.json({ results: [] });

  // Candidate pool: stroke counts within ±RANGE of the drawn count, sampled
  // per bucket so shape ranking (client-side, canvas glyph rasterization) can
  // override the drawn count. The exact-count bucket gets the most candidates
  // — it most often holds the target — and small buckets are fetched whole.
  const COLS =
    "id,character,unicode,stroke_count,nom_reading,han_viet_reading,definition,nom_definition,han_viet_definition,image,variants";
  const RANGE = 5;
  // Cap per bucket, indexed by distance from the drawn count (0 = exact match).
  const BUCKET_CAPS = [300, 120, 80, 60, 50, 40];
  const MAX_CANDIDATES = 1000;

  try {
    const buckets = [strokes];
    for (let d = 1; d <= RANGE; d += 1) {
      buckets.push(strokes - d, strokes + d);
    }

    const requests = buckets.map((count, index) => {
      if (count < 0) return null;
      const cap = BUCKET_CAPS[Math.ceil(index / 2)] ?? BUCKET_CAPS[BUCKET_CAPS.length - 1];
      return supabase
        .from("Character")
        .select(COLS)
        .eq("stroke_count", count)
        .limit(cap);
    });

    const responses = await Promise.all(requests.filter(Boolean));
    const collected = [];
    for (const { data, error } of responses) {
      if (error) throw error;
      collected.push(...(data || []));
    }

    // Fallback ordering by stroke-count closeness; the client re-ranks by
    // shape similarity first, then uses this closeness to break ties.
    const sorted = collected.sort(
      (a, b) =>
        Math.abs(a.stroke_count - strokes) - Math.abs(b.stroke_count - strokes)
    );

    return NextResponse.json({ results: sorted.slice(0, MAX_CANDIDATES) });
  } catch (error) {
    console.error("Draw search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}