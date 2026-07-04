"use client";

// Klantkaart-detail: contactgegevens, adres, abonnement, notitie. Read-only in Fase 1.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { getKlant, listAbonnementenVoorKlant } from "@/lib/data/klanten";
import { formatUsd } from "@/lib/data/prijzen";
import type { Abonnement, Klant } from "@/lib/data/types";

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

export default function KlantDetailPage() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();

  const [klant, setKlant] = useState<Klant | null | undefined>(undefined);
  const [abos, setAbos] = useState<Abonnement[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    if (!isFirebaseConfigured()) {
      setKlant(null);
      return;
    }
    Promise.all([getKlant(params.id), listAbonnementenVoorKlant(params.id)])
      .then(([k, a]) => {
        setKlant(k);
        setAbos(a);
      })
      .catch(() => setError(true));
  }, [params?.id]);

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

      {error ? (
        <p className="mt-5 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("beheer.err.load")}
        </p>
      ) : klant === undefined ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("beheer.loading")}
        </p>
      ) : klant === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("detail.notfound")}
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-black tracking-tight text-kliko-navy">
                {klant.naam}
              </h1>
              <span className="rounded-full bg-kliko-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-kliko-blue">
                {t(klant.type === "huishouden" ? "price.home" : "price.biz")}
              </span>
            </div>
            <p className="mt-1 text-xs text-kliko-navy/45">
              {t("beheer.aangemaakt")}:{" "}
              {new Date(klant.aangemaaktOp).toLocaleDateString(
                lang === "en" ? "en-GB" : "nl-NL"
              )}
            </p>

            <h2 className="mt-5 text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("detail.contact")}
            </h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.email")}</dt>
                <dd className="break-all text-kliko-navy">
                  <a href={`mailto:${klant.email}`} className="hover:text-kliko-blue">{klant.email}</a>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.telefoon")}</dt>
                <dd className="text-kliko-navy">
                  <a href={`tel:${klant.telefoon}`} className="hover:text-kliko-blue">{klant.telefoon}</a>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.adres")}</dt>
                <dd className="text-kliko-navy">{klant.adres}</dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.wijk")}</dt>
                <dd className="text-kliko-navy">{klant.wijk}</dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.klikos")}</dt>
                <dd className="text-kliko-navy">{klant.aantalKlikos}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("detail.abonnement")}
            </h2>
            {abos.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-kliko-navy/50">
                {t("beheer.geen.abo")}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-kliko-navy/10">
                {abos.map((abo) => (
                  <li key={abo.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-bold text-kliko-navy">
                        {t(FREQ_LABEL[abo.frequentie])}
                      </p>
                      <p className="text-xs text-kliko-navy/50">
                        {abo.startdatum}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black tabular-nums text-kliko-navy">
                        {formatUsd(abo.prijsPerMaand)}
                        <span className="text-sm font-semibold text-kliko-navy/50">
                          {t("price.month")}
                        </span>
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[abo.status]}`}>
                        {t(`status.${abo.status}`)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {klant.notitie && (
            <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                {t("detail.notitie")}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-kliko-navy">{klant.notitie}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
