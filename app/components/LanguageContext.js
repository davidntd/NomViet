"use client";

import { createContext, useContext, useState, useEffect } from "react";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("vn");

  useEffect(() => {
    // Deferred out of the synchronous effect body (React's set-state-in-effect
    // rule). Reading localStorage must happen client-side only, so this can't
    // run during SSR — the default "vn" render stays to avoid hydration mismatch.
    const id = setTimeout(() => {
      const savedLang = localStorage.getItem("language");
      if (savedLang === "en" || savedLang === "vn") {
        setLanguage(savedLang);
        // Also set cookie for server components
        document.cookie = `language=${savedLang}; path=/; max-age=31536000`;
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const selectLanguage = (lang) => {
    if (lang !== "en" && lang !== "vn") return;
    setLanguage(lang);
    localStorage.setItem("language", lang);
    document.cookie = `language=${lang}; path=/; max-age=31536000`;
  };

  const toggleLanguage = () => {
    selectLanguage(language === "en" ? "vn" : "en");
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, selectLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}