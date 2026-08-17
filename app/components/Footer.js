"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageContext";
import { en } from "../locales/en";
import { vn } from "../locales/vn";

export default function Footer() {
  const { language } = useLanguage();
  const t = language === "en" ? en : vn;

  const navLinks = [
    { href: "/", label: t.home },
    { href: "/search", label: t.search },
    { href: "/draw", label: t.draw },
    { href: "/translate", label: t.translate },
  ];

  const sources = [
    { label: "NOM Foundation", href: "https://www.nomfoundation.org" },
    { label: "Chunom.org", href: "https://chunom.org" },
    { label: "Chunom.org IME", href: "https://chunom.org/pages/ime/" },
    { label: "HV Dictionary (ThiVien.net)", href: "https://hvdic.thivien.net/nom" },
    { label: "HV Dictionary (ThaiPhong.net)", href: "https://hvdic.thaiphong.net/chu-nom.php" },
    { label: "NOM Foundation Lookup Tool", href: "https://www.nomfoundation.org/nom-tools/Nom-Lookup-Tool/Nom-Lookup-Tool?uiLang=vn" },
    { label: "Chunom.net Tra cứu", href: "https://chunom.net/Tra-cuu-Han-Nom" },
    { label: "Hannom-rcv.org Lookup", href: "https://www.hannom-rcv.org/Lookup-CHNC.html" },
    { label: "Google Drive (Fonts & Data)", href: "https://drive.google.com/drive/folders/1ip9WxRnxyNoYdolCPS5fDzNnibBLPFNR?usp=sharing" },
    { label: "zi.tools (IDS Lookup)", href: "https://zi.tools/?secondary=ids" },
  ];

  const sectionTitle = (label) => (
    <h4 className="text-halo mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#ffde59]">
      <span aria-hidden className="h-px w-5 bg-[#ffde59]/60" />
      {label}
    </h4>
  );

  return (
    <footer className="relative z-10 mt-auto overflow-hidden bg-[#a00000]">
      {/* Footer artwork (footer.png outline, recolored gold) + contrast scrim + gold divider */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/patterns/footer-outline.png')] bg-no-repeat bg-cover bg-[position:center_55%] opacity-85"
      />
      <div aria-hidden className="absolute inset-0 bg-[#a00000]/60" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#ffde59] to-transparent" />

      <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-12 md:px-10 md:pt-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/logo-nom-viet.png"
                alt=""
                width={85}
                height={48}
                className="h-12 w-auto drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
              />
              <div>
                <span className="block text-base font-bold tracking-wide text-[#ffde59]">
                  Nôm Việt
                </span>
                <span className="block text-[10px] uppercase tracking-[0.25em] text-[#d4b96a]/80">
                  Chữ Nôm · Từ điển số
                </span>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#d4b96a]">
              {language === "en"
                ? "A reference tool for researching and learning Chữ Nôm, the traditional Vietnamese writing system."
                : "Công cụ tra cứu và học chữ Nôm, hệ thống chữ viết truyền thống của Việt Nam."}
            </p>
          </div>

          <div>
            {sectionTitle(t.search)}
            <ul className="flex flex-col gap-2.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#d4b96a] transition-colors hover:text-[#ffde59]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            {sectionTitle(t.sources)}
            <ul className="flex flex-col gap-2.5">
              {sources.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#d4b96a] transition-colors hover:text-[#ffde59]"
                  >
                    {source.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#ffde59]/20 pt-6 sm:flex-row">
          <p className="text-halo text-xs tracking-wide text-[#ffde59]/80">
            © {new Date().getFullYear()} Nôm Việt.{" "}
            {language === "en"
              ? "Built to preserve Vietnamese cultural heritage."
              : "Được xây dựng để bảo tồn di sản văn hóa Việt Nam."}
          </p>
          <p className="flex items-center gap-2 rounded border border-[#ffde59]/30 px-3 py-1.5 text-xs text-[#ffde59]">
            <span aria-hidden className="font-han text-sm">喃</span>
            Nôm Việt
          </p>
        </div>
      </div>
    </footer>
  );
}
