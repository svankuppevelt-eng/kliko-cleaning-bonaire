"use client";

// Publiek aanmeldformulier: schrijft een Klant + gekoppeld Abonnement naar
// Firestore (client-side Web SDK). Werkt pas echt zodra de Firebase env-vars
// gezet zijn; tot die tijd toont het formulier een duidelijke melding.
import { useMemo, useState } from "react";
import Link from "next/link";
import { LogoPrimary } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { createAbonnement, createKlant } from "@/lib/data/klanten";
import { FREQUENTIES, formatUsd, prijsVoor } from "@/lib/data/prijzen";
import type { Frequentie, KlantType } from "@/lib/data/types";

const FREQ_LABEL: Record<Frequentie, string> = {
  1: "price.f1",
  2: "price.f2",
  4: "price.f4",
};

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-4 py-3 text-base text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

export default function AanmeldenPage() {
  const { t } = useI18n();

  const [type, setType] = useState<KlantType>("huishouden");
  const [frequentie, setFrequentie] = useState<Frequentie>(2);
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [adres, setAdres] = useState("");
  const [wijk, setWijk] = useState("");
  const [aantalKlikos, setAantalKlikos] = useState(1);
  const [notitie, setNotitie] = useState("");

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = useMemo(() => isFirebaseConfigured(), []);
  const prijs = prijsVoor(type, frequentie);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!naam.trim() || !email.trim() || !telefoon.trim() || !adres.trim() || !wijk.trim()) {
      setError(t("form.err.required"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("form.err.email"));
      return;
    }
    if (!configured) {
      // Firebase nog niet gekoppeld: scherm blijft bruikbaar om te bekijken.
      setError(t("signup.offline"));
      return;
    }

    setBusy(true);
    try {
      const klantId = await createKlant({
        naam: naam.trim(),
        email: email.trim().toLowerCase(),
        telefoon: telefoon.trim(),
        adres: adres.trim(),
        wijk: wijk.trim(),
        aantalKlikos: Math.max(1, aantalKlikos),
        type,
        aangemaaktOp: new Date().toISOString(),
        ...(notitie.trim() ? { notitie: notitie.trim() } : {}),
      });
      await createAbonnement({
        klantId,
        type,
        frequentie,
        prijsPerMaand: prijs,
        status: "actief",
        startdatum: new Date().toISOString().slice(0, 10),
      });
      setDone(true);
    } catch {
      setError(t("form.err.save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-kliko-navy/[0.03]">
      <header className="border-b border-kliko-navy/10 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/">
            <LogoPrimary height={44} priority />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        {done ? (
          <div className="rounded-2xl border border-kliko-navy/10 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-kliko-yellow">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#0d2b6a" strokeWidth="3">
                <polyline points="4 12 10 18 20 6" />
              </svg>
            </span>
            <h1 className="mt-5 text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
              {t("signup.done.title")}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-kliko-navy/70">{t("signup.done.sub")}</p>
            <Link
              href="/"
              className="mt-7 inline-flex items-center justify-center rounded-full bg-kliko-blue px-6 py-3 font-bold text-white transition-transform hover:scale-[1.02]"
            >
              {t("signup.done.home")}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-black tracking-tight text-kliko-navy sm:text-4xl">
              {t("signup.title")}
            </h1>
            <p className="mt-2 max-w-xl text-kliko-navy/70">{t("signup.sub")}</p>

            {!configured && (
              <p className="mt-5 rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
                {t("signup.offline")}
              </p>
            )}

            <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-7">
              {/* Keuze: type + frequentie + prijs */}
              <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
                <label className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                  {t("signup.type")}
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["huishouden", "bedrijf"] as KlantType[]).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setType(tp)}
                      aria-pressed={type === tp}
                      className={`rounded-xl border px-4 py-3 font-bold transition-colors ${
                        type === tp
                          ? "border-kliko-blue bg-kliko-blue text-white"
                          : "border-kliko-navy/20 bg-white text-kliko-navy hover:border-kliko-blue/50"
                      }`}
                    >
                      {t(tp === "huishouden" ? "price.home" : "price.biz")}
                    </button>
                  ))}
                </div>

                <label className="mt-6 block text-sm font-bold uppercase tracking-wider text-kliko-blue">
                  {t("signup.freq")}
                </label>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {FREQUENTIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequentie(f)}
                      aria-pressed={frequentie === f}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 transition-colors sm:flex-col sm:items-start ${
                        frequentie === f
                          ? "border-kliko-blue bg-kliko-blue text-white"
                          : "border-kliko-navy/20 bg-white text-kliko-navy hover:border-kliko-blue/50"
                      }`}
                    >
                      <span className="font-bold">{t(FREQ_LABEL[f])}</span>
                      <span className={`text-sm font-semibold ${frequentie === f ? "text-white/80" : "text-kliko-navy/60"}`}>
                        {formatUsd(prijsVoor(type, f))}
                        {t("price.month")}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between rounded-xl bg-kliko-navy px-5 py-4">
                  <span className="font-bold text-white">{t("signup.price")}</span>
                  <span className="text-2xl font-black tabular-nums text-kliko-yellow">
                    {formatUsd(prijs)}
                    <span className="text-sm font-semibold text-white/70">{t("price.month")}</span>
                  </span>
                </div>
              </section>

              {/* Gegevens */}
              <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="naam" className="mb-1.5 block text-sm font-bold text-kliko-navy">
                      {t("form.naam")}
                    </label>
                    <input id="naam" className={inputCls} value={naam} onChange={(e) => setNaam(e.target.value)} autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-kliko-navy">
                      {t("form.email")}
                    </label>
                    <input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
                  </div>
                  <div>
                    <label htmlFor="telefoon" className="mb-1.5 block text-sm font-bold text-kliko-navy">
                      {t("form.telefoon")}
                    </label>
                    <input id="telefoon" type="tel" className={inputCls} value={telefoon} onChange={(e) => setTelefoon(e.target.value)} autoComplete="tel" inputMode="tel" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="adres" className="mb-1.5 block text-sm font-bold text-kliko-navy">
                      {t("form.adres")}
                    </label>
                    <input id="adres" className={inputCls} value={adres} onChange={(e) => setAdres(e.target.value)} autoComplete="street-address" />
                  </div>
                  <div>
                    <label htmlFor="wijk" className="mb-1.5 block text-sm font-bold text-kliko-navy">
                      {t("form.wijk")}
                    </label>
                    <input id="wijk" className={inputCls} value={wijk} onChange={(e) => setWijk(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="klikos" className="mb-1.5 block text-sm font-bold text-kliko-navy">
                      {t("form.klikos")}
                    </label>
                    <input
                      id="klikos"
                      type="number"
                      min={1}
                      max={20}
                      className={inputCls}
                      value={aantalKlikos}
                      onChange={(e) => setAantalKlikos(Number(e.target.value) || 1)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="notitie" className="mb-1.5 block text-sm font-bold text-kliko-navy">
                      {t("form.notitie")}
                    </label>
                    <textarea id="notitie" rows={3} className={inputCls} value={notitie} onChange={(e) => setNotitie(e.target.value)} />
                  </div>
                </div>
              </section>

              {error && (
                <p role="alert" className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-kliko-yellow px-6 py-4 text-lg font-bold text-black shadow-sm transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? t("form.sending") : t("form.submit")}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
