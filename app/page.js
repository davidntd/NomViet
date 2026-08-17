"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useLanguage } from "./components/LanguageContext";
import SectionHeader from "./components/SectionHeader";
import { en } from "./locales/en";
import { vn } from "./locales/vn";

const AUTO_INTERVAL_MS = 6000;
const RESUME_DELAY_MS = 60000;

function ChevronIcon({ direction }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      {direction === "left" ? (
        <path d="m15 18-6-6 6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

function HistoryCarousel({ items }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);
  const resumeTimerRef = useRef(null);
  const count = items.length;
  const active = items[activeIndex];

  const goTo = useCallback(
    (index, dir = 1) => {
      setDirection(dir);
      setActiveIndex(((index % count) + count) % count);
    },
    [count]
  );

  const goNext = useCallback(() => {
    setDirection(1);
    setActiveIndex((i) => (i + 1) % count);
  }, [count]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setActiveIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const pauseAuto = useCallback(() => {
    setAutoPlay(false);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setAutoPlay(true), RESUME_DELAY_MS);
  }, []);

  const handleTabClick = (index) => {
    if (index === activeIndex) return;
    pauseAuto();
    goTo(index, index > activeIndex ? 1 : -1);
  };

  useEffect(() => {
    if (!autoPlay) return undefined;
    const id = setInterval(goNext, AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoPlay, goNext]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setAutoPlay(false);
      } else if (!resumeTimerRef.current) {
        setAutoPlay(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(
    () => () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    },
    []
  );

  const slideClass =
    direction >= 0
      ? "motion-safe:animate-slide-in-right"
      : "motion-safe:animate-slide-in-left";

  const tabBase =
    "rounded-full border-2 px-4 py-2 text-sm font-semibold shadow-sm transition-all";

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 sm:gap-3">
        <div className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(index)}
              aria-pressed={index === activeIndex}
              className={
                index === activeIndex
                  ? `${tabBase} border-transparent ${item.accent} ${item.accentText}`
                  : `${tabBase} bg-white ${item.tabBorder} ${item.tabText} ${item.tabHover}`
              }
            >
              {item.tabLabelShort ? (
                <>
                  <span className="sm:hidden">{item.tabLabelShort}</span>
                  <span className="hidden sm:inline">{item.tabLabel}</span>
                </>
              ) : (
                item.tabLabel
              )}
            </button>
          ))}
        </div>
        <div className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" aria-hidden />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            pauseAuto();
            goPrev();
          }}
          aria-label="Previous era"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-[#a00000] hover:text-[#a00000] sm:h-10 sm:w-10"
        >
          <ChevronIcon direction="left" />
        </button>

        <article
          key={active.id}
          className={`relative min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm sm:p-5 ${slideClass}`}
        >
          <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${active.accent}`} />
          <div className="relative">
            <span className={`text-xs font-semibold ${active.labelColor}`}>{active.period}</span>
            <h3 className="font-han mt-1 mb-2 text-lg font-bold text-gray-900 sm:text-xl">
              {active.title}
            </h3>
            <p className="text-sm leading-relaxed text-gray-600">{active.description}</p>
          </div>
        </article>

        <button
          type="button"
          onClick={() => {
            pauseAuto();
            goNext();
          }}
          aria-label="Next era"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-[#a00000] hover:text-[#a00000] sm:h-10 sm:w-10"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
    </div>
  );
}

function ExploreMoreSection({ t, language }) {
  const links = [
    { href: `/search?lang=${language}`, label: t.search },
    { href: `/draw?lang=${language}`, label: t.drawToSearch },
    { href: `/translate?lang=${language}`, label: t.translate },
  ];

  const buttonClass =
    "inline-flex min-w-[9.5rem] items-center justify-center rounded-lg border-2 border-[#a00000] px-6 py-3 text-sm font-semibold text-[#a00000] transition-colors hover:bg-[#a00000]/5";

  return (
    <section
      id="explore"
      className="scroll-mt-24 border-t border-gray-100/80"
    >
      <div className="mx-auto max-w-3xl px-6 py-12 text-center md:py-14">
        <SectionHeader title={t.exploreMoreTitle} subtitle={t.exploreMoreSubtitle} />
        <div className="flex flex-wrap justify-center gap-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={buttonClass}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { language } = useLanguage();
  const t = language === "en" ? en : vn;

  const timelineData = [
    {
      id: 1,
      tabLabel: "Hán Tự",
      title: t.hanTu,
      period: t.hanTuPeriod,
      description: t.hanTuDesc,
      accent: "bg-[#a00000]",
      accentText: "text-white",
      labelColor: "text-[#a00000]",
      tabBorder: "border-[#a00000]/35",
      tabText: "text-[#a00000]",
      tabHover: "hover:border-[#a00000]/60 hover:bg-[#a00000]/5",
    },
    {
      id: 2,
      tabLabel: "Chữ Nôm",
      title: t.chuNomTitle,
      period: t.chuNomPeriod,
      description: t.chuNomDesc,
      accent: "bg-[#ffde59]",
      accentText: "text-[#1a0808]",
      labelColor: "text-[#9a7b00]",
      tabBorder: "border-[#d4b020]/45",
      tabText: "text-[#7a6200]",
      tabHover: "hover:border-[#d4b020]/65 hover:bg-[#ffde59]/15",
    },
    {
      id: 3,
      tabLabel: "Quốc Âm Tân Tự",
      tabLabelShort: "Q.A.T.T",
      title: t.quocAmTanTu,
      period: t.quocAmTanTuPeriod,
      description: t.quocAmTanTuDesc,
      accent: "bg-[#009E60]",
      accentText: "text-white",
      labelColor: "text-[#009E60]",
      tabBorder: "border-[#009E60]/35",
      tabText: "text-[#009E60]",
      tabHover: "hover:border-[#009E60]/60 hover:bg-[#009E60]/5",
    },
    {
      id: 4,
      tabLabel: "Quốc Ngữ",
      title: t.quocNgu,
      period: t.quocNguPeriod,
      description: t.quocNguDesc,
      accent: "bg-[#0047AB]",
      accentText: "text-white",
      labelColor: "text-[#0047AB]",
      tabBorder: "border-[#0047AB]/35",
      tabText: "text-[#0047AB]",
      tabHover: "hover:border-[#0047AB]/60 hover:bg-[#0047AB]/5",
    },
  ];

  return (
    <div className="pattern-surround flex flex-col">
      {/* Intro */}
      <section className="border-b border-gray-100/80">
        <div className="mx-auto max-w-2xl px-6 py-10 text-center md:py-12">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#a00000]">
            {t.heroBadge}
          </p>
          <h1 className="font-han mb-3 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            {t.appName}
          </h1>
          <p className="text-base text-gray-600">{t.tagline}</p>
        </div>
      </section>

      {/* Project + History */}
      <div className="mx-auto w-full max-w-7xl px-6 py-10 md:py-12 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-14">
        <section id="about" className="order-2 scroll-mt-24 lg:order-1">
          <SectionHeader label={t.projectTitle} title={t.aboutSubtitle} align="left" />
          <div className="space-y-4 text-sm leading-relaxed text-gray-600 md:text-[15px] md:leading-7">
            <p>{t.projectBody1}</p>
            <p>{t.projectBody2}</p>
            <p>{t.projectBody3}</p>
          </div>
        </section>

        <section id="history" className="order-1 mb-10 scroll-mt-24 lg:order-2 lg:mb-0">
          <SectionHeader
            label={t.historyTitle}
            title={t.evolutionTitle}
            subtitle={t.evolutionSubtitle}
            align="left"
          />
          <HistoryCarousel items={timelineData} />
        </section>
      </div>

      <ExploreMoreSection t={t} language={language} />
    </div>
  );
}
