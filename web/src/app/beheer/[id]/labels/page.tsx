"use client";

// Print-weergave van de kliko-labels van 1 klant: klikonummer groot + QR +
// merknaam, netjes in een raster om te printen (stickerpapier) en op de
// containers te plakken. De office-shell verbergt zichzelf bij printen
// (print:hidden); hier verbergen we ook de eigen knoppenbalk.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { KlikoQr } from "@/components/kliko-qr";
import { getKlant } from "@/lib/data/klanten";
import {
  containerScanPad,
  listContainersVoorKlant,
} from "@/lib/data/containers";
import type { Container, Klant } from "@/lib/data/types";

export default function KlikoLabelsPrintPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();

  const [klant, setKlant] = useState<Klant | null | undefined>(() =>
    isFirebaseConfigured() ? undefined : null
  );
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [fout, setFout] = useState(false);

  useEffect(() => {
    if (!params?.id || !isFirebaseConfigured()) return;
    Promise.all([getKlant(params.id), listContainersVoorKlant(params.id)])
      .then(([k, c]) => {
        setKlant(k);
        setContainers(c.filter((x) => x.actief));
      })
      .catch(() => setFout(true));
  }, [params?.id]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Knoppenbalk: niet mee-printen. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/beheer/${params?.id ?? ""}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-kliko-blue hover:underline"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="15 5 8 12 15 19" />
          </svg>
          {t("kliko.print.terug")}
        </Link>
        {(containers?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-kliko-blue px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
          >
            {t("kliko.print.print")}
          </button>
        )}
      </div>

      {fout ? (
        <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red print:hidden">
          {t("kliko.labels.err")}
        </p>
      ) : klant === undefined || containers === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50 print:hidden">
          {t("beheer.loading")}
        </p>
      ) : klant === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50 print:hidden">
          {t("detail.notfound")}
        </p>
      ) : containers.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50 print:hidden">
          {t("kliko.labels.leeg")}
        </p>
      ) : (
        <>
          <div className="mb-4 print:hidden">
            <h1 className="text-2xl font-black tracking-tight text-kliko-navy">
              {t("kliko.labels.title")}: {klant.naam}
            </h1>
            <p className="mt-1 text-sm text-kliko-navy/55">
              {t("kliko.print.hint")}
            </p>
          </div>

          {/* Het label-raster: dit is wat er geprint wordt. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
            {containers.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-xl border-2 border-dashed border-kliko-navy/30 bg-white p-4"
                style={{ breakInside: "avoid" }}
              >
                <KlikoQr
                  pad={containerScanPad(c.id)}
                  size={110}
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-kliko-blue">
                    Kliko Cleaning Bonaire
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black tracking-wide text-kliko-navy">
                    {c.klikonummer}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-kliko-navy/70">
                    {klant.naam}
                  </p>
                  <p className="text-xs text-kliko-navy/50">
                    {t("kliko.labels.nr")} {c.volgnummer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
