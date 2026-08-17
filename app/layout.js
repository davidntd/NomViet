import { Noto_Serif } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { KeyboardModeProvider } from "./components/KeyboardModeContext";
import { LanguageProvider } from "./components/LanguageContext";

// Note: Chữ Nôm (CJK) glyphs are intentionally NOT bundled — a full CJK webfont
// would add many megabytes. They render via the system-font fallback chain in
// globals.css (.font-han), which keeps every page fast to load.
const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Nôm Việt",
  description: "A reference tool for researching and learning Chữ Nôm, the traditional Vietnamese writing system.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${notoSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-serif text-gray-900 antialiased">
        <LanguageProvider>
          <KeyboardModeProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </KeyboardModeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
