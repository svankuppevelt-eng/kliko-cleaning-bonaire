"use client";

// Office: teksten van de publieke landingspagina bewerken, per sectie en
// per taal (pap/nl/en). Opgeslagen in Firestore-doc siteContent/landing;
// een leeg veld = terugvallen op de i18n-standaardtekst (die als grijze
// placeholder in elk veld staat). Toegang via de OfficeShell-gate in de
// beheer-layout: eigenaar en kantoor mogen bewerken.
import { useEffect, useState } from "react";
import { LANGS, standaardTekst, useI18n, type Lang } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  getLandingContent,
  saveLandingContent,
  type LandingOverrides,
} from "@/lib/data/site-content";

type Veld = {
  /** i18n-key op de landingspagina, tevens veldnaam in siteContent/landing. */
  key: string;
  /** i18n-key voor het label boven het veld. */
  label: string;
  /** Textarea voor langere teksten, anders een gewone input. */
  lang?: boolean;
};

type Sectie = { label: string; velden: Veld[] };

const SECTIES: Sectie[] = [
  {
    label: "site.sec.hero",
    velden: [
      { key: "hero.title", label: "site.f.titel" },
      { key: "hero.sub", label: "site.f.ondertitel", lang: true },
      { key: "hero.cta1", label: "site.f.knop1" },
      { key: "hero.cta2", label: "site.f.knop2" },
    ],
  },
  {
    label: "site.sec.trust",
    velden: [
      { key: "trust.1", label: "site.f.punt1" },
      { key: "trust.2", label: "site.f.punt2" },
      { key: "trust.3", label: "site.f.punt3" },
    ],
  },
  {
    label: "site.sec.how",
    velden: [
      { key: "how.title", label: "site.f.titel" },
      { key: "how.s1t", label: "site.f.stap1titel" },
      { key: "how.s1d", label: "site.f.stap1tekst", lang: true },
      { key: "how.s2t", label: "site.f.stap2titel" },
      { key: "how.s2d", label: "site.f.stap2tekst", lang: true },
      { key: "how.s3t", label: "site.f.stap3titel" },
      { key: "how.s3d", label: "site.f.stap3tekst", lang: true },
    ],
  },
  {
    label: "site.sec.price",
    velden: [
      { key: "price.title", label: "site.f.titel" },
      { key: "price.sub", label: "site.f.ondertitel" },
      { key: "price.note", label: "site.f.voetnoot" },
    ],
  },
  {
    label: "site.sec.cta",
    velden: [
      { key: "cta.title", label: "site.f.titel" },
      { key: "cta.sub", label: "site.f.ondertitel", lang: true },
      { key: "cta.btn", label: "site.f.knop" },
    ],
  },
  {
    label: "site.sec.footer",
    velden: [{ key: "foot.tagline", label: "site.f.tagline" }],
  },
  {
    label: "site.sec.nav",
    velden: [
      { key: "nav.how", label: "site.f.menu1" },
      { key: "nav.prices", label: "site.f.menu2" },
      { key: "nav.contact", label: "site.f.menu3" },
      { key: "nav.signup", label: "site.f.menuknop" },
    ],
  },
];

const TALEN: Lang[] = LANGS.map((l) => l.code);

/** Formulier-state: per key altijd alle drie de talen als string. */
type FormState = Record<string, Record<Lang, string>>;

function naarForm(overrides: LandingOverrides): FormState {
  const form: FormState = {};
  for (const sectie of SECTIES) {
    for (const veld of sectie.velden) {
      form[veld.key] = {
        pap: overrides[veld.key]?.pap ?? "",
        nl: overrides[veld.key]?.nl ?? "",
        en: overrides[veld.key]?.en ?? "",
      };
    }
  }
  return form;
}

/** Alleen ingevulde waarden bewaren; lege velden verdwijnen uit het doc. */
function naarOverrides(form: FormState): LandingOverrides {
  const overrides: LandingOverrides = {};
  for (const [key, talen] of Object.entries(form)) {
    const gevuld: Partial<Record<Lang, string>> = {};
    for (const lang of TALEN) {
      const tekst = talen[lang].trim();
      if (tekst !== "") gevuld[lang] = tekst;
    }
    if (Object.keys(gevuld).length > 0) overrides[key] = gevuld;
  }
  return overrides;
}

const veldCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm text-kliko-navy placeholder:text-kliko-navy/35 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

export default function WebsiteTekstenPage() {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [melding, setMelding] = useState<{ tekst: string; fout: boolean } | null>(null);

  useEffect(() => {
    // getLandingContent vangt fouten zelf af en geeft dan {} terug,
    // zodat de editor altijd opent (met lege velden = standaardteksten).
    getLandingContent().then((overrides) => setForm(naarForm(overrides)));
  }, []);

  function zetTekst(key: string, lang: Lang, waarde: string) {
    setForm((huidig) =>
      huidig
        ? { ...huidig, [key]: { ...huidig[key], [lang]: waarde } }
        : huidig
    );
  }

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    setMelding(null);
    if (!isFirebaseConfigured()) {
      setMelding({ tekst: t("login.offline"), fout: true });
      return;
    }
    setBusy(true);
    try {
      await saveLandingContent(naarOverrides(form));
      setMelding({ tekst: t("site.saved"), fout: false });
    } catch {
      setMelding({ tekst: t("site.err.save"), fout: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
            {t("site.title")}
          </h1>
          <p className="mt-1 text-sm text-kliko-navy/60">{t("site.sub")}</p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="rounded-full border border-kliko-navy/20 px-4 py-2 text-sm font-bold text-kliko-navy hover:border-kliko-navy/40"
        >
          {t("site.bekijk")}
        </a>
      </div>

      <p className="mt-4 rounded-xl border border-kliko-blue/20 bg-kliko-blue/5 px-4 py-3 text-sm text-kliko-navy/80">
        {t("site.uitleg")}
      </p>

      {form === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("site.loading")}
        </p>
      ) : (
        <form onSubmit={opslaan} className="mt-6 flex flex-col gap-5">
          {SECTIES.map((sectie) => (
            <section
              key={sectie.label}
              className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                {t(sectie.label)}
              </h2>
              <div className="mt-4 flex flex-col gap-5">
                {sectie.velden.map((veld) => (
                  <div key={veld.key}>
                    <p className="mb-1.5 text-xs font-bold text-kliko-navy/60">
                      {t(veld.label)}
                    </p>
                    {/* Drie taalvelden: naast elkaar op desktop, onder elkaar op mobiel. */}
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {TALEN.map((lang) => {
                        const id = `site-${veld.key}-${lang}`;
                        const standaard = standaardTekst(lang, veld.key);
                        return (
                          <div key={lang}>
                            <label
                              htmlFor={id}
                              className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-kliko-navy/40"
                            >
                              {lang}
                            </label>
                            {veld.lang ? (
                              <textarea
                                id={id}
                                rows={3}
                                className={`${veldCls} resize-y`}
                                placeholder={standaard}
                                value={form[veld.key][lang]}
                                onChange={(e) => zetTekst(veld.key, lang, e.target.value)}
                              />
                            ) : (
                              <input
                                id={id}
                                type="text"
                                className={veldCls}
                                placeholder={standaard}
                                value={form[veld.key][lang]}
                                onChange={(e) => zetTekst(veld.key, lang, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {melding && (
            <p
              role="alert"
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                melding.fout
                  ? "border-kliko-red/30 bg-kliko-red/10 text-kliko-red"
                  : "border-kliko-blue/30 bg-kliko-blue/10 text-kliko-blue"
              }`}
            >
              {melding.tekst}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-full bg-kliko-blue px-6 py-3 font-bold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? t("detail.busy") : t("site.save")}
          </button>
        </form>
      )}
    </div>
  );
}
