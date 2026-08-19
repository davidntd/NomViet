"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-client";
import Link from "next/link";
import { useLanguage } from "../../components/LanguageContext";
import SectionHeader from "../../components/SectionHeader";
import { formatReadingList, variantTokenToCharacter, isCharacterImage } from "../../lib/character";
import { en } from "../../locales/en";
import { vn } from "../../locales/vn";

export default function CharacterPage({ params }) {
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { language } = useLanguage();
  const t = language === "en" ? en : vn;
  const supabase = createClient();

  useEffect(() => {
    async function fetchCharacter() {
      const { id } = await params;
      const characterId = Number.parseInt(String(id), 10);

      const { data, error } = await supabase
        .from("Character")
        .select("*")
        .eq("id", characterId)
        .single();

      if (error || !data || !Number.isInteger(characterId)) {
        setNotFound(true);
      } else {
        setCharacter(data);
      }
      setLoading(false);
    }

    fetchCharacter();
  }, [params, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#a00000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !character) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="font-han mb-4 text-5xl text-[#a00000]">404</p>
        <SectionHeader title={t.characterNotFound} subtitle={t.notFoundDesc} headingLevel="h1" />
        <Link href="/search" className="mt-2 inline-flex min-w-[9.5rem] items-center justify-center rounded-lg border-2 border-[#a00000] px-6 py-3 text-sm font-semibold text-[#a00000] transition-colors hover:bg-[#a00000]/5">
          {t.backToSearch}
        </Link>
      </div>
    );
  }

  const hanReadings = formatReadingList(character.han_viet_reading);
  const nomReadings = formatReadingList(character.nom_reading);
  const hanVietDefinition = character.han_viet_definition?.trim() || "—";
  const nomDefinition = character.nom_definition?.trim() || "—";
  const isImage = isCharacterImage(character.character);

  const hasVariants = character.variants && character.variants.length > 0;

  return (
    <div className="pattern-surround min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 md:py-12">
        <Link
          href="/search"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#a00000] transition-colors hover:text-[#800000]"
        >
          <svg width="15" height="15" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m15 20-5-5 5-5" />
          </svg>
          {t.backToSearch}
        </Link>

        <div className="mb-8 flex justify-center">
          {isImage ? (
            <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
              <img
                src={character.character}
                alt={character.character}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
              <span className="font-han text-[120px] leading-none text-[#a00000]">{character.character}</span>
            </div>
          )}
        </div>

        <SectionHeader title={t.characterInformation} align="left" headingLevel="h1" />
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div className="flex items-start gap-4 border-b border-gray-200 px-5 py-4">
            <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#a00000]">{t.hanReading}</span>
            <span className="text-sm font-semibold text-gray-900">{hanReadings || "—"}</span>
          </div>
          <div className="flex items-start gap-4 border-b border-gray-200 px-5 py-4">
            <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#a00000]">{t.nomReading}</span>
            <span className="text-sm font-semibold text-gray-900">{nomReadings || "—"}</span>
          </div>
          <div className="flex items-start gap-4 border-b border-gray-200 px-5 py-4">
            <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#a00000]">{t.definition}</span>
            <span className="text-sm leading-relaxed text-gray-900">{character.definition || "—"}</span>
          </div>
          <div className="flex items-start gap-4 border-b border-gray-200 px-5 py-4">
            <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#a00000]">{t.hanVietDefinition}</span>
            <span className="text-sm leading-relaxed text-gray-900">{hanVietDefinition}</span>
          </div>
          <div className="flex items-start gap-4 border-b border-gray-200 px-5 py-4">
            <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#a00000]">{t.nomDefinition}</span>
            <span className="text-sm leading-relaxed text-gray-900">{nomDefinition}</span>
          </div>
          <div className={`flex items-start gap-4 px-5 py-4 ${hasVariants ? "border-b border-gray-200" : ""}`}>
            <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#a00000]">{t.strokeCount}</span>
            <span className="text-sm font-semibold text-gray-900">{character.stroke_count} {t.strokesUnit}</span>
          </div>

          {hasVariants && (
            <div className="flex items-start gap-4 px-5 py-4">
              <span className="w-28 shrink-0 pt-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#a00000]">{t.variants}</span>
              <div className="flex flex-wrap items-center gap-3">
                {character.variants.map((variant, index) => (
                  <span key={`${variant}-${index}`} className="inline-flex items-center gap-1 text-gray-900">
                    <span className="font-han text-2xl">
                      {variantTokenToCharacter(variant) || variant}
                    </span>
                    {index < character.variants.length - 1 && (
                      <span className="ml-1 text-gray-300">·</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
