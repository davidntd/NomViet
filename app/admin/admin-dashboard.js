"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "../lib/supabase-client";
import {
  formatReadingList,
  adminCharacterMatchesQuery,
  readingMatchesQuery,
  characterMatchesAlphabetFilter,
  VIET_ALPHABET_FILTERS,
  isAllowedImageFile,
  isGifImage,
  sortCharacters,
} from "../lib/character";

const emptyForm = {
  character: "",
  han_viet_reading: "",
  nom_reading: "",
  definition: "",
  han_viet_definition: "",
  nom_definition: "",
  stroke_count: "",
  unicode: "",
  image: "",
  variants: "",
};

const TABLE_FIELDS = [
  { key: "character", label: "Character", className: "min-w-[4rem] font-han" },
  { key: "han_viet_reading", label: "Hán Việt", className: "min-w-[8rem]" },
  { key: "nom_reading", label: "Nôm", className: "min-w-[8rem]" },
  { key: "definition", label: "English Def.", className: "min-w-[10rem]" },
  { key: "han_viet_definition", label: "HV Def.", className: "min-w-[10rem]" },
  { key: "nom_definition", label: "Nôm Def.", className: "min-w-[10rem]" },
  { key: "stroke_count", label: "Strokes", className: "min-w-[4.5rem]" },
  { key: "unicode", label: "Unicode", className: "min-w-[6rem] font-mono text-xs" },
  { key: "image", label: "Image URL", className: "min-w-[10rem]" },
  { key: "variants", label: "Variants", className: "min-w-[8rem]" },
];

const FORM_FIELDS = [
  { name: "character", label: "Character", placeholder: "𬙞", required: true },
  { name: "han_viet_reading", label: "Hán Việt Reading", placeholder: "thất (comma separated)", required: false },
  { name: "nom_reading", label: "Nôm Reading", placeholder: "bảy, bay (comma separated)", required: false },
  { name: "definition", label: "English Definition", placeholder: "number seven", required: false },
  { name: "han_viet_definition", label: "Hán Việt Definition", placeholder: "số bảy (Hán Việt)", required: false },
  { name: "nom_definition", label: "Nôm Definition", placeholder: "số bảy (Nôm)", required: false },
  { name: "stroke_count", label: "Stroke Count", placeholder: "12", type: "number", required: true },
  { name: "unicode", label: "Unicode", placeholder: "U+2C65E", required: true },
  { name: "variants", label: "Variants / Forms", placeholder: "Alternate forms as characters, comma separated", required: false },
];

const ITEMS_PER_PAGE = 50;

function characterToDraft(char) {
  return {
    character: char.character || "",
    han_viet_reading: formatReadingList(char.han_viet_reading),
    nom_reading: formatReadingList(char.nom_reading),
    definition: char.definition || "",
    han_viet_definition: char.han_viet_definition || "",
    nom_definition: char.nom_definition || "",
    stroke_count: String(char.stroke_count ?? ""),
    unicode: char.unicode || "",
    image: char.image || "",
    variants: char.variants?.join(", ") || "",
  };
}

function draftToPayload(draft) {
  return {
    character: draft.character.trim(),
    han_viet_reading: draft.han_viet_reading.split(",").map((r) => r.trim()).filter(Boolean),
    nom_reading: draft.nom_reading.split(",").map((r) => r.trim()).filter(Boolean),
    definition: draft.definition.trim(),
    han_viet_definition: draft.han_viet_definition.trim(),
    nom_definition: draft.nom_definition.trim(),
    stroke_count: Number.parseInt(draft.stroke_count, 10) || 0,
    unicode: draft.unicode.trim().toUpperCase(),
    image: draft.image.trim() || null,
    variants: draft.variants ? draft.variants.split(",").map((v) => v.trim()).filter(Boolean) : [],
  };
}

function draftsEqual(a, b) {
  return TABLE_FIELDS.every(({ key }) => String(a[key] ?? "") === String(b[key] ?? ""));
}

function getChangedFields(base, draft) {
  return TABLE_FIELDS.filter(({ key }) => String(base[key] ?? "") !== String(draft[key] ?? ""));
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Server returned invalid JSON (HTTP ${response.status}).`);
    }
  }

  if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
    if (response.status === 404) {
      throw new Error(
        "API route not found (HTTP 404). Restart the dev server with npm run dev."
      );
    }

    throw new Error(
      `Server returned an HTML error page (HTTP ${response.status}). This often means the request timed out or the dev server needs a restart. Try saving one row at a time.`
    );
  }

  throw new Error(`Unexpected server response (HTTP ${response.status}): ${text.slice(0, 120)}`);
}

async function uploadAdminImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Image upload failed");
  return data.url;
}

function getImageFileFromClipboard(e) {
  const items = e.clipboardData?.items;
  if (!items?.length) return null;

  for (const item of items) {
    if (!item.type.startsWith("image/")) continue;
    if (item.type === "image/gif") {
      return { error: "GIF images are not allowed. Use PNG, JPG, WEBP, or SVG." };
    }
    const blob = item.getAsFile();
    if (!blob) continue;
    const extension = item.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const file = new File([blob], `pasted-${Date.now()}.${extension}`, { type: item.type });
    if (!isAllowedImageFile(file)) {
      return { error: "GIF images are not allowed. Use PNG, JPG, WEBP, or SVG." };
    }
    return { file };
  }

  return null;
}

function AddCharacterModal({
  open,
  onClose,
  onSaved,
  adminCharacterRequest,
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [imageMode, setImageMode] = useState("url");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      // Deferred out of the synchronous effect body (React's set-state-in-effect rule).
      const id = setTimeout(() => {
        setForm(emptyForm);
        setImageMode("url");
        setImageFile(null);
      }, 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!imageFile) {
      const id = setTimeout(() => setImagePreviewUrl(null), 0);
      return () => clearTimeout(id);
    }
    const url = URL.createObjectURL(imageFile);
    const id = setTimeout(() => setImagePreviewUrl(url), 0);
    return () => {
      clearTimeout(id);
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  if (!open) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const assignImageFile = (file) => {
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!isAllowedImageFile(file)) {
      alert("GIF images are not allowed. Use PNG, JPG, WEBP, or SVG.");
      return;
    }
    setImageMode("file");
    setForm((prev) => ({ ...prev, image: "" }));
    setImageFile(file);
  };

  const handleImagePaste = (e) => {
    const result = getImageFileFromClipboard(e);
    if (!result) return;
    if (result.error) {
      e.preventDefault();
      alert(result.error);
      return;
    }
    e.preventDefault();
    assignImageFile(result.file);
  };

  const uploadImage = async () => {
    if (!imageFile) return form.image;
    return uploadAdminImage(imageFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const imageUrl = imageMode === "file" ? await uploadImage() : form.image.trim();
      if (imageUrl && isGifImage(imageUrl)) throw new Error("GIF image URLs are not allowed.");

      await adminCharacterRequest("POST", { ...draftToPayload(form), image: imageUrl || null });
      onSaved();
      onClose();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-3 border-[#d4b96a] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#a00000]">Add New Character</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {FORM_FIELDS.map((field) => (
            <div key={field.name}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-[#a00000]">
                {field.label}
                {field.required && <span className="ml-1 text-red-400">*</span>}
              </label>
              <input
                type={field.type || "text"}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
                className="w-full rounded-lg border-2 border-[#d4b96a] px-4 py-2.5 text-sm text-black outline-none focus:border-[#a00000]"
              />
            </div>
          ))}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-[#a00000]">Image</label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => { setImageMode("url"); setImageFile(null); }}
                className={`flex-1 rounded-lg border-2 py-2 text-sm ${imageMode === "url" ? "border-[#a00000] bg-red-50 text-[#a00000]" : "border-gray-200 text-gray-400"}`}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => { setImageMode("file"); setForm({ ...form, image: "" }); }}
                className={`flex-1 rounded-lg border-2 py-2 text-sm ${imageMode === "file" ? "border-[#a00000] bg-red-50 text-[#a00000]" : "border-gray-200 text-gray-400"}`}
              >
                Upload / Paste
              </button>
            </div>
            {imageMode === "url" ? (
              <input
                type="text"
                name="image"
                value={form.image}
                onChange={handleChange}
                onPaste={handleImagePaste}
                placeholder="https://... or paste image (Ctrl+V)"
                className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#a00000]"
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onPaste={handleImagePaste}
                tabIndex={0}
                className="cursor-pointer rounded-lg border-2 border-dashed border-amber-200 px-4 py-6 text-center text-sm text-gray-400 hover:border-[#a00000]"
              >
                {imageFile ? (
                  <div className="flex flex-col items-center gap-2">
                    {imagePreviewUrl && <img src={imagePreviewUrl} alt="" className="max-h-24 object-contain" />}
                    <span className="text-gray-700">{imageFile.name}</span>
                  </div>
                ) : (
                  "Click to upload or paste (Ctrl+V)"
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    assignImageFile(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#a00000] py-3 text-sm font-semibold text-white hover:bg-[#800000] disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Character"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-[#a00000] px-5 py-3 text-sm font-semibold text-[#a00000]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewChangesModal({ open, onClose, changes }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border-3 border-[#d4b96a] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-amber-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#a00000]">Unsaved Changes</h2>
            <p className="text-sm text-gray-500">
              {changes.length > 0
                ? `${changes.length} character(s) edited — save or discard by refreshing`
                : "No unsaved changes"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {changes.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">All changes have been saved.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {changes.map(({ char, changedFields }) => (
                <li
                  key={char.id}
                  className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-han text-xl text-[#a00000]">{char.character}</span>
                    <span className="font-mono text-xs text-gray-500">{char.unicode}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    Changed: {changedFields.map((f) => f.label).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-amber-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border-2 border-[#a00000] py-2.5 text-sm font-semibold text-[#a00000] hover:bg-red-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard({ email, onSignOut }) {
  const [allCharacters, setAllCharacters] = useState([]);
  const [filteredCharacters, setFilteredCharacters] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [alphabetFilter, setAlphabetFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [imageUploadingIds, setImageUploadingIds] = useState(new Set());
  const supabase = createClient();

  useEffect(() => {
    fetchCharacters();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  async function adminCharacterRequest(method, body) {
    const response = await fetch("/api/admin/characters", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function fetchCharacters() {
    setLoading(true);
    try {
      let allData = [];
      let start = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.from("Character").select("*").range(start, start + batchSize - 1);
        if (error) throw error;
        if (data?.length) {
          allData = [...allData, ...data];
          start += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setAllCharacters(sortCharacters(allData, "alphabet-tone-stroke"));
      setEdits({});
      setSelectedIds(new Set());
    } catch (error) {
      alert(`Error fetching characters: ${error.message}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Deferred out of the synchronous effect body (React's set-state-in-effect rule).
    const id = setTimeout(() => {
      let next = allCharacters;

      if (search.trim()) {
        const query = search.trim();
        const readingMatchExists = allCharacters.some((c) => readingMatchesQuery(c, query));
        next = next.filter((c) => adminCharacterMatchesQuery(c, query, { readingMatchExists }));
      }

      if (alphabetFilter !== "all") {
        next = next.filter((c) => characterMatchesAlphabetFilter(c, alphabetFilter));
      }

      setFilteredCharacters(sortCharacters(next, "alphabet-tone-stroke"));
      setCurrentPage(1);
      setSelectedIds(new Set());
    }, 0);
    return () => clearTimeout(id);
  }, [search, alphabetFilter, allCharacters]);

  const dirtyIds = useMemo(() => {
    const ids = new Set();
    for (const char of allCharacters) {
      const base = characterToDraft(char);
      const draft = { ...base, ...(edits[char.id] || {}) };
      if (!draftsEqual(base, draft)) ids.add(char.id);
    }
    return ids;
  }, [allCharacters, edits]);

  const pendingChanges = useMemo(() => {
    const items = [];
    for (const id of dirtyIds) {
      const char = allCharacters.find((c) => c.id === id);
      if (!char) continue;
      const base = characterToDraft(char);
      const draft = { ...base, ...(edits[id] || {}) };
      const changedFields = getChangedFields(base, draft);
      if (changedFields.length > 0) {
        items.push({ char, draft, changedFields });
      }
    }
    return items;
  }, [allCharacters, edits, dirtyIds]);

  const totalPages = Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE);
  const paginatedCharacters = filteredCharacters.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getRowDraft = (char) => ({ ...characterToDraft(char), ...(edits[char.id] || {}) });

  const updateCell = (id, key, value) => {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: value } }));
  };

  const handleTableImagePaste = async (charId, e) => {
    const result = getImageFileFromClipboard(e);
    if (!result) return;

    if (result.error) {
      e.preventDefault();
      alert(result.error);
      return;
    }

    e.preventDefault();
    setImageUploadingIds((prev) => new Set(prev).add(charId));

    try {
      const url = await uploadAdminImage(result.file);
      updateCell(charId, "image", url);
    } catch (err) {
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setImageUploadingIds((prev) => {
        const next = new Set(prev);
        next.delete(charId);
        return next;
      });
    }
  };

  const handleSaveAll = async () => {
    if (dirtyIds.size === 0) {
      alert("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      let updated = 0;
      let syncedVariantCount = 0;
      const errors = [];

      for (const id of dirtyIds) {
        const char = allCharacters.find((c) => c.id === id);
        if (!char) {
          errors.push({ id, error: "Character not found in local list." });
          continue;
        }

        try {
          const draft = { ...characterToDraft(char), ...(edits[id] || {}) };
          const data = await adminCharacterRequest("PATCH", { id, ...draftToPayload(draft) });
          updated += 1;
          if (Array.isArray(data.syncedVariants)) {
            syncedVariantCount += data.syncedVariants.length;
          }
        } catch (error) {
          errors.push({ id, error: error.message });
        }
      }

      const variantNote =
        syncedVariantCount > 0 ? ` ${syncedVariantCount} variant character(s) auto-synced.` : "";

      if (errors.length > 0) {
        alert(
          `Saved ${updated} character(s).${variantNote} ${errors.length} failed:\n${errors.map((e) => `#${e.id}: ${e.error}`).join("\n")}`
        );
      } else {
        alert(`Saved ${updated} character(s) successfully.${variantNote}`);
      }

      await fetchCharacters();
      setShowChangesModal(false);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
    setSaving(false);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return alert("No characters selected");
    if (!confirm(`Delete ${selectedIds.size} selected character(s)?`)) return;

    setLoading(true);
    try {
      const data = await adminCharacterRequest("DELETE", { ids: [...selectedIds] });
      alert(`Deleted ${data.deleted ?? selectedIds.size} character(s).`);
      await fetchCharacters();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const handleSelectCharacter = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAllOnPage = () => {
    const pageIds = paginatedCharacters.map((c) => c.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    setSelectedIds(next);
  };

  const isAllSelectedOnPage = paginatedCharacters.length > 0 && paginatedCharacters.every((c) => selectedIds.has(c.id));

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[98vw] px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#a00000]">Administrator Dashboard</h1>
            <p className="text-sm text-gray-600">
              {allCharacters.length.toLocaleString()} characters
              {dirtyIds.size > 0 && <span className="ml-2 text-amber-700">· {dirtyIds.size} unsaved change(s)</span>}
            </p>
            {email && <p className="mt-0.5 text-xs text-gray-500">Signed in as {email}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-[#a00000] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#800000]"
            >
              + Add Character
            </button>
            <button
              type="button"
              onClick={() => setShowChangesModal(true)}
              disabled={dirtyIds.size === 0}
              className="rounded-lg border-2 border-[#d4b96a] bg-white px-4 py-2.5 text-sm font-semibold text-[#a00000] hover:bg-amber-50 disabled:opacity-40"
            >
              View Changes{dirtyIds.size ? ` (${dirtyIds.size})` : ""}
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || dirtyIds.size === 0}
              className="rounded-lg border-2 border-[#a00000] bg-white px-4 py-2.5 text-sm font-semibold text-[#a00000] hover:bg-red-50 disabled:opacity-40"
            >
              {saving ? "Saving..." : `Save Changes${dirtyIds.size ? ` (${dirtyIds.size})` : ""}`}
            </button>
            {selectedIds.size > 0 && (
              <button type="button" onClick={handleBatchDelete} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                Delete Selected ({selectedIds.size})
              </button>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:border-[#a00000] hover:text-[#a00000]"
            >
              Sign out
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search by reading, character, unicode, or definition..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full rounded-xl border-2 border-[#d4b96a] bg-white px-4 py-3 text-sm text-black outline-none focus:border-[#a00000]"
        />

        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-widest text-gray-500">Filter by alphabet</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAlphabetFilter("all")}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${alphabetFilter === "all" ? "border-[#a00000] bg-[#a00000]/5 text-[#a00000]" : "border-gray-200 bg-white text-gray-600 hover:border-[#a00000]/40"}`}
            >
              All
            </button>
            {VIET_ALPHABET_FILTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => setAlphabetFilter(letter)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${alphabetFilter === letter ? "border-[#a00000] bg-[#a00000]/5 text-[#a00000]" : "border-gray-200 bg-white text-gray-600 hover:border-[#a00000]/40"}`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 text-xs text-gray-500">
          Showing {filteredCharacters.length.toLocaleString()} character(s)
          {totalPages > 1 && ` · page ${currentPage} of ${totalPages}`}
        </p>

        <div className="overflow-hidden rounded-xl border-2 border-[#d4b96a] bg-white">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#a00000] border-t-transparent" />
            </div>
          ) : filteredCharacters.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No characters found</p>
          ) : (
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full min-w-[1200px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                  <tr>
                    <th className="border-b border-amber-100 px-2 py-2 text-left">
                      <input type="checkbox" checked={isAllSelectedOnPage} onChange={handleSelectAllOnPage} className="rounded" />
                    </th>
                    {TABLE_FIELDS.map((col) => (
                      <th key={col.key} className="border-b border-amber-100 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#a00000]">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedCharacters.map((char) => {
                    const draft = getRowDraft(char);
                    const isDirty = dirtyIds.has(char.id);

                    return (
                      <tr key={char.id} className={isDirty ? "bg-amber-50/80" : "hover:bg-amber-50/40"}>
                        <td className="border-b border-amber-50 px-2 py-1 align-top">
                          <input type="checkbox" checked={selectedIds.has(char.id)} onChange={() => handleSelectCharacter(char.id)} className="rounded" />
                        </td>
                        {TABLE_FIELDS.map((col) => (
                          <td key={col.key} className="border-b border-amber-50 px-1 py-1 align-top">
                            <input
                              type={col.key === "stroke_count" ? "number" : "text"}
                              value={col.key === "image" && imageUploadingIds.has(char.id) ? "Uploading..." : draft[col.key]}
                              onChange={(e) => updateCell(char.id, col.key, e.target.value)}
                              onPaste={col.key === "image" ? (e) => handleTableImagePaste(char.id, e) : undefined}
                              readOnly={col.key === "image" && imageUploadingIds.has(char.id)}
                              placeholder={col.key === "image" ? "URL or paste image" : undefined}
                              className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none focus:border-[#d4b96a] focus:bg-white ${col.className || ""} ${col.key === "image" && imageUploadingIds.has(char.id) ? "text-gray-400 italic" : ""}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && !loading && filteredCharacters.length > 0 && (
            <div className="flex items-center justify-between border-t border-amber-100 bg-gray-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-[#d4b96a] px-3 py-1.5 text-sm text-[#a00000] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-[#d4b96a] px-3 py-1.5 text-sm text-[#a00000] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <AddCharacterModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={fetchCharacters}
        adminCharacterRequest={adminCharacterRequest}
      />

      <ViewChangesModal
        open={showChangesModal}
        onClose={() => setShowChangesModal(false)}
        changes={pendingChanges}
      />
    </div>
  );
}
