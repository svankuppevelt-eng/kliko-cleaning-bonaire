"use client";

// Office: prijsbeleid bewerken (multi-container kortingen, jaarcontractkorting,
// welkomstcadeaus). De offerte-tool gebruikt deze waarden. Alleen rol "eigenaar"
// mag wijzigen; "kantoor" ziet read-only. Overgezet uit de Streamlit-app.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { VerkoopTabs } from "@/components/verkoop-tabs";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useOfficeUser } from "@/lib/use-office-user";
import { useInstellingen } from "@/lib/use-instellingen";
import {
  DEFAULT_PRIJSBELEID,
  getPrijsBeleid,
  savePrijsBeleid,
  type PrijsBeleid,
} from "@/lib/data/prijsbeleid";
import { FREQUENTIES } from "@/lib/data/prijzen";
import type { Frequentie, KlantType } from "@/lib/data/types";
import { usd } from "@/lib/verkoop/offerte";

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2 text-sm text-kliko-navy focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30 disabled:bg-kliko-navy/5 disabled:text-kliko-navy/60";

const TYPE_LABEL: Record<KlantType, string> = {
  huishouden: "Huishouden",
  bedrijf: "Bedrijf",
};
const FREQ_LABEL: Record<Frequentie, string> = {
  1: "1x/mnd",
  2: "2x/mnd",
  4: "4x/mnd",
};

type FormState = Record<keyof PrijsBeleid, string>;

function naarForm(pb: PrijsBeleid): FormState {
  return {
    korting2eContainer: String(pb.korting2eContainer),
    korting3eContainer: String(pb.korting3eContainer),
    korting4eContainer: String(pb.korting4eContainer),
    kortingJaarcontract: String(pb.kortingJaarcontract),
    cadeauJaarcontract: pb.cadeauJaarcontract,
    cadeauWelkom: pb.cadeauWelkom,
  };
}

export default function PrijsbeleidPage() {
  const { t } = useI18n();
  const officeUser = useOfficeUser();
  const isEigenaar =
    officeUser.status === "office" && officeUser.rol === "eigenaar";
  const { instellingen } = useInstellingen();

  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [melding, setMelding] = useState<{ tekst: string; fout: boolean } | null>(
    null
  );

  useEffect(() => {
    getPrijsBeleid().then((pb) => setForm(naarForm(pb)));
  }, []);

  function zet(veld: keyof PrijsBeleid, waarde: string) {
    setForm((h) => (h ? { ...h, [veld]: waarde } : h));
  }

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (!form || busy || !isEigenaar) return;
    setMelding(null);

    const getal = (v: string) => Number(v);
    const pcts = [
      form.korting2eContainer,
      form.korting3eContainer,
      form.korting4eContainer,
      form.kortingJaarcontract,
    ].map(getal);
    if (pcts.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
      setMelding({ tekst: t("verkoop.pb.foutpct"), fout: true });
      return;
    }
    if (!isFirebaseConfigured()) {
      setMelding({ tekst: t("login.offline"), fout: true });
      return;
    }

    const pb: PrijsBeleid = {
      korting2eContainer: getal(form.korting2eContainer),
      korting3eContainer: getal(form.korting3eContainer),
      korting4eContainer: getal(form.korting4eContainer),
      kortingJaarcontract: getal(form.kortingJaarcontract),
      cadeauJaarcontract: form.cadeauJaarcontract.trim() || DEFAULT_PRIJSBELEID.cadeauJaarcontract,
      cadeauWelkom: form.cadeauWelkom.trim() || DEFAULT_PRIJSBELEID.cadeauWelkom,
    };

    setBusy(true);
    try {
      await savePrijsBeleid(pb);
      setMelding({ tekst: t("verkoop.pb.opgeslagen"), fout: false });
    } catch {
      setMelding({ tekst: t("verkoop.pb.foutsave"), fout: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <VerkoopTabs />
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("verkoop.pb.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("verkoop.pb.sub")}</p>

      {!isEigenaar && officeUser.status === "office" && (
        <p className="mt-4 rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
          {t("verkoop.pb.readonly")}
        </p>
      )}

      {/* Huidige prijstabel (read-only, uit instellingen) */}
      <section className="mt-6 rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
          {t("verkoop.pb.prijzen")}
        </h2>
        <p className="mt-1 text-xs text-kliko-navy/50">{t("verkoop.pb.prijzenhint")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["huishouden", "bedrijf"] as KlantType[]).map((type) => (
            <div key={type} className="rounded-xl bg-kliko-navy/[0.03] p-3">
              <h3 className="text-sm font-bold text-kliko-navy">
                {TYPE_LABEL[type]}
              </h3>
              <div className="mt-1 flex gap-4 text-sm tabular-nums text-kliko-navy/70">
                {FREQUENTIES.map((f) => (
                  <span key={f}>
                    {FREQ_LABEL[f]}:{" "}
                    <span className="font-bold text-kliko-navy">
                      {usd(instellingen.prijzen[type][f])}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {form === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("verkoop.pb.laden")}
        </p>
      ) : (
        <form onSubmit={opslaan} className="mt-4 flex flex-col gap-4">
          {/* Container-kortingen */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("verkoop.pb.kortingen")}
            </h2>
            <p className="mt-1 text-xs text-kliko-navy/50">
              {t("verkoop.pb.kortingenhint")}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["korting2eContainer", t("verkoop.pb.k2")],
                  ["korting3eContainer", t("verkoop.pb.k3")],
                  ["korting4eContainer", t("verkoop.pb.k4")],
                ] as [keyof PrijsBeleid, string][]
              ).map(([veld, label]) => (
                <div key={veld}>
                  <label className="mb-1 block text-xs font-bold text-kliko-navy/60">
                    {label}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      disabled={!isEigenaar}
                      className={inputCls}
                      value={form[veld]}
                      onChange={(e) => zet(veld, e.target.value)}
                    />
                    <span className="font-bold text-kliko-navy/50">%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Jaarcontract */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("verkoop.pb.jaarcontract")}
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-kliko-navy/60">
                  {t("verkoop.pb.jaarkorting")}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    disabled={!isEigenaar}
                    className={inputCls}
                    value={form.kortingJaarcontract}
                    onChange={(e) => zet("kortingJaarcontract", e.target.value)}
                  />
                  <span className="font-bold text-kliko-navy/50">%</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-kliko-navy/60">
                  {t("verkoop.pb.cadeaujaar")}
                </label>
                <input
                  disabled={!isEigenaar}
                  className={inputCls}
                  value={form.cadeauJaarcontract}
                  onChange={(e) => zet("cadeauJaarcontract", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Welkomstcadeau */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("verkoop.pb.welkom")}
            </h2>
            <label className="mb-1 mt-3 block text-xs font-bold text-kliko-navy/60">
              {t("verkoop.pb.cadeauwelkom")}
            </label>
            <input
              disabled={!isEigenaar}
              className={inputCls}
              value={form.cadeauWelkom}
              onChange={(e) => zet("cadeauWelkom", e.target.value)}
            />
          </section>

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

          {isEigenaar && (
            <button
              type="submit"
              disabled={busy}
              className="self-start rounded-full bg-kliko-blue px-6 py-3 font-bold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? t("verkoop.pb.bezig") : t("verkoop.pb.opslaan")}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
