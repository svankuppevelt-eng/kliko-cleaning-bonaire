"use client";

// Klant-CRM lijst: kaart-weergave (mobiel-vriendelijk, geen brede tabel),
// zoeken + filter op buurt (uit de buurten-collectie) en type, plus
// "Nieuwe klant"-knop naar /beheer/nieuw. Data client-side uit Firestore.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listAbonnementenPerKlant, listKlanten } from "@/lib/data/klanten";
import { formatUsd } from "@/lib/data/prijzen";
import { useActieveBuurten } from "@/lib/use-buurten";
import type { Abonnement, Klant, KlantType } from "@/lib/data/types";

const FREQ_LABEL: Record<number, string> = {
  1: "price.f1",
  2: "price.f2",
  4: "price.f4",
};

const STATUS_STYLE: Record<Abonnement["status"], string> = {
  actief: "bg-kliko-blue/10 text-kliko-blue",
  pauze: "bg-kliko-yellow/25 text-kliko-navy",
  gestopt: "bg-kliko-red/10 text-kliko-red",
};

export default function BeheerPage() {
  const { t, lang } = useI18n();
  const { buurten } = useActieveBuurten();

  // Zonder Firebase-config meteen een lege lijst (lazy initializer).
  const [klanten, setKlanten] = useState<Klant[] | null>(() =>
    isFirebaseConfigured() ? null : []
  );
  const [abosPerKlant, setAbosPerKlant] = useState<Map<string, Abonnement[]>>(new Map());
  const [error, setError] = useState(false);

  const [zoek, setZoek] = useState("");
  const [wijkFilter, setWijkFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | KlantType>("");

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    Promise.all([listKlanten(), listAbonnementenPerKlant()])
      .then(([k, a]) => {
        setKlanten(k);
        setAbosPerKlant(a);
      })
      .catch(() => setError(true));
  }, []);

  // Filter-opties: de actieve buurten (in office-volgorde) plus eventuele
  // wijken van bestaande klanten die niet (meer) in de lijst staan.
  const wijken = useMemo(() => {
    const uitLijst = buurten.map((b) => b.naam);
    const extra = Array.from(
      new Set((klanten ?? []).map((k) => k.wijk).filter(Boolean))
    )
      .filter((w) => !uitLijst.includes(w))
      .sort();
    return [...uitLijst, ...extra];
  }, [klanten, buurten]);

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return (klanten ?? []).filter((k) => {
      if (wijkFilter && k.wijk !== wijkFilter) return false;
      if (typeFilter && k.type !== typeFilter) return false;
      if (q) {
        const hay = `${k.naam} ${k.adres} ${k.wijk} ${k.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [klanten, zoek, wijkFilter, typeFilter]);

  const selectCls =
    "rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
          {t("beheer.title")}
          {klanten && (
            <span className="ml-2 align-middle text-base font-bold text-kliko-navy/40">
              {zichtbaar.length}
            </span>
          )}
        </h1>
        <Link
          href="/beheer/nieuw"
          className="inline-flex items-center gap-1.5 rounded-full bg-kliko-blue px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t("beheer.nieuw")}
        </Link>
      </div>

      {/* Zoek + filters */}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder={t("beheer.search")}
          className="w-full rounded-xl border border-kliko-navy/20 bg-white px-4 py-2.5 text-sm text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none sm:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select value={wijkFilter} onChange={(e) => setWijkFilter(e.target.value)} className={selectCls}>
            <option value="">{t("beheer.filter.wijk")}</option>
            {wijken.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | KlantType)}
            className={selectCls}
          >
            <option value="">{t("beheer.filter.type")}</option>
            <option value="huishouden">{t("price.home")}</option>
            <option value="bedrijf">{t("price.biz")}</option>
          </select>
        </div>
      </div>

      {/* Lijst */}
      <div className="mt-6">
        {error ? (
          <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
            {t("beheer.err.load")}
          </p>
        ) : klanten === null ? (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
            {t("beheer.loading")}
          </p>
        ) : zichtbaar.length === 0 ? (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
            {t("beheer.empty")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {zichtbaar.map((k) => {
              const abo = (abosPerKlant.get(k.id) ?? [])[0];
              return (
                <li key={k.id}>
                  <Link
                    href={`/beheer/${k.id}`}
                    className="block rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm transition-colors hover:border-kliko-blue/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-kliko-navy">{k.naam}</span>
                      {abo ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[abo.status]}`}>
                          {t(`status.${abo.status}`)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-kliko-navy/5 px-2.5 py-0.5 text-xs font-bold text-kliko-navy/50">
                          {t("beheer.geen.abo")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-kliko-navy/70">
                      {k.wijk} &middot; {t(k.type === "huishouden" ? "price.home" : "price.biz")} &middot; {k.aantalKlikos} {t("beheer.klikos")}
                    </p>
                    {abo && (
                      <p className="mt-1 text-sm font-semibold text-kliko-navy">
                        {t(FREQ_LABEL[abo.frequentie])} &middot; {formatUsd(abo.prijsPerMaand)}
                        {t("price.month")}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-kliko-navy/45">
                      {t("beheer.aangemaakt")}:{" "}
                      {new Date(k.aangemaaktOp).toLocaleDateString(
                        lang === "en" ? "en-GB" : "nl-NL"
                      )}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
