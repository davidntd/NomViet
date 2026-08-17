"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageContext";
import SectionHeader, { SubsectionLabel } from "../components/SectionHeader";
import { formatReadingList, displayDefinition, hasCharacterImage } from "../lib/character";
import { en } from "../locales/en";
import { vn } from "../locales/vn";

// --- Shape matching ----------------------------------------------------------
// Results are ranked by how closely the rendered glyph of each candidate
// matches the user's drawing (first priority), with stroke-count closeness as
// the tie-breaker (second priority). Both the drawing and each glyph are
// rasterized to a small normalized bitmap and compared with a symmetric
// ink-coverage score: how much of each shape sits within a couple of pixels of
// the other. A small penalty discourages candidates whose ink is much denser
// than the drawing (otherwise a hook that merely contains the drawing as a
// subset can outscore the true match).

const MASK_SIZE = 64;
const MAX_ASPECT_RATIO = 1.5;
const DILATE_RADIUS = 2;
const HAN_FONT_STACK = [
  "GotichQATT",
  "Nom Na Tong",
  "Han Nom A",
  "Han Nom B",
  "Noto Serif CJK SC",
  "Source Han Serif SC",
  "BabelStone Han",
  "HanaMinA",
  "HanaMinB",
  "PingFang SC",
  "Hiragino Mincho ProN",
  "Yu Mincho",
  "Microsoft YaHei",
  "SimSun",
  "ui-serif",
  "Georgia",
  "serif",
].join(", ");

/** Bounding box of the non-empty pixels of a canvas context, or null if empty. */
function inkBBox(ctx, width, height) {
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Rasterize the user's strokes (stored in 400×400 canvas space) to a canvas.
 *  Strokes are first drawn thin to measure the ink bounds, then re-drawn with a
 *  stroke weight proportional to the drawing's height so it matches the weight
 *  of rendered glyph strokes (fonts draw strokes at roughly 10% of glyph
 *  height — much heavier than raw pen strokes). */
function rasterizeDrawing(strokes) {
  const width = 400;
  const height = 400;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const drawStrokes = (lineWidth) => {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i += 1) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  };

  drawStrokes(4);
  const thinBBox = inkBBox(ctx, width, height);
  if (!thinBBox) return { canvas, bbox: null };

  const lineWidth = Math.min(32, Math.max(8, thinBBox.h * 0.14));
  drawStrokes(lineWidth);
  return { canvas, bbox: inkBBox(ctx, width, height) };
}

/** Rasterize a character glyph (using the site's han font stack) to a canvas.
 *  Returns the canvas plus a raw 128×128 ink mask (used both for tofu
 *  detection and for the ink bounds). */
function rasterizeGlyph(character) {
  if (!character) return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `100px ${HAN_FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(character, size / 2, size / 2 + 4);

  const data = ctx.getImageData(0, 0, size, size).data;
  const mask = new Uint8Array(size * size);
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (data[(y * size + x) * 4 + 3] > 40) {
        mask[y * size + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return {
    canvas,
    mask,
    bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

// Guaranteed-unassigned codepoints; any font renders these as its “missing
// glyph” (tofu). Characters the installed fonts cannot render produce the same
// tofu bitmap, so matching them is meaningless — they are excluded from shape
// ranking. Different fallback fonts draw different tofu, hence several refs.
const TOFU_REFERENCE_CODEPOINTS = [0xfffe, 0x378, 0x377, 0xe000, 0x10ffff];
let tofuReferenceMasks = null;

function getTofuReferenceMasks() {
  if (tofuReferenceMasks) return tofuReferenceMasks;
  tofuReferenceMasks = [];
  for (const codePoint of TOFU_REFERENCE_CODEPOINTS) {
    const glyph = rasterizeGlyph(String.fromCodePoint(codePoint));
    if (glyph) tofuReferenceMasks.push(glyph.mask);
  }
  return tofuReferenceMasks;
}

function maskIoU(a, b) {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] || b[i]) {
      union += 1;
      if (a[i] && b[i]) inter += 1;
    }
  }
  return union === 0 ? 0 : inter / union;
}

/** True when the glyph renders as the font's missing-glyph (tofu) box. */
function isUnrenderableGlyph(mask) {
  return getTofuReferenceMasks().some((ref) => maskIoU(mask, ref) >= 0.9);
}

/** Fit a canvas's ink into a normalized target mask, centered and scaled.
 *  The aspect ratio is normalized toward square (clamped so extreme shapes like
 *  a single line keep their line-like nature), making the comparison robust to
 *  the proportions the user drew at. */
function normalizeToMask(canvas, bbox, target = MASK_SIZE) {
  const mask = new Uint8Array(target * target);
  if (!bbox) return mask;

  const out = document.createElement("canvas");
  out.width = target;
  out.height = target;
  const ctx = out.getContext("2d", { willReadFrequently: true });

  const pad = 2;
  const bw = bbox.w + pad * 2;
  const bh = bbox.h + pad * 2;
  let scaleX = (target - 4) / bw;
  let scaleY = (target - 4) / bh;
  if (scaleX > scaleY * MAX_ASPECT_RATIO) scaleX = scaleY * MAX_ASPECT_RATIO;
  else if (scaleY > scaleX * MAX_ASPECT_RATIO) scaleY = scaleX * MAX_ASPECT_RATIO;
  const dw = bw * scaleX;
  const dh = bh * scaleY;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, bbox.x - pad, bbox.y - pad, bw, bh, (target - dw) / 2, (target - dh) / 2, dw, dh);

  const data = ctx.getImageData(0, 0, target, target).data;
  for (let i = 0; i < target * target; i += 1) {
    mask[i] = data[i * 4 + 3] > 40 ? 1 : 0;
  }
  return mask;
}

function countMask(mask) {
  let count = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) count += 1;
  }
  return count;
}

/** Grow every ink pixel by DILATE_RADIUS in all directions. */
function dilateMask(mask) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < MASK_SIZE; y += 1) {
    for (let x = 0; x < MASK_SIZE; x += 1) {
      let hit = false;
      for (let dy = -DILATE_RADIUS; dy <= DILATE_RADIUS && !hit; dy += 1) {
        const sy = y + dy;
        if (sy < 0 || sy >= MASK_SIZE) continue;
        for (let dx = -DILATE_RADIUS; dx <= DILATE_RADIUS; dx += 1) {
          const sx = x + dx;
          if (sx < 0 || sx >= MASK_SIZE) continue;
          if (mask[sy * MASK_SIZE + sx]) {
            hit = true;
            break;
          }
        }
      }
      if (hit) out[y * MASK_SIZE + x] = 1;
    }
  }
  return out;
}

/** Fraction of mask `a`'s ink that is also present in mask `b`. */
function maskCoverage(a, b) {
  let total = 0;
  let hit = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]) {
      total += 1;
      if (b[i]) hit += 1;
    }
  }
  return total === 0 ? 0 : hit / total;
}

/** Shape similarity: symmetric ink coverage within DILATE_RADIUS, scaled down
 *  for candidates whose ink is much denser than the drawing. */
function shapeSimilarity(drawMask, drawCount, glyphMask, dilatedDrawMask) {
  const glyphCount = countMask(glyphMask);
  if (glyphCount === 0) return 0;
  const dilatedGlyph = dilateMask(glyphMask);
  const score =
    (maskCoverage(drawMask, dilatedGlyph) + maskCoverage(glyphMask, dilatedDrawMask)) / 2;
  return score * Math.min(1, (drawCount / glyphCount) * 1.2);
}

/** Rank candidates: shape similarity first, stroke-count closeness second. */
async function rankByShape(strokes, candidates) {
  const drawing = rasterizeDrawing(strokes);
  const drawMask = normalizeToMask(drawing.canvas, drawing.bbox);
  const drawCount = countMask(drawMask);
  if (drawCount === 0) return candidates;
  const dilatedDrawMask = dilateMask(drawMask);

  const scored = candidates.map((char) => {
    const glyph = rasterizeGlyph(char?.character);
    if (!glyph || isUnrenderableGlyph(glyph.mask)) return { char, score: 0 };
    const glyphMask = normalizeToMask(glyph.canvas, glyph.bbox);
    return { char, score: shapeSimilarity(drawMask, drawCount, glyphMask, dilatedDrawMask) };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const da = Math.abs((a.char.stroke_count ?? 0) - strokes.length);
      const db = Math.abs((b.char.stroke_count ?? 0) - strokes.length);
      if (da !== db) return da - db;
      return String(a.char.unicode || "").localeCompare(String(b.char.unicode || ""));
    })
    .map((entry) => entry.char);
}

export default function DrawPage() {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const searchSeqRef = useRef(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const { language } = useLanguage();
  const t = language === "en" ? en : vn;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    canvas.width = 400;
    canvas.height = 400;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return undefined;
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const drawLine = (points) => {
    if (points.length < 2) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const pos = getPos(e, canvasRef.current);
    const next = [...strokesRef.current, [pos]];
    strokesRef.current = next;
    setStrokes(next);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e, canvasRef.current);
    const updated = [...strokesRef.current];
    updated[updated.length - 1] = [...updated[updated.length - 1], pos];
    strokesRef.current = updated;
    drawLine(updated[updated.length - 1]);
    setStrokes(updated);
  };

  const stopDrawing = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    setIsDrawing(false);
    // Read the strokes from the ref (not from state) so this never runs as a
    // side effect inside a state updater (which React StrictMode can double-call).
    searchCharacters(strokesRef.current);
  };

  const searchCharacters = async (strokeList) => {
    if (!strokeList || strokeList.length === 0) return;
    // Sequence guard: every stroke ends a search, and they can finish out of
    // order — only the newest one may update the results.
    const seq = ++searchSeqRef.current;
    setLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/draw?strokes=${strokeList.length}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Search failed");
      // Shape similarity first, stroke count second.
      const ranked = await rankByShape(strokeList, data.results || []);
      if (seq !== searchSeqRef.current) return;
      setResults(ranked);
    } catch (err) {
      if (seq !== searchSeqRef.current) return;
      console.error(err);
      setResults([]);
      setSearchError(err.message || "Search failed");
    } finally {
      if (seq === searchSeqRef.current) setLoading(false);
    }
  };

  const redrawCanvas = (strokeList) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokeList) drawLine(stroke);
  };

  const undoStroke = () => {
    const newStrokes = strokesRef.current.slice(0, -1);
    strokesRef.current = newStrokes;
    setStrokes(newStrokes);
    redrawCanvas(newStrokes);
    setSearchError(null);
    if (newStrokes.length > 0) searchCharacters(newStrokes);
    else setResults([]);
  };

  const clearCanvas = () => {
    searchSeqRef.current += 1; // cancel any in-flight search
    strokesRef.current = [];
    setStrokes([]);
    setResults([]);
    setSearchError(null);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="pattern-surround min-h-screen">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 md:py-12">
        <SectionHeader
          label={t.draw}
          title={t.drawTitle}
          subtitle={t.drawDescription}
          align="left"
          headingLevel="h1"
        />
        <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-6">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-4 flex h-10 items-center justify-between gap-3">
              <SubsectionLabel className="mb-0">{t.drawCharacter}</SubsectionLabel>
              <div className="flex shrink-0 items-center gap-2 rounded-lg border-2 border-[#a00000]/30 bg-gray-50 px-3 py-1.5 text-sm">
                <span className="text-gray-600">{t.strokes}:</span>
                <span className="font-semibold text-[#a00000]">{strokes.length}</span>
              </div>
            </div>

            <div className="aspect-square w-full rounded-xl border-2 border-[#a00000]/40 p-1">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                role="img"
                aria-label={t.drawCharacter}
                className="h-full w-full cursor-crosshair touch-none rounded-lg bg-white"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={undoStroke}
                disabled={strokes.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#a00000] px-3 py-2.5 text-sm font-semibold text-[#a00000] transition-colors hover:bg-[#a00000]/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
                {t.undo}
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                disabled={strokes.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#a00000] px-3 py-2.5 text-sm font-semibold text-[#a00000] transition-colors hover:bg-[#a00000]/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t.clear}
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-4 flex h-10 items-center">
              <SubsectionLabel className="mb-0">{t.recognitionResults}</SubsectionLabel>
            </div>

            <div className="min-h-[280px] flex-1 overflow-y-auto rounded-xl border-2 border-[#a00000]/40 bg-gray-50">
              {loading && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#a00000] border-t-transparent" />
                </div>
              )}

              {!loading && searchError && (
                <div role="alert" className="flex h-full items-center justify-center px-6 text-center">
                  <p className="text-sm text-[#a00000]">{searchError}</p>
                </div>
              )}

              {!loading && !searchError && strokes.length === 0 && (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <p className="text-sm text-gray-600">{t.startDrawing}</p>
                </div>
              )}

              {!loading && !searchError && strokes.length > 0 && results.length === 0 && (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <p className="text-sm text-gray-600">{t.noMatches}</p>
                </div>
              )}

              {!loading && !searchError && results.length > 0 && (
                <div className="divide-y divide-gray-200">
                  {results.slice(0, 8).map((char) => (
                    <Link
                      key={char.id}
                      href={`/character/${char.unicode.replace("U+", "")}?lang=${language}`}
                      className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-white"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">
                        {hasCharacterImage(char) ? (
                          <img
                            src={char.image}
                            alt={char.character}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="font-han text-2xl text-[#a00000]">{char.character}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatReadingList(char.nom_reading) || formatReadingList(char.han_viet_reading)}
                        </p>
                        <p className="truncate text-sm text-gray-600">
                          {displayDefinition(char, language)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">{char.stroke_count} {t.strokesUnit} · {char.unicode}</p>
                      </div>
                      <svg className="shrink-0 text-gray-400 transition-colors group-hover:text-[#a00000]" width="15" height="15" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}