"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "../components/LanguageContext";
import SectionHeader from "../components/SectionHeader";
import {
  DEFAULT_SEARCH_FILTER,
  SEARCH_FILTERS,
  formatReadingList,
  displayDefinition,
  hasCharacterImage,
} from "../lib/character";
import { en } from "../locales/en";
import { vn } from "../locales/vn";

const RESULTS_PER_TAB = 10;

const FILTER_LABEL_KEYS = {
  han_viet_reading: "hanReading",
  nom_reading: "nomReading",
  definition: "definition",
  han_viet_definition: "hanVietDefinition",
  nom_definition: "nomDefinition",
};

const FILTER_PLACEHOLDER_KEYS = {
  han_viet_reading: "searchExampleHanViet",
  nom_reading: "searchExampleNom",
  definition: "searchExampleDefinition",
  han_viet_definition: "searchExampleHanVietDefinition",
  nom_definition: "searchExampleNomDefinition",
};

function getResultReadingDisplay(char, filter, t) {
  const han = formatReadingList(char.han_viet_reading);
  const nom = formatReadingList(char.nom_reading);

  const hanLine = han ? { label: t.hanReading, value: han } : null;
  const nomLine = nom ? { label: t.nomReading, value: nom } : null;

  if (filter === "han_viet_reading") {
    return {
      primary: hanLine || nomLine,
      secondary: hanLine && nomLine ? nomLine : null,
    };
  }

  if (filter === "nom_reading") {
    return {
      primary: nomLine || hanLine,
      secondary: nomLine && hanLine ? hanLine : null,
    };
  }

  return {
    primary: nomLine || hanLine,
    secondary: nomLine && hanLine ? hanLine : null,
  };
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useLanguage();
  const t = language === "en" ? en : vn;

  // The URL query params are the source of truth for what is being searched.
  const urlQuery = searchParams.get("q")?.trim() || "";
  const urlFilter = SEARCH_FILTERS.includes(searchParams.get("filter") || "")
    ? searchParams.get("filter")
    : DEFAULT_SEARCH_FILTER;

  const [query, setQuery] = useState(urlQuery);
  const [searchFilter, setSearchFilter] = useState(urlFilter);
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Keep the input and active filter in sync with URL changes (e.g. the search
  // form or a header link updated the query). This is the React-sanctioned
  // "adjust state during render" pattern — the guard makes it safe.
  const [appliedUrl, setAppliedUrl] = useState(searchParams.toString());
  if (appliedUrl !== searchParams.toString()) {
    setAppliedUrl(searchParams.toString());
    setQuery(urlQuery);
    setSearchFilter(urlFilter);
  }

  const runSearch = useCallback(
    async (searchQuery, filter) => {
      if (!searchQuery.trim()) return;
      setLoading(true);
      setActiveTab(0);

      try {
        const params = new URLSearchParams({ q: searchQuery.trim(), filter });
        const res = await fetch(`/api/search?${params.toString()}`);
        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || "Search failed");
        }

        if (data.redirect) {
          router.push(`${data.redirect}?lang=${language}`);
          return;
        }

        setSearched(true);
        setSearchError(null);
        setResults(data.results || []);
      } catch (error) {
        console.error("Search error:", error);
        setSearched(true);
        setSearchError(error.message || "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [language, router]
  );

  useEffect(() => {
    // Both branches are deferred out of the synchronous effect body (React's
    // set-state-in-effect rule) — URL-driven work must not cascade renders.
    if (!urlQuery) {
      const id = setTimeout(() => {
        setResults([]);
        setSearched(false);
        setActiveTab(0);
        setLoading(false);
        setSearchError(null);
      }, 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => void runSearch(urlQuery, urlFilter), 0);
    return () => clearTimeout(id);
  }, [urlQuery, urlFilter, runSearch]);

  const buildSearchUrl = (nextQuery, nextFilter = searchFilter) => {
    const params = new URLSearchParams({
      q: nextQuery.trim(),
      filter: nextFilter,
    });
    return `/search?${params.toString()}`;
  };

  const buildEmptySearchUrl = (nextFilter = searchFilter) => {
    const params = new URLSearchParams({ filter: nextFilter });
    return `/search?${params.toString()}`;
  };

  const handleSearch = (e) => {
    e.preventDefault();

    if (!query.trim()) {
      setQuery("");
      router.push(buildEmptySearchUrl());
      return;
    }

    router.push(buildSearchUrl(query));
  };

  const handleFilterChange = (nextFilter) => {
    setSearchFilter(nextFilter);
    setActiveTab(0);

    if (query.trim()) {
      router.push(buildSearchUrl(query, nextFilter));
    }
  };

  const tabCount = Math.ceil(results.length / RESULTS_PER_TAB);
  const paginatedResults = results.slice(
    activeTab * RESULTS_PER_TAB,
    activeTab * RESULTS_PER_TAB + RESULTS_PER_TAB
  );
  const placeholder = t[FILTER_PLACEHOLDER_KEYS[searchFilter]] || t.searchExample;

  return (
    <div className="pattern-surround min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 md:py-12">
        <SectionHeader
          label={t.search}
          title={t.searchCharacters}
          subtitle={t.searchDescription}
          align="left"
          headingLevel="h1"
        />

        <div className="mb-6">
          <p className="mb-3 text-xs uppercase tracking-widest text-gray-500">{t.searchFilterLabel}</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => handleFilterChange(filter)}
                aria-pressed={searchFilter === filter}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  searchFilter === filter
                    ? "border-[#a00000] bg-[#a00000]/5 text-[#a00000]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-[#a00000]/40"
                }`}
              >
                {t[FILTER_LABEL_KEYS[filter]]}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSearch} className="mb-10 flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border-2 border-[#a00000]/40 bg-white shadow-sm transition-colors focus-within:border-[#a00000]">
            <input
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-5 py-3 text-base text-gray-900 outline-none placeholder-gray-400"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  router.push(buildEmptySearchUrl());
                }}
                className="px-5 text-gray-500 hover:text-black transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 7.5 7.5 20M7.5 7.5l12.5 12.5" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-[#a00000] px-5 py-3 text-sm font-semibold text-[#a00000] transition-colors hover:bg-[#a00000]/5"
          >
            {t.search}
          </button>
        </form>

        {loading && (
          <div role="status" aria-label={t.searching} className="flex justify-center py-20">
            <div className="w-10 h-10 border-5 border-[#a00000] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && searched && searchError && (
          <div role="alert" className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-[#a00000]">{searchError}</p>
            <p className="mt-2 text-sm text-gray-600">{t.tryDifferent}</p>
          </div>
        )}

        {!loading && !searched && (
          <div className="flex flex-col items-center justify-center py-25 text-center">
            <svg className="text-gray-700 mb-5" width="50" height="50" viewBox="0 0 25 25" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="7.5" />
              <path d="m20 20-4.35-4.35" />
            </svg>
            <p className="text-gray-700 text-sm">{t.startTyping}</p>
          </div>
        )}

        {!loading && searched && !searchError && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-gray-700 text-md">
              {t.noResults} &quot;{searchParams.get("q")}&quot;
            </p>
            <p className="text-gray-700 text-md mt-5">{t.tryDifferent}</p>
          </div>
        )}

        {!loading && !searchError && results.length > 0 && (
          <div aria-live="polite">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-widest text-gray-500">
                {results.length} {results.length !== 1 ? t.results : t.result} {t.for} &quot;
                {searchParams.get("q")}&quot;
              </p>
              {tabCount > 1 && (
                <p className="text-xs text-gray-500">
                  {t.searchTabShowing} {activeTab + 1} {t.searchTabOf} {tabCount}
                </p>
              )}
            </div>

            {tabCount > 1 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {Array.from({ length: tabCount }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveTab(index)}
                    aria-current={activeTab === index ? "page" : undefined}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === index
                        ? "border-[#a00000] bg-[#a00000]/5 text-[#a00000]"
                        : "border-gray-200 bg-white text-gray-600 hover:border-[#a00000]/40"
                    }`}
                  >
                    {t.searchTab} {index + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-[min(70vh,640px)] overflow-y-auto rounded-xl border border-gray-200 bg-white/80 pr-1">
            <div className="flex flex-col gap-5 p-1">
              {paginatedResults.map((char) => {
                const readingDisplay = getResultReadingDisplay(char, searchFilter, t);

                return (
                <Link
                  key={char.id}
                  href={`/character/${char.unicode.replace("U+", "")}?lang=${language}`}
                  className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 transition-all hover:border-[#a00000]/40 hover:shadow-sm"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                    {hasCharacterImage(char) ? (
                      <img
                        src={char.image}
                        alt={char.character}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="font-han text-3xl text-[#a00000]">{char.character}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {readingDisplay.primary && (
                      <p className="text-sm font-semibold text-gray-900">
                        {readingDisplay.primary.label}: {readingDisplay.primary.value}
                      </p>
                    )}
                    {readingDisplay.secondary && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {readingDisplay.secondary.label}: {readingDisplay.secondary.value}
                      </p>
                    )}
                    <p className="mt-0.5 truncate text-sm text-gray-600">
                      {displayDefinition(char, language)}
                    </p>
                    <p className="mt-1 font-mono text-xs text-gray-500">
                      {char.unicode} · {char.stroke_count} {t.strokesUnit}
                    </p>
                  </div>
                  <svg
                    className="text-gray-400 group-hover:text-[#a00000] transition-colors flex-shrink-0"
                    width="15"
                    height="15"
                    viewBox="0 0 25 25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="m10 20 7.5-7.5-7.5-7.5" />
                  </svg>
                </Link>
                );
              })}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
