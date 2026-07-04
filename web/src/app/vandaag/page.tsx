"use client";

// Schoonmaker-app: de stops van vandaag, mobiel-eerst.
// Grote tikbare knoppen, 1 kolom, hoog contrast (buiten in de zon).
// Gedaan = telefooncamera open (input capture) -> upload naar Storage ->
// reiniging-doc + abonnement.laatsteReiniging. Optimistic UI met nette fouten.
import { useEffect, useState } from "react";
import { SchoonmakerShell } from "@/components/schoonmaker-shell";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured, isStorageConfigured } from "@/lib/firebase";
import { useHuidigeGebruiker } from "@/lib/use-office-user";
import { listAbonnementenPerKlant, listKlanten } from "@/lib/data/klanten";
import {
  listReinigingenOpDatum,
  markeerGedaan,
  markeerOvergeslagen,
  uploadReinigingFoto,
  type ReinigingInput,
} from "@/lib/data/reinigingen";
import { isVandaagDue, isoDatum } from "@/lib/data/planning";
import type { Abonnement, Klant } from "@/lib/data/types";

type StopFase = "open" | "bezig" | "gedaan" | "overgeslagen" | "fout";

interface Stop {
  abo: Abonnement;
  klant: Klant;
  fase: StopFase;
  /** Duimafdruk: object-URL van de gemaakte foto of fotoUrl uit Firestore. */
  fotoThumb?: string;
  /** Bij fase "fout": was het de upload ("foto") of het opslaan ("save")? */
  foutType?: "foto" | "save";
}

type SkipReden = "nietbuiten" | "geblokkeerd" | "anders";

// Vaste NL-teksten voor in het reiniging-doc (Firestore-data, niet UI).
const SKIP_REDEN_TEKST: Record<SkipReden, string> = {
  nietbuiten: "Kliko niet buiten gezet",
  geblokkeerd: "Toegang geblokkeerd",
  anders: "Anders",
};

export default function VandaagPage() {
  return (
    <SchoonmakerShell>
      <StopsVanVandaag />
    </SchoonmakerShell>
  );
}

function StopsVanVandaag() {
  const { t } = useI18n();
  const gebruiker = useHuidigeGebruiker();

  const [datum, setDatum] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Overslaan-dialoog: 1 kaart tegelijk open.
  const [skipVoor, setSkipVoor] = useState<string | null>(null); // abonnementId
  const [skipReden, setSkipReden] = useState<SkipReden>("nietbuiten");
  const [skipTekst, setSkipTekst] = useState("");

  const storageActief = isStorageConfigured();

  useEffect(() => {
    // Lokale datum van het apparaat: schoonmakers staan op Bonaire.
    const nu = new Date();
    const vandaagIso = isoDatum(nu);
    setDatum(vandaagIso);
    if (!isFirebaseConfigured()) {
      setStops([]);
      return;
    }
    Promise.all([
      listKlanten(),
      listAbonnementenPerKlant(),
      listReinigingenOpDatum(vandaagIso),
    ])
      .then(([klanten, abosPerKlant, reinigingen]) => {
        const reinigingPerAbo = new Map(
          reinigingen.map((r) => [r.abonnementId, r])
        );
        const lijst: Stop[] = [];
        for (const klant of klanten) {
          for (const abo of abosPerKlant.get(klant.id) ?? []) {
            const reiniging = reinigingPerAbo.get(abo.id);
            if (reiniging) {
              // Vandaag al afgehandeld: tonen zodat de teller blijft kloppen.
              lijst.push({
                abo,
                klant,
                fase: reiniging.status === "gedaan" ? "gedaan" : "overgeslagen",
                fotoThumb: reiniging.fotoUrl,
              });
            } else if (isVandaagDue(abo, nu)) {
              lijst.push({ abo, klant, fase: "open" });
            }
          }
        }
        lijst.sort(
          (a, b) =>
            a.klant.wijk.localeCompare(b.klant.wijk) ||
            a.klant.naam.localeCompare(b.klant.naam)
        );
        setStops(lijst);
      })
      .catch(() => setLoadError(true));
  }, []);

  function patch(abonnementId: string, wijziging: Partial<Stop>) {
    setStops((huidig) =>
      (huidig ?? []).map((s) =>
        s.abo.id === abonnementId ? { ...s, ...wijziging } : s
      )
    );
  }

  function reinigingInput(stop: Stop): ReinigingInput {
    return {
      klantId: stop.klant.id,
      abonnementId: stop.abo.id,
      klantNaam: stop.klant.naam,
      adres: stop.klant.adres,
      wijk: stop.klant.wijk,
      datum: datum ?? isoDatum(new Date()),
      uitgevoerdDoorUid: gebruiker.status === "ingelogd" ? gebruiker.user.uid : "",
      uitgevoerdDoorNaam:
        gebruiker.status === "ingelogd"
          ? gebruiker.naam || gebruiker.email
          : "",
    };
  }

  async function slaGedaanOp(stop: Stop, fotoUrl?: string, notitie?: string) {
    patch(stop.abo.id, { fase: "bezig", foutType: undefined });
    try {
      await markeerGedaan({ ...reinigingInput(stop), fotoUrl, notitie });
      patch(stop.abo.id, { fase: "gedaan" });
    } catch {
      patch(stop.abo.id, { fase: "fout", foutType: "save" });
    }
  }

  async function handleFoto(stop: Stop, file: File) {
    // Optimistic: meteen duimafdruk tonen terwijl de upload loopt.
    const thumb = URL.createObjectURL(file);
    patch(stop.abo.id, { fase: "bezig", fotoThumb: thumb, foutType: undefined });
    let fotoUrl: string;
    try {
      fotoUrl = await uploadReinigingFoto(
        datum ?? isoDatum(new Date()),
        stop.abo.id,
        file
      );
    } catch {
      patch(stop.abo.id, { fase: "fout", foutType: "foto" });
      return;
    }
    await slaGedaanOp(stop, fotoUrl);
  }

  async function bevestigOverslaan(stop: Stop) {
    const reden =
      skipReden === "anders" && skipTekst.trim()
        ? `${SKIP_REDEN_TEKST.anders}: ${skipTekst.trim()}`
        : SKIP_REDEN_TEKST[skipReden];
    setSkipVoor(null);
    setSkipTekst("");
    patch(stop.abo.id, { fase: "bezig", foutType: undefined });
    try {
      await markeerOvergeslagen({ ...reinigingInput(stop), redenOverslaan: reden });
      patch(stop.abo.id, { fase: "overgeslagen" });
    } catch {
      patch(stop.abo.id, { fase: "fout", foutType: "save" });
    }
  }

  const afgehandeld = (stops ?? []).filter(
    (s) => s.fase === "gedaan" || s.fase === "overgeslagen"
  ).length;
  const totaal = stops?.length ?? 0;

  const grootKnop =
    "flex-1 rounded-xl px-4 py-3.5 text-center text-base font-bold";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-kliko-navy">
          {t("vandaag.title")}
        </h1>
        {datum && (
          <p className="text-sm font-semibold text-kliko-navy/50">{datum}</p>
        )}
      </div>

      {!storageActief && isFirebaseConfigured() && (
        <p className="rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
          {t("vandaag.storage.uit")}
        </p>
      )}

      {/* Voortgangsteller */}
      {stops !== null && totaal > 0 && (
        <div className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
          <p className="text-lg font-black tabular-nums text-kliko-navy">
            {afgehandeld} {t("vandaag.teller.van")} {totaal}{" "}
            {t("vandaag.teller.gedaan")}
          </p>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-kliko-navy/10">
            <div
              className="h-full rounded-full bg-kliko-blue"
              style={{
                width: `${totaal ? Math.round((afgehandeld / totaal) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {loadError ? (
        <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("vandaag.err.load")}
        </p>
      ) : stops === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("vandaag.loading")}
        </p>
      ) : stops.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("vandaag.leeg")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stops.map((stop) => {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${stop.klant.adres}, Bonaire`
            )}`;
            const klaar = stop.fase === "gedaan" || stop.fase === "overgeslagen";
            return (
              <li
                key={stop.abo.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  klaar ? "border-kliko-navy/10 opacity-80" : "border-kliko-navy/15"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-black leading-tight text-kliko-navy">
                      {stop.klant.naam}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-kliko-navy/70">
                      {stop.klant.adres}
                    </p>
                    <p className="text-sm text-kliko-navy/55">
                      {stop.klant.wijk} &middot; {stop.klant.aantalKlikos}{" "}
                      {t("beheer.klikos")}
                    </p>
                  </div>
                  {stop.fase === "gedaan" && (
                    <span className="flex shrink-0 items-center gap-2">
                      {stop.fotoThumb && (
                        // Duimafdruk van de bewijsfoto (object-URL of Storage-URL).
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={stop.fotoThumb}
                          alt=""
                          className="h-12 w-12 rounded-lg border border-kliko-navy/10 object-cover"
                        />
                      )}
                      <span className="rounded-full bg-kliko-blue/10 px-3 py-1 text-xs font-bold text-kliko-blue">
                        {t("vandaag.status.gedaan")}
                      </span>
                    </span>
                  )}
                  {stop.fase === "overgeslagen" && (
                    <span className="shrink-0 rounded-full bg-kliko-yellow/25 px-3 py-1 text-xs font-bold text-kliko-navy">
                      {t("vandaag.status.overgeslagen")}
                    </span>
                  )}
                </div>

                {stop.fase === "bezig" && (
                  <p className="mt-3 rounded-xl bg-kliko-navy/5 px-4 py-3 text-sm font-bold text-kliko-navy/70">
                    {t("vandaag.bezig")}
                  </p>
                )}

                {stop.fase === "fout" && (
                  <div className="mt-3 flex flex-col gap-2.5">
                    <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-bold text-kliko-red">
                      {stop.foutType === "foto"
                        ? t("vandaag.err.foto")
                        : t("vandaag.err.save")}
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        onClick={() =>
                          patch(stop.abo.id, {
                            fase: "open",
                            fotoThumb: undefined,
                            foutType: undefined,
                          })
                        }
                        className={`${grootKnop} border-2 border-kliko-navy/20 text-kliko-navy`}
                      >
                        {t("vandaag.opnieuw")}
                      </button>
                      <button
                        onClick={() => {
                          // Foto is niet opgeslagen: duimafdruk weghalen.
                          patch(stop.abo.id, { fotoThumb: undefined });
                          slaGedaanOp(stop, undefined, "Foto-upload niet gelukt");
                        }}
                        className={`${grootKnop} bg-kliko-blue text-white`}
                      >
                        {t("vandaag.zonderfoto")}
                      </button>
                    </div>
                  </div>
                )}

                {stop.fase === "open" && skipVoor === stop.abo.id && (
                  <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-kliko-navy/5 p-3">
                    <label className="text-sm font-bold text-kliko-navy">
                      {t("vandaag.reden.label")}
                      <select
                        value={skipReden}
                        onChange={(e) => setSkipReden(e.target.value as SkipReden)}
                        className="mt-1.5 w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-3 text-base font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none"
                      >
                        <option value="nietbuiten">
                          {t("vandaag.reden.nietbuiten")}
                        </option>
                        <option value="geblokkeerd">
                          {t("vandaag.reden.geblokkeerd")}
                        </option>
                        <option value="anders">{t("vandaag.reden.anders")}</option>
                      </select>
                    </label>
                    {skipReden === "anders" && (
                      <label className="text-sm font-bold text-kliko-navy">
                        {t("vandaag.reden.toelichting")}
                        <textarea
                          value={skipTekst}
                          onChange={(e) => setSkipTekst(e.target.value)}
                          rows={2}
                          className="mt-1.5 w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-base text-kliko-navy focus:border-kliko-blue focus:outline-none"
                        />
                      </label>
                    )}
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => {
                          setSkipVoor(null);
                          setSkipTekst("");
                        }}
                        className={`${grootKnop} border-2 border-kliko-navy/20 text-kliko-navy`}
                      >
                        {t("team.form.cancel")}
                      </button>
                      <button
                        onClick={() => bevestigOverslaan(stop)}
                        className={`${grootKnop} bg-kliko-red text-white`}
                      >
                        {t("vandaag.reden.bevestig")}
                      </button>
                    </div>
                  </div>
                )}

                {stop.fase === "open" && skipVoor !== stop.abo.id && (
                  <div className="mt-3 flex flex-col gap-2.5">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${grootKnop} border-2 border-kliko-blue text-kliko-blue`}
                    >
                      {t("vandaag.navigatie")}
                    </a>
                    <div className="flex gap-2.5">
                      {storageActief ? (
                        <label
                          className={`${grootKnop} cursor-pointer bg-kliko-blue text-white`}
                        >
                          {t("vandaag.gedaan.btn")}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFoto(stop, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ) : (
                        <button
                          onClick={() =>
                            slaGedaanOp(
                              stop,
                              undefined,
                              "Foto-upload nog niet actief"
                            )
                          }
                          className={`${grootKnop} bg-kliko-blue text-white`}
                        >
                          {t("vandaag.gedaan.kort")}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSkipVoor(stop.abo.id);
                          setSkipReden("nietbuiten");
                          setSkipTekst("");
                        }}
                        className={`${grootKnop} border-2 border-kliko-navy/20 text-kliko-navy`}
                      >
                        {t("vandaag.overslaan")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
