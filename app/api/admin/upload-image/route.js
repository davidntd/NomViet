import { NextResponse } from "next/server";
import { createAdminClient } from "../../../admin/_lib/supabase-admin";
import { isAllowedImageFile, isGifImage } from "../../../lib/character";
import { requireAuthenticatedUser } from "../../../admin/_lib/auth-guard";

export const maxDuration = 60;

const BUCKET_ID = "characters";

async function ensureCharactersBucket(admin) {
  const { data: buckets, error } = await admin.storage.listBuckets();

  if (error) {
    throw new Error(`Could not list storage buckets: ${error.message}`);
  }

  if (buckets?.some((bucket) => bucket.id === BUCKET_ID)) {
    return;
  }

  const { error: createError } = await admin.storage.createBucket(BUCKET_ID, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"],
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Could not create "${BUCKET_ID}" storage bucket: ${createError.message}`);
  }
}

export async function POST(request) {
  try {
    const { user: adminUser, status: authStatus } = await requireAuthenticatedUser();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: authStatus });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    if (!isAllowedImageFile(file)) {
      return NextResponse.json(
        { error: "GIF images are not allowed. Use PNG, JPG, WEBP, or SVG." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    await ensureCharactersBucket(admin);

    const safeName = String(file.name || "image").replace(/[^\w.-]+/g, "_");
    const fileName = `${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage.from(BUCKET_ID).upload(fileName, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json(
        { error: `Image upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage.from(BUCKET_ID).getPublicUrl(fileName);
    const url = urlData.publicUrl;

    if (isGifImage(url)) {
      await admin.storage.from(BUCKET_ID).remove([fileName]);
      return NextResponse.json({ error: "GIF images are not allowed." }, { status: 400 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Admin upload-image error:", error);
    return NextResponse.json(
      { error: error.message || "Image upload failed." },
      { status: 500 }
    );
  }
}
