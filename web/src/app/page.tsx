"use client";

import { LogoPrimary, LogoMark } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLandingText } from "@/lib/use-landing-text";
import { useInstellingen } from "@/lib/use-instellingen";

export default function Home() {
  // tt = tekst met office-override uit siteContent/landing (bewerkbaar via
  // /beheer/website), t = de vaste i18n-tekst. tt valt zelf terug op t.
  const { tt, t } = useLandingText();
  // Prijzen uit de office-instellingen (instellingen/algemeen), met de
  // constanten als fallback zolang het doc er niet is of Firestore stil is.
  const { instellingen } = useInstellingen();

  // Per frequentie de maandprijs (hoofdprijs) en de jaarprijs (12 maanden in
  // 1 betaling, voordeliger) uit de office-instellingen.
  const plans = [
    {
      key: "home",
      freqs: [
        { f: "price.f1", p: instellingen.prijzen.huishouden[1].maand, j: instellingen.prijzen.huishouden[1].jaar },
        { f: "price.f2", p: instellingen.prijzen.huishouden[2].maand, j: instellingen.prijzen.huishouden[2].jaar },
        { f: "price.f4", p: instellingen.prijzen.huishouden[4].maand, j: instellingen.prijzen.huishouden[4].jaar },
      ],
    },
    {
      key: "biz",
      freqs: [
        { f: "price.f1", p: instellingen.prijzen.bedrijf[1].maand, j: instellingen.prijzen.bedrijf[1].jaar },
        { f: "price.f2", p: instellingen.prijzen.bedrijf[2].maand, j: instellingen.prijzen.bedrijf[2].jaar },
        { f: "price.f4", p: instellingen.prijzen.bedrijf[4].maand, j: instellingen.prijzen.bedrijf[4].jaar },
      ],
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-kliko-navy/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <LogoPrimary height={50} priority />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-kliko-navy md:flex">
            <a href="#how" className="hover:text-kliko-blue">{tt("nav.how")}</a>
            <a href="#prices" className="hover:text-kliko-blue">{tt("nav.prices")}</a>
            <a href="#contact" className="hover:text-kliko-blue">{tt("nav.contact")}</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <a
              href="/aanmelden"
              className="rounded-full bg-kliko-yellow px-4 py-2 text-sm font-bold text-black transition-transform hover:scale-[1.03]"
            >
              {tt("nav.signup")}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 80% at 85% 10%, rgba(0,119,204,0.10), transparent 60%), radial-gradient(50% 60% at 5% 90%, rgba(255,194,14,0.14), transparent 60%)",
          }}
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-kliko-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-kliko-blue">
              Bonaire
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-kliko-navy text-balance sm:text-5xl md:text-6xl">
              {tt("hero.title")}
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-kliko-navy/70">
              {tt("hero.sub")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/aanmelden"
                className="inline-flex items-center justify-center rounded-full bg-kliko-yellow px-6 py-3.5 text-base font-bold text-black shadow-sm transition-transform hover:scale-[1.03]"
              >
                {tt("hero.cta1")}
              </a>
              <a
                href="#contact"
                className="inline-flex items-center justify-center rounded-full bg-kliko-blue px-6 py-3.5 text-base font-bold text-white transition-transform hover:scale-[1.03]"
              >
                {tt("hero.cta2")}
              </a>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="relative grid place-items-center">
              <div className="absolute h-64 w-64 rounded-full bg-kliko-yellow/20 blur-2xl sm:h-80 sm:w-80" />
              <LogoMark size={300} priority />
            </div>
          </div>
        </div>

        {/* Trust bar */}
        <div className="border-y border-kliko-navy/10 bg-kliko-navy">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 text-sm font-semibold text-white sm:flex-row sm:items-center sm:justify-center sm:gap-10 sm:px-6">
            {["trust.1", "trust.2", "trust.3"].map((k) => (
              <span key={k} className="flex items-center gap-2">
                <CheckDot />
                {tt(k)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="text-center text-3xl font-black tracking-tight text-kliko-navy text-balance sm:text-4xl">
          {tt("how.title")}
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { n: "1", t: "how.s1t", d: "how.s1d" },
            { n: "2", t: "how.s2t", d: "how.s2d" },
            { n: "3", t: "how.s3t", d: "how.s3d" },
          ].map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-kliko-navy/10 bg-white p-6 shadow-sm"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-kliko-blue text-lg font-black text-white">
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-bold text-kliko-navy">{tt(s.t)}</h3>
              <p className="mt-1.5 text-kliko-navy/70">{tt(s.d)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="prices" className="bg-kliko-navy/[0.03] py-16 md:py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight text-kliko-navy text-balance sm:text-4xl">
            {tt("price.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-kliko-navy/70">
            {tt("price.sub")}
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className="rounded-2xl border border-kliko-navy/10 bg-white p-6 shadow-sm sm:p-8"
              >
                <h3 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                  {t(`price.${plan.key}`)}
                </h3>
                <div className="mt-5 flex flex-col divide-y divide-kliko-navy/10">
                  {plan.freqs.map((fr) => (
                    <div key={fr.f} className="flex items-center justify-between py-3">
                      <span className="font-semibold text-kliko-navy">{t(fr.f)}</span>
                      <span className="text-right">
                        <span className="text-2xl font-black tabular-nums text-kliko-navy">
                          ${fr.p}
                        </span>
                        <span className="text-sm text-kliko-navy/60">{t("price.month")}</span>
                        {/* Jaarprijs: 12 maanden in 1 betaling, met korting. */}
                        <span className="block text-xs font-semibold tabular-nums text-kliko-blue">
                          {t("price.year").replace("{prijs}", String(fr.j))}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <a
                  href="/aanmelden"
                  className="mt-6 block rounded-full bg-kliko-yellow px-5 py-3 text-center text-base font-bold text-black transition-transform hover:scale-[1.02]"
                >
                  {t("price.cta")}
                </a>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-kliko-navy/50">{tt("price.note")}</p>
        </div>
      </section>

      {/* CTA */}
      <section id="signup" className="bg-kliko-navy py-16 md:py-24">
        <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-black tracking-tight text-white text-balance sm:text-4xl">
            {tt("cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/75">{tt("cta.sub")}</p>
          <a
            href="/aanmelden"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-kliko-yellow px-8 py-4 text-lg font-bold text-black transition-transform hover:scale-[1.03]"
          >
            {tt("cta.btn")}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-kliko-navy/60 sm:flex-row sm:px-6">
          <LogoPrimary height={42} />
          <span>{tt("foot.tagline")}</span>
        </div>
      </footer>
    </div>
  );
}

function CheckDot() {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-kliko-yellow">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#0d2b6a" strokeWidth="3.5">
        <polyline points="4 12 10 18 20 6" />
      </svg>
    </span>
  );
}
