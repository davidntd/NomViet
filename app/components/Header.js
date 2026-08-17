"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "./LanguageContext";
import { useKeyboardMode } from "./KeyboardModeContext";
import { en } from "../locales/en";
import { vn } from "../locales/vn";

function KeyboardIcon({ className = "" }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
    </svg>
  );
}

function GlobeIcon({ className = "" }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15.3 15.3 0 0 1 0 18M12 3a15.3 15.3 0 0 0 0 18" />
    </svg>
  );
}

// Compact icon + text label that identifies what a header control does.
// text-halo (dark-red text shadow) keeps it readable over the gold bird
// artwork; the drop-shadow does the same for the icon's strokes.
function ControlLabel({ icon, label }) {
  return (
    <span className="text-halo flex w-max shrink-0 items-center gap-1.5 pr-0.5 text-[#ffde59] drop-shadow-[0_1px_1px_rgba(90,0,0,0.7)]">
      {icon}
      <span className="text-[9px] font-semibold uppercase leading-none tracking-widest">{label}</span>
    </span>
  );
}

// Both toggles share this segmented control style: two options in a pill,
// the active one filled white with dark-red text.
function SegmentedControl({ options, active, onSelect, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex w-44 shrink-0 rounded-md border border-[#ffde59]/40 bg-black/20 p-0.5"
    >
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={isActive}
            aria-label={option.ariaLabel}
            title={option.title}
            className={`flex-1 whitespace-nowrap rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-white text-[#a00000] shadow-sm"
                : "text-[#d4b96a] hover:text-[#ffde59]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function LanguageToggle({ language, onSelect, label, className = "" }) {
  return (
    <div className={`flex w-full items-center justify-between gap-2 ${className}`}>
      <SegmentedControl
        ariaLabel="Select language"
        active={language}
        onSelect={onSelect}
        options={[
          { value: "vn", label: "Tiếng Việt", ariaLabel: "Switch to Tiếng Việt" },
          { value: "en", label: "English", ariaLabel: "Switch to English" },
        ]}
      />
      <ControlLabel icon={<GlobeIcon />} label={label} />
    </div>
  );
}

function KeyboardToggle({ mode, onSelect, label, className = "" }) {
  const isVi = mode === "vi";
  return (
    <div className={`flex w-full items-center justify-between gap-2 ${className}`}>
      <SegmentedControl
        ariaLabel="Keyboard input mode"
        active={mode}
        onSelect={onSelect}
        options={[
          {
            value: "vi",
            label: "VI",
            ariaLabel: isVi
              ? "Vietnamese Telex input is on"
              : "Switch to Vietnamese Telex input",
            title: "Vietnamese Telex input (nuoc + s → nước)",
          },
          {
            value: "en",
            label: "EN",
            ariaLabel: !isVi
              ? "English keyboard is on"
              : "Switch to English keyboard",
            title: "English keyboard",
          },
        ]}
      />
      <ControlLabel icon={<KeyboardIcon />} label={label} />
    </div>
  );
}

export default function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { language, selectLanguage } = useLanguage();
  const { mode: keyboardMode, selectMode: selectKeyboardMode } = useKeyboardMode();
  const t = language === "en" ? en : vn;

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&lang=${language}`);
    }
  };

  const navLinks = [
    { href: "/", label: t.home },
    { href: `/search?lang=${language}`, label: t.search },
    { href: `/draw?lang=${language}`, label: t.draw },
    { href: `/translate?lang=${language}`, label: t.translate },
  ];

  const isActive = (href) => {
    const path = href.split("?")[0];
    return path === "/" ? pathname === "/" : pathname.startsWith(path);
  };

  const logo = (
    <Link href={`/?lang=${language}`} className="shrink-0" aria-label="Nôm Việt — home">
      <img
        src="/logo-nom-viet.png"
        alt="Nôm Việt"
        width={85}
        height={48}
        className="h-11 w-auto drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] md:h-12"
      />
    </Link>
  );

  const nav = (
    <nav className="flex items-center gap-1.5 xl:gap-2" aria-label="Main">
      {navLinks.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`group relative px-3.5 py-2 text-[13px] font-semibold uppercase tracking-[0.16em] transition-colors xl:px-4 ${
              active
                ? "text-[#ffde59] text-halo"
                : "text-[#e8d5a3] hover:text-[#ffde59] text-halo"
            }`}
          >
            {link.label}
            <span
              aria-hidden
              className="absolute inset-x-3.5 bottom-0 h-[2px] rounded-full bg-[#ffde59] opacity-0 transition-opacity duration-200 group-hover:opacity-60"
            />
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-3.5 bottom-0 h-[2px] rounded-full bg-[#ffde59]"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const searchForm = (
    <form
      onSubmit={handleSearch}
      className="flex min-w-0 flex-1 items-center bg-white shadow-sm ring-1 ring-[#ffde59]/30 transition-colors focus-within:ring-2 focus-within:ring-[#ffde59]"
    >
      <input
        type="text"
        placeholder={t.searchPlaceholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none placeholder-gray-400"
      />
      <button
        type="submit"
        className="px-3 py-2 text-[#a00000] transition-colors hover:text-[#d4b96a]"
        aria-label={t.search}
      >
        <svg width="15" height="15" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="10" cy="10" r="7.5" />
          <path d="m20 20-4.35-4.35" />
        </svg>
      </button>
    </form>
  );

  // Stacked labeled controls: language toggle on top, keyboard toggle below.
  // The dark backdrop panel keeps the labels/icons readable over the gold
  // bird artwork that sits behind this corner of the header.
  const modeToggles = (
    <div className="flex flex-col gap-1 rounded-lg bg-[#7a0000]/90 p-1.5 ring-1 ring-[#ffde59]/25">
      <LanguageToggle
        language={language}
        onSelect={selectLanguage}
        label={t.language}
      />
      <KeyboardToggle
        mode={keyboardMode}
        onSelect={selectKeyboardMode}
        label={t.keyboard}
      />
    </div>
  );

  return (
    <header className="sticky top-0 z-50 overflow-hidden bg-[#a00000]">
      {/* Navbar artwork (navbar.png outline, recolored gold) + contrast scrim + gold divider.
          The scrim keeps the gold nav text readable over the gold artwork. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/patterns/navbar-outline.png')] bg-no-repeat bg-[size:38%_auto] bg-[position:-2.5%_20%] opacity-85"
      />
      {/* Right-side artwork — the bird line art, recolored gold — right-aligned.
          Sized by width (like the dragon artwork on the left) so it scales down
          on narrow screens; the min() cap keeps the desktop size unchanged. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/patterns/navbar-bird.png')] bg-no-repeat bg-[size:min(29.5%,425px)_auto] bg-[position:98%_40%] opacity-90"
      />
      <div aria-hidden className="absolute inset-0 bg-[#a00000]/65" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-[#ffde59] to-transparent" />

      <div className="relative mx-auto flex h-20 max-w-6xl items-center gap-4 px-5 md:h-24 md:px-10">
        {logo}

        <div aria-hidden className="hidden h-10 w-px shrink-0 bg-[#ffde59]/25 lg:block" />
        <div className="hidden lg:block">{nav}</div>

        <div className="ml-auto hidden max-w-xs lg:block">
          {searchForm}
        </div>        <div className="hidden shrink-0 md:block">
          {modeToggles}
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden ml-auto flex flex-col gap-1.5 p-2.5"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <span className="block h-0.5 w-5 bg-[#d4b96a]" />
          <span className="block h-0.5 w-5 bg-[#d4b96a]" />
          <span className="block h-0.5 w-5 bg-[#d4b96a]" />
        </button>
      </div>

      {menuOpen && (
        <div
          id="mobile-menu"
          className="relative border-t border-[#ffde59]/20 bg-[#a00000] px-5 py-5 md:px-10"
        >
          <nav className="flex flex-col gap-1" aria-label="Main (mobile)">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-2.5 text-xs font-medium uppercase tracking-widest transition-colors ${
                    active
                      ? "bg-[#ffde59]/10 text-[#ffde59]"
                      : "text-[#e8d5a3] hover:bg-[#d4b96a]/10 hover:text-[#d4b96a]"
                  }`}
                >
                  {link.label}
                  <span aria-hidden className="font-han text-sm opacity-60">
                    {link.href.startsWith("/search")
                      ? "尋"
                      : link.href.startsWith("/draw")
                        ? "畫"
                        : link.href.startsWith("/translate")
                          ? "譯"
                          : "家"}
                  </span>
                </Link>
              );
            })}
          </nav>

          <form
            onSubmit={handleSearch}
            className="mt-4 flex items-center rounded-md bg-white shadow-sm ring-1 ring-[#ffde59]/40"
          >
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none placeholder-gray-400"
            />
            <button type="submit" className="px-4 py-2.5 text-[#a00000]">
              <svg width="15" height="15" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="10" cy="10" r="7.5" />
                <path d="m20 20-4.35-4.35" />
              </svg>
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-1">
            <LanguageToggle
              language={language}
              onSelect={(lang) => {
                selectLanguage(lang);
                setMenuOpen(false);
              }}
              label={t.language}
              className="w-full"
            />
            <KeyboardToggle
              mode={keyboardMode}
              onSelect={selectKeyboardMode}
              label={t.keyboard}
              className="w-full"
            />
          </div>
        </div>
      )}
    </header>
  );
}
