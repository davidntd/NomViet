import { NextResponse } from "next/server";
import { createAdminClient } from "../../../admin/_lib/supabase-admin";
import { normalizeCharacterPayload, validateCharacterPayload } from "../../../admin/_lib/character-payload";
import { syncAfterAdminUpdate } from "../../../admin/_lib/variant-sync";
import { requireAuthenticatedUser } from "../../../admin/_lib/auth-guard";

export const maxDuration = 60;

async function updateCharacter(admin, id, payload) {
  const { data: previousRow, error: previousError } = await admin
    .from("Character")
    .select("*")
    .eq("id", id)
    .single();

  if (previousError) {
    throw new Error(previousError.message);
  }

  const { data, error } = await admin
    .from("Character")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const syncedVariants = await syncAfterAdminUpdate(admin, data, payload, previousRow);

  return { character: data, syncedVariants };
}

export async function POST(request) {
  try {
    const { user: adminUser, status: authStatus } = await requireAuthenticatedUser();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authStatus });
    }

    const admin = createAdminClient();
    const body = await request.json();
    const payload = normalizeCharacterPayload(body);
    const validationError = validateCharacterPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await admin.from("Character").insert(payload).select("*").single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let syncedVariants = [];
    syncedVariants = await syncAfterAdminUpdate(admin, data, payload);

    return NextResponse.json({ character: data, syncedVariants });
  } catch (error) {
    console.error("Admin create character error:", error);
    return NextResponse.json({ error: error.message || "Create failed" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { user: adminUser, status: authStatus } = await requireAuthenticatedUser();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authStatus });
    }

    const admin = createAdminClient();
    const body = await request.json();
    const id = Number.parseInt(String(body.id ?? ""), 10);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Valid character id is required." }, { status: 400 });
    }

    const payload = normalizeCharacterPayload(body);
    const validationError = validateCharacterPayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { character, syncedVariants } = await updateCharacter(admin, id, payload);

    return NextResponse.json({ character, syncedVariants });
  } catch (error) {
    console.error("Admin update character error:", error);
    return NextResponse.json({ error: error.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { user: adminUser, status: authStatus } = await requireAuthenticatedUser();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authStatus });
    }

    const admin = createAdminClient();
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((value) => Number.parseInt(String(value), 10)).filter((value) => Number.isInteger(value) && value > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "At least one character id is required." }, { status: 400 });
    }

    const { error, count } = await admin.from("Character").delete({ count: "exact" }).in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: count ?? ids.length });
  } catch (error) {
    console.error("Admin delete character error:", error);
    return NextResponse.json({ error: error.message || "Delete failed" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { user: adminUser, status: authStatus } = await requireAuthenticatedUser();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authStatus });
    }

    const admin = createAdminClient();
    const body = await request.json();
    const items = Array.isArray(body.characters) ? body.characters : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "At least one character update is required." }, { status: 400 });
    }

    const characters = [];
    const syncedVariants = [];
    const errors = [];

    for (const item of items) {
      const id = Number.parseInt(String(item.id ?? ""), 10);

      if (!Number.isInteger(id) || id <= 0) {
        errors.push({ id: item.id ?? null, error: "Valid character id is required." });
        continue;
      }

      const payload = normalizeCharacterPayload(item);
      const validationError = validateCharacterPayload(payload);

      if (validationError) {
        errors.push({ id, error: validationError });
        continue;
      }

      try {
        const result = await updateCharacter(admin, id, payload);
        characters.push(result.character);
        syncedVariants.push(...result.syncedVariants);
      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    return NextResponse.json({
      updated: characters.length,
      characters,
      syncedVariants: syncedVariants.length,
      errors,
    });
  } catch (error) {
    console.error("Admin batch update character error:", error);
    return NextResponse.json({ error: error.message || "Batch update failed" }, { status: 500 });
  }
}
