"use client";

import Link from "next/link";
import { useLanguage } from "./components/LanguageContext";
import SectionHeader from "./components/SectionHeader";
import { en } from "./locales/en";
import { vn } from "./locales/vn";

export default function NotFound() {
  const { language } = useLanguage();
  const t = language === "en" ? en : vn;

  const buttonClass =
    "inline-flex min-w-[9.5rem] items-center justify-center rounded-lg border-2 border-[#a00000] px-6 py-3 text-sm font-semibold text-[#a00000] transition-colors hover:bg-[#a00000]/5";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-han mb-4 text-6xl text-[#a00000]">404</p>
      <SectionHeader title={t.pageNotFound} subtitle={t.notFoundDesc} headingLevel="h1" />
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClass}>
          {t.goHome}
        </Link>
        <Link href="/search" className={buttonClass}>
          {t.searchCharacters}
        </Link>
      </div>
    </div>
  );
}
