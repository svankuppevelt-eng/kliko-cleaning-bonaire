"use client";

import { LANGS, useI18n } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex rounded-full border border-kliko-navy/15 bg-white p-0.5">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={`rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
            lang === l.code
              ? "bg-kliko-navy text-white"
              : "text-kliko-navy/60 hover:text-kliko-navy"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
