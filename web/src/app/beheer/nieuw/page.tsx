"use client";

// Office: nieuwe klant aanmaken, inclusief meteen een abonnement.
// Prijs wordt automatisch gevuld uit de office-prijstabel (instellingen/algemeen,
// met de constanten als fallback) en is handmatig te overschrijven.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { createAbonnement, createKlant } from "@/lib/data/klanten";
import {
  FREQUENTIES,
  formatUsd,
  kortingPctVoorAantal,
  totaalMaandPrijs,
} from "@/lib/data/prijzen";
import { WERKDAGEN } from "@/lib/data/planning";
import { useInstellingen } from "@/lib/use-instellingen";
import { useActieveBuurten } from "@/lib/use-buurten";
import { BuurtVeld } from "@/components/buurt-veld";
import type {
  AbonnementStatus,
  Frequentie,
  KlantTaal,
  KlantType,
  Weekdag,
} from "@/lib/data/types";

const FREQ_LABEL: Record<Frequentie, string> = {
  1: "price.f1",
  2: "price.f2",
  4: "price.f4",
};

const STATUSSEN: AbonnementStatus[] = ["actief", "pauze", "gestopt"];

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-4 py-2.5 text-base text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";
const selectCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-bold text-kliko-navy";

export default function NieuweKlantPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { instellingen } = useInstellingen();
  const { buurten, geladen: buurtenGeladen } = useActieveBuurten();

  // Klant
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [adres, setAdres] = useState("");
  const [wijk, setWijk] = useState("");
  const [aantalKlikos, setAantalKlikos] = useState(1);
  const [type, setType] = useState<KlantType>("huishouden");
  // Taalvoorkeur voor klant-mails; standaard Nederlands (het mail-vangnet).
  const [taal, setTaal] = useState<KlantTaal>("nl");
  const [notitie, setNotitie] = useState("");

  // Abonnement
  const [frequentie, setFrequentie] = useState<Frequentie>(2);
  const [status, setStatus] = useState<AbonnementStatus>("actief");
  const [vasteDag, setVasteDag] = useState<Weekdag | null>(null);
  const [prijs, setPrijs] = useState<string>("");
  const [prijsHandmatig, setPrijsHandmatig] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prijs beweegt automatisch mee met type/frequentie/aantal kliko's zolang
  // hij niet handmatig is overschreven (afgeleide waarde, geen effect nodig).
  // Alle containers zitten op 1 abonnement: de prijs is het TOTAAL voor alle
  // containers samen (aantal x basisprijs, min de container-korting).
  const aantal = Math.max(1, aantalKlikos);
  const basisPrijs = instellingen.prijzen[type][frequentie].maand;
  const kortingPct = kortingPctVoorAantal(instellingen.containerKorting, aantal);
  const autoPrijs = totaalMaandPrijs(
    type,
    frequentie,
    aantal,
    instellingen.prijzen,
    instellingen.containerKorting
  );
  const prijsWaarde = prijsHandmatig ? prijs : String(autoPrijs);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const prijsNum = Number(prijsWaarde);
    if (!naam.trim() || !email.trim() || !telefoon.trim() || !adres.trim() || !wijk.trim()) {
      setError(t("form.err.required"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("form.err.email"));
      return;
    }
    if (!Number.isFinite(prijsNum) || prijsNum <= 0) {
      setError(t("form.err.required"));
      return;
    }
    if (!isFirebaseConfigured()) {
      setError(t("login.offline"));
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
        aantalKlikos: aantal,
        type,
        taal,
        aangemaaktOp: new Date().toISOString(),
        ...(notitie.trim() ? { notitie: notitie.trim() } : {}),
      });
      await createAbonnement({
        klantId,
        type,
        frequentie,
        prijsPerMaand: prijsNum,
        status,
        startdatum: new Date().toISOString().slice(0, 10),
        vasteDag: vasteDag ?? null,
      });
      router.push(`/beheer/${klantId}`);
    } catch {
      setError(t("nieuw.err.save"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/beheer"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-kliko-blue hover:underline"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="15 5 8 12 15 19" />
        </svg>
        {t("detail.back")}
      </Link>

      <h1 className="mt-4 text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("nieuw.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("nieuw.sub")}</p>

      <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-5">
        {/* Klantgegevens */}
        <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
            {t("nieuw.gegevens")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="naam" className={labelCls}>{t("form.naam")}</label>
              <input id="naam" className={inputCls} value={naam} onChange={(e) => setNaam(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="email" className={labelCls}>{t("form.email")}</label>
              <input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" inputMode="email" />
            </div>
            <div>
              <label htmlFor="telefoon" className={labelCls}>{t("form.telefoon")}</label>
              <input id="telefoon" type="tel" className={inputCls} value={telefoon} onChange={(e) => setTelefoon(e.target.value)} autoComplete="off" inputMode="tel" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="adres" className={labelCls}>{t("form.adres")}</label>
              <input id="adres" className={inputCls} value={adres} onChange={(e) => setAdres(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="wijk" className={labelCls}>{t("form.wijk")}</label>
              <BuurtVeld
                id="wijk"
                value={wijk}
                onChange={setWijk}
                buurten={buurten}
                geladen={buurtenGeladen}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="klikos" className={labelCls}>{t("form.klikos")}</label>
              <input
                id="klikos"
                type="number"
                min={1}
                max={50}
                className={inputCls}
                value={aantalKlikos}
                onChange={(e) => setAantalKlikos(Number(e.target.value) || 1)}
                inputMode="numeric"
              />
            </div>
            <div>
              <label htmlFor="type" className={labelCls}>{t("signup.type")}</label>
              <select
                id="type"
                className={selectCls}
                value={type}
                onChange={(e) => setType(e.target.value as KlantType)}
              >
                <option value="huishouden">{t("price.home")}</option>
                <option value="bedrijf">{t("price.biz")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="taal" className={labelCls}>{t("form.taal")}</label>
              <select
                id="taal"
                className={selectCls}
                value={taal}
                onChange={(e) => setTaal(e.target.value as KlantTaal)}
              >
                <option value="pap">{t("taal.pap")}</option>
                <option value="nl">{t("taal.nl")}</option>
                <option value="en">{t("taal.en")}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notitie" className={labelCls}>{t("form.notitie")}</label>
              <textarea id="notitie" rows={3} className={inputCls} value={notitie} onChange={(e) => setNotitie(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Abonnement */}
        <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
            {t("detail.abonnement")}
          </h2>
          {/* 1 abonnement voor alle containers; de prijs is het maand-totaal. */}
          <p className="mt-1 text-xs text-kliko-navy/50">{t("abo.1abo")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="frequentie" className={labelCls}>{t("abo.freq")}</label>
              <select
                id="frequentie"
                className={selectCls}
                value={frequentie}
                onChange={(e) => setFrequentie(Number(e.target.value) as Frequentie)}
              >
                {FREQUENTIES.map((f) => (
                  <option key={f} value={f}>
                    {t(FREQ_LABEL[f])} ({formatUsd(instellingen.prijzen[type][f].maand)}{t("price.month")})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="prijs" className={labelCls}>{t("abo.prijs")}</label>
              <input
                id="prijs"
                type="number"
                min={1}
                step="0.01"
                className={inputCls}
                value={prijsWaarde}
                onChange={(e) => {
                  setPrijs(e.target.value);
                  setPrijsHandmatig(true);
                }}
                inputMode="decimal"
              />
              <p className="mt-1 text-xs text-kliko-navy/50">{t("nieuw.prijs.hint")}</p>
              {/* Opbouw van het voorstel: aantal x basisprijs (+ korting) = totaal. */}
              {aantal >= 2 && !prijsHandmatig && (
                <p className="mt-1 text-xs font-semibold text-kliko-blue">
                  {(kortingPct > 0
                    ? t("abo.opbouw.korting").replace("{pct}", String(kortingPct))
                    : t("abo.opbouw.geen")
                  )
                    .replace("{n}", String(aantal))
                    .replace("{basis}", formatUsd(basisPrijs))
                    .replace("{totaal}", formatUsd(autoPrijs))}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="status" className={labelCls}>{t("abo.status")}</label>
              <select
                id="status"
                className={selectCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as AbonnementStatus)}
              >
                {STATUSSEN.map((s) => (
                  <option key={s} value={s}>{t(`status.${s}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="vastedag" className={labelCls}>{t("plan.dag.label")}</label>
              <select
                id="vastedag"
                className={selectCls}
                value={vasteDag ?? ""}
                onChange={(e) =>
                  setVasteDag(e.target.value === "" ? null : (Number(e.target.value) as Weekdag))
                }
              >
                <option value="">{t("plan.optie.geen")}</option>
                {WERKDAGEN.map((d) => (
                  <option key={d} value={d}>{t(`dag.${d}`)}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-kliko-blue px-6 py-3 font-bold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? t("detail.busy") : t("nieuw.submit")}
          </button>
          <Link
            href="/beheer"
            className="rounded-full border border-kliko-navy/20 px-6 py-3 text-center font-bold text-kliko-navy hover:border-kliko-navy/40"
          >
            {t("detail.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
