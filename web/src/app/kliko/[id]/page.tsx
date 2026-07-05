"use client";

// Scan-landing van een kliko-label (/kliko/<containerId>). Dit is de URL die
// in de QR op de bak staat, zodat ook een scan met de gewone camera-app hier
// uitkomt. Toont klikonummer, klant en laatste beurt. Een ingelogde cleaner
// of office-gebruiker registreert hier met 1 knop een schoonmaakbeurt voor
// precies DEZE bak (+ optionele bewijsfoto). Niet ingelogd: nette melding
// met een link naar de login.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured, isStorageConfigured } from "@/lib/firebase";
import { useHuidigeGebruiker } from "@/lib/use-office-user";
import { getContainer } from "@/lib/data/containers";
import { getKlant } from "@/lib/data/klanten";
import {
  markeerContainerGedaan,
  uploadReinigingFoto,
  voegFotoToeAanReiniging,
} from "@/lib/data/reinigingen";
import { isoDatum } from "@/lib/data/planning";
import type { Container, Klant } from "@/lib/data/types";

type Fase = "idle" | "bezig" | "klaar" | "fout";

export default function KlikoScanPage() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();
  const gebruiker = useHuidigeGebruiker();

  const [container, setContainer] = useState<Container | null | undefined>(
    () => (isFirebaseConfigured() ? undefined : null)
  );
  const [klant, setKlant] = useState<Klant | null>(null);
  const [loadFout, setLoadFout] = useState(false);

  const [fase, setFase] = useState<Fase>("idle");
  const [geregistreerdOm, setGeregistreerdOm] = useState<string | null>(null);
  const [reinigingId, setReinigingId] = useState<string | null>(null);
  const [fotoStatus, setFotoStatus] = useState<
    "geen" | "bezig" | "klaar" | "fout"
  >("geen");

  const storageActief = isStorageConfigured();

  useEffect(() => {
    if (!params?.id || !isFirebaseConfigured()) return;
    getContainer(params.id)
      .then(async (c) => {
        setContainer(c);
        if (c) {
          // Klant-doc kan weg zijn (klant verwijderd); dan vallen we terug
          // op de gedenormaliseerde klantNaam op de container.
          try {
            setKlant(await getKlant(c.klantId));
          } catch {
            setKlant(null);
          }
        }
      })
      .catch(() => setLoadFout(true));
  }, [params?.id]);

  const vandaag = isoDatum(new Date());
  const alVandaag = container?.laatsteReiniging === vandaag;

  function datumLabel(iso: string): string {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(
      lang === "en" ? "en-GB" : "nl-NL"
    );
  }

  async function registreer() {
    if (!container || fase === "bezig" || gebruiker.status !== "ingelogd") {
      return;
    }
    setFase("bezig");
    try {
      const id = await markeerContainerGedaan({
        container,
        klant: klant
          ? { naam: klant.naam, adres: klant.adres, wijk: klant.wijk }
          : null,
        datum: vandaag,
        uitgevoerdDoorUid: gebruiker.user.uid,
        uitgevoerdDoorNaam: gebruiker.naam || gebruiker.email,
      });
      setReinigingId(id);
      setGeregistreerdOm(
        new Date().toLocaleTimeString(lang === "en" ? "en-GB" : "nl-NL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setContainer({ ...container, laatsteReiniging: vandaag });
      setFase("klaar");
    } catch {
      setFase("fout");
    }
  }

  async function fotoErbij(file: File) {
    if (!container || !reinigingId) return;
    setFotoStatus("bezig");
    try {
      const fotoUrl = await uploadReinigingFoto(vandaag, container.id, file);
      await voegFotoToeAanReiniging(reinigingId, fotoUrl);
      setFotoStatus("klaar");
    } catch {
      setFotoStatus("fout");
    }
  }

  const grootKnop =
    "block w-full rounded-xl px-4 py-3.5 text-center text-base font-bold";

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <div className="flex items-center gap-2.5">
        <LogoMark size={40} priority />
        <span className="text-sm font-black uppercase tracking-wider text-kliko-navy">
          Kliko Cleaning Bonaire
        </span>
      </div>

      {loadFout ? (
        <p className="mt-6 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("kliko.labels.err")}
        </p>
      ) : container === undefined ? (
        <p className="mt-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("beheer.loading")}
        </p>
      ) : container === null ? (
        <p className="mt-6 rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
          {t("kliko.pagina.notfound")}
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {/* De bak zelf: nummer groot, zodat de cleaner meteen kan checken
              dat het gescande label bij deze container hoort. */}
          <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-kliko-blue">
              {t("kliko.pagina.titel")}
            </p>
            <p className="mt-1 font-mono text-3xl font-black tracking-wide text-kliko-navy">
              {container.klikonummer}
            </p>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <div>
                <dt className="font-bold text-kliko-navy/60">
                  {t("kliko.pagina.klant")}
                </dt>
                <dd className="text-kliko-navy">
                  {klant?.naam ?? container.klantNaam}
                  {klant && (
                    <span className="block text-kliko-navy/60">
                      {klant.adres}, {klant.wijk}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">
                  {t("kliko.pagina.laatste")}
                </dt>
                <dd className="text-kliko-navy">
                  {container.laatsteReiniging
                    ? datumLabel(container.laatsteReiniging)
                    : t("kliko.labels.nooit")}
                </dd>
              </div>
            </dl>
          </div>

          {!container.actief ? (
            <p className="rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
              {t("kliko.pagina.inactief")}
            </p>
          ) : gebruiker.status === "loading" ||
            gebruiker.status === "unconfigured" ? null : gebruiker.status !==
            "ingelogd" ? (
            /* Niet ingelogd (bv. klant scant zelf): geen registratie-knop. */
            <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-kliko-navy/70">
                {t("kliko.pagina.login")}
              </p>
              <Link
                href="/login"
                className={`${grootKnop} mt-3 border-2 border-kliko-blue text-kliko-blue`}
              >
                {t("kliko.pagina.login.btn")}
              </Link>
            </div>
          ) : fase === "klaar" ? (
            /* Bevestiging: klant + klikonummer + tijd. */
            <div className="rounded-2xl border border-kliko-blue/30 bg-kliko-blue/5 p-5">
              <p className="text-lg font-black text-kliko-blue">
                {t("kliko.scan.geregistreerd")}
              </p>
              <p className="mt-1 text-sm font-semibold text-kliko-navy">
                {klant?.naam ?? container.klantNaam} &middot;{" "}
                {container.klikonummer}
                {geregistreerdOm ? <> &middot; {geregistreerdOm}</> : null}
              </p>
              {storageActief && fotoStatus !== "klaar" && (
                <label
                  className={`${grootKnop} mt-4 cursor-pointer bg-kliko-blue text-white ${
                    fotoStatus === "bezig" ? "opacity-60" : ""
                  }`}
                >
                  {fotoStatus === "bezig"
                    ? t("kliko.scan.foto.busy")
                    : t("kliko.scan.foto.toevoegen")}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={fotoStatus === "bezig"}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) fotoErbij(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {fotoStatus === "klaar" && (
                <p className="mt-3 text-sm font-bold text-kliko-blue">
                  {t("kliko.scan.foto.klaar")}
                </p>
              )}
              {fotoStatus === "fout" && (
                <p className="mt-3 text-sm font-bold text-kliko-red">
                  {t("kliko.scan.foto.err")}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {alVandaag && (
                <p className="rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
                  {t("kliko.scan.al")}
                </p>
              )}
              {fase === "fout" && (
                <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
                  {t("kliko.scan.opslaan.err")}
                </p>
              )}
              <button
                type="button"
                onClick={registreer}
                disabled={fase === "bezig"}
                className={`${grootKnop} bg-kliko-blue text-white disabled:opacity-60`}
              >
                {fase === "bezig"
                  ? t("detail.busy")
                  : t("kliko.pagina.markeer")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
