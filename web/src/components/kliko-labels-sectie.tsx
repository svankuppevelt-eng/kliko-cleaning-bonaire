"use client";

// Klantkaart-sectie "Kliko-labels": per fysieke container een uniek
// klikonummer + QR-code, zodat buurman-containers nooit verwisseld worden.
// Office genereert hier de labels (teller-doc, zie lib/data/containers.ts),
// ziet per bak de laatste beurt en print de labels via /beheer/[id]/labels.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { KlikoQr } from "@/components/kliko-qr";
import {
  containerScanPad,
  deactiveerContainer,
  genereerContainersVoorKlant,
  listContainersVoorKlant,
} from "@/lib/data/containers";
import type { Container, Klant } from "@/lib/data/types";

export function KlikoLabelsSectie({ klant }: { klant: Klant }) {
  const { t, lang } = useI18n();
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [fout, setFout] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listContainersVoorKlant(klant.id)
      .then(setContainers)
      .catch(() => setFout(true));
  }, [klant.id]);

  const actieve = (containers ?? []).filter((c) => c.actief);
  const ontbrekend = Math.max(0, klant.aantalKlikos - actieve.length);

  async function genereer() {
    if (busy) return;
    setBusy(true);
    setFout(false);
    try {
      const lijst = await genereerContainersVoorKlant(klant, klant.aantalKlikos);
      setContainers(lijst);
    } catch {
      setFout(true);
    } finally {
      setBusy(false);
    }
  }

  async function deactiveer(container: Container) {
    if (busy) return;
    if (!window.confirm(t("kliko.labels.deactiveer.confirm"))) return;
    setBusy(true);
    setFout(false);
    try {
      await deactiveerContainer(container.id);
      setContainers((huidig) =>
        (huidig ?? []).map((c) =>
          c.id === container.id ? { ...c, actief: false } : c
        )
      );
    } catch {
      setFout(true);
    } finally {
      setBusy(false);
    }
  }

  function datumLabel(iso: string): string {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(
      lang === "en" ? "en-GB" : "nl-NL"
    );
  }

  return (
    <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
          {t("kliko.labels.title")}
        </h2>
        {actieve.length > 0 && (
          <Link
            href={`/beheer/${klant.id}/labels`}
            className="rounded-full border border-kliko-navy/20 px-3.5 py-1.5 text-xs font-bold text-kliko-navy hover:border-kliko-blue hover:text-kliko-blue"
          >
            {t("kliko.labels.print")}
          </Link>
        )}
      </div>
      <p className="mt-1 text-xs text-kliko-navy/50">{t("kliko.labels.uitleg")}</p>

      {fout && (
        <p className="mt-3 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("kliko.labels.err")}
        </p>
      )}

      {containers === null && !fout ? (
        <p className="mt-3 text-sm font-semibold text-kliko-navy/50">
          {t("beheer.loading")}
        </p>
      ) : (
        <>
          {(containers ?? []).length === 0 && (
            <p className="mt-3 text-sm font-semibold text-kliko-navy/50">
              {t("kliko.labels.leeg")}
            </p>
          )}

          {(containers ?? []).length > 0 && (
            <ul className="mt-3 flex flex-col divide-y divide-kliko-navy/10">
              {(containers ?? []).map((c) => (
                <li
                  key={c.id}
                  className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                    c.actief ? "" : "opacity-50"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <KlikoQr
                      pad={containerScanPad(c.id)}
                      size={64}
                      className="shrink-0 rounded border border-kliko-navy/10"
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-base font-black tracking-wide text-kliko-navy">
                        {c.klikonummer}
                      </p>
                      <p className="text-xs text-kliko-navy/55">
                        {t("kliko.labels.nr")} {c.volgnummer} &middot;{" "}
                        {c.laatsteReiniging
                          ? `${t("kliko.labels.laatste")}: ${datumLabel(c.laatsteReiniging)}`
                          : t("kliko.labels.nooit")}
                      </p>
                    </div>
                  </div>
                  {c.actief ? (
                    <button
                      type="button"
                      onClick={() => deactiveer(c)}
                      disabled={busy}
                      className="shrink-0 rounded-full border border-kliko-navy/15 px-3 py-1 text-xs font-bold text-kliko-navy/60 hover:border-kliko-red/40 hover:text-kliko-red disabled:opacity-50"
                    >
                      {t("kliko.labels.deactiveer")}
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-kliko-navy/10 px-2.5 py-0.5 text-xs font-bold text-kliko-navy/60">
                      {t("kliko.labels.inactief")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {ontbrekend > 0 && (
            <button
              type="button"
              onClick={genereer}
              disabled={busy}
              className="mt-3 rounded-full bg-kliko-blue px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? t("kliko.labels.genereer.busy")
                : `${t("kliko.labels.genereer")} (${ontbrekend})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
