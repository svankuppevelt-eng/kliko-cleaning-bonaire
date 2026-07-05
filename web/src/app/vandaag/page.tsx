"use client";

// Schoonmaker-app: de stops van vandaag, mobiel-eerst.
// Grote tikbare knoppen, 1 kolom, hoog contrast (buiten in de zon).
// Gedaan = telefooncamera open (input capture) -> upload naar Storage ->
// reiniging-doc + abonnement.laatsteReiniging. Optimistic UI met nette fouten.
import { useEffect, useMemo, useState } from "react";
import { SchoonmakerShell } from "@/components/schoonmaker-shell";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured, isStorageConfigured } from "@/lib/firebase";
import { useHuidigeGebruiker } from "@/lib/use-office-user";
import { useActieveBuurten } from "@/lib/use-buurten";
import { listAbonnementenPerKlant, listKlanten } from "@/lib/data/klanten";
import {
  listReinigingenOpDatum,
  markeerContainerGedaan,
  markeerGedaan,
  markeerOvergeslagen,
  uploadReinigingFoto,
  voegFotoToeAanReiniging,
  type ReinigingInput,
} from "@/lib/data/reinigingen";
import { getContainer, parseContainerScan } from "@/lib/data/containers";
import { getKlant } from "@/lib/data/klanten";
import { KlikoScanner } from "@/components/kliko-scanner";
import { isVandaagDue, isoDatum } from "@/lib/data/planning";
import type { Buurt } from "@/lib/data/buurten";
import type { Abonnement, Container, Klant, Reiniging } from "@/lib/data/types";

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

/** Resultaat-paneel na een QR-scan van een kliko-label. */
type ScanResultaat =
  | { type: "zoeken" }
  | { type: "fout"; berichtKey: string }
  | { type: "al"; container: Container; klantNaam: string; tijd: string | null }
  | {
      type: "klaar";
      container: Container;
      klantNaam: string;
      tijd: string;
      reinigingId: string;
    };

// Vaste NL-teksten voor in het reiniging-doc (Firestore-data, niet UI).
const SKIP_REDEN_TEKST: Record<SkipReden, string> = {
  nietbuiten: "Kliko niet buiten gezet",
  geblokkeerd: "Toegang geblokkeerd",
  anders: "Anders",
};

/**
 * De Google Maps route-URL ondersteunt ongeveer 9 tussenpunten (waypoints).
 * Met bestemming erbij dus max 10 stops per route-deel; bij meer stops
 * splitsen we de route in delen.
 */
const MAX_STOPS_PER_ROUTE = 10;

/** Adres URL-encoded met ", Bonaire" erachter, voor Google Maps. */
function mapsAdres(stop: Stop): string {
  return encodeURIComponent(`${stop.klant.adres}, Bonaire`);
}

/**
 * Label "Selibon: dinsdag ochtend" bij de eerste stop van een wijk, zodat de
 * schoonmaker ziet wanneer Selibon daar het afval ophaalt (klikos staan dan
 * buiten). Onbekend = null, dan tonen we niets.
 */
function selibonTekst(
  buurt: Buurt | undefined,
  t: (key: string) => string
): string | null {
  if (!buurt || (buurt.selibonDag == null && buurt.selibonDagdeel == null)) {
    return null;
  }
  const delen: string[] = [];
  if (buurt.selibonDag != null) delen.push(t(`dag.${buurt.selibonDag}`));
  if (buurt.selibonDagdeel) delen.push(t(`dagdeel.${buurt.selibonDagdeel}`));
  return `${t("selibon.label")}: ${delen.join(" ")}`;
}

/**
 * Route-URL voor 1 deel: origin laten we bewust weg, dan gebruikt Google
 * Maps de huidige locatie van de schoonmaker als startpunt. Destination =
 * laatste stop, waypoints = de tussenliggende stops in route-volgorde.
 */
function mapsRouteUrl(deel: Stop[]): string {
  const destination = mapsAdres(deel[deel.length - 1]);
  const waypoints = deel.slice(0, -1).map(mapsAdres).join("|");
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}${
    waypoints ? `&waypoints=${waypoints}` : ""
  }`;
}

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
  const { buurten } = useActieveBuurten();

  const [datum, setDatum] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Overslaan-dialoog: 1 kaart tegelijk open.
  const [skipVoor, setSkipVoor] = useState<string | null>(null); // abonnementId
  const [skipReden, setSkipReden] = useState<SkipReden>("nietbuiten");
  const [skipTekst, setSkipTekst] = useState("");

  // QR-scan van kliko-labels: registratie per fysieke container.
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scan, setScan] = useState<ScanResultaat | null>(null);
  const [scanFoto, setScanFoto] = useState<"geen" | "bezig" | "klaar" | "fout">(
    "geen"
  );
  // Vandaag geregistreerde container-beurten (uit Firestore + eigen scans),
  // voor de "x van y kliko's gescand" teller per stop en dubbel-scan detectie.
  const [containerReinigingen, setContainerReinigingen] = useState<Reiniging[]>(
    []
  );

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
        // Container-scans (abonnementId leeg) horen niet in de stop-afvinking;
        // die voeden de "x van y kliko's gescand" teller per stop.
        setContainerReinigingen(reinigingen.filter((r) => r.containerId));
        const reinigingPerAbo = new Map(
          reinigingen
            .filter((r) => !r.containerId)
            .map((r) => [r.abonnementId, r])
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

  /**
   * QR gescand: containerId uit de code halen, container + klant opzoeken en
   * direct een container-beurt registreren. De foto is daarna optioneel
   * (zelfde Storage-upload als de stop-flow). Al vandaag gescand = melding,
   * geen dubbel doc.
   */
  async function verwerkScan(tekst: string) {
    setScannerOpen(false);
    setScanFoto("geen");
    const containerId = parseContainerScan(tekst);
    if (!containerId) {
      setScan({ type: "fout", berichtKey: "kliko.scan.onbekend" });
      return;
    }
    setScan({ type: "zoeken" });
    try {
      const container = await getContainer(containerId);
      if (!container) {
        setScan({ type: "fout", berichtKey: "kliko.scan.onbekend" });
        return;
      }
      if (!container.actief) {
        setScan({ type: "fout", berichtKey: "kliko.pagina.inactief" });
        return;
      }
      const alGedaan = containerReinigingen.find(
        (r) => r.containerId === container.id
      );
      if (alGedaan) {
        setScan({
          type: "al",
          container,
          klantNaam: alGedaan.klantNaam || container.klantNaam,
          tijd: alGedaan.uitgevoerdOp
            ? new Date(alGedaan.uitgevoerdOp).toLocaleTimeString("nl-NL", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null,
        });
        return;
      }
      // Klant-doc kan weg zijn; dan de gedenormaliseerde naam op de container.
      let klant: Klant | null = null;
      try {
        klant = await getKlant(container.klantId);
      } catch {
        klant = null;
      }
      const vandaagIso = datum ?? isoDatum(new Date());
      const reinigingId = await markeerContainerGedaan({
        container,
        klant: klant
          ? { naam: klant.naam, adres: klant.adres, wijk: klant.wijk }
          : null,
        datum: vandaagIso,
        uitgevoerdDoorUid:
          gebruiker.status === "ingelogd" ? gebruiker.user.uid : "",
        uitgevoerdDoorNaam:
          gebruiker.status === "ingelogd"
            ? gebruiker.naam || gebruiker.email
            : "",
      });
      const klantNaam = klant?.naam ?? container.klantNaam;
      setContainerReinigingen((huidig) => [
        ...huidig,
        {
          id: reinigingId,
          klantId: container.klantId,
          abonnementId: "",
          klantNaam,
          adres: klant?.adres ?? "",
          wijk: klant?.wijk ?? "",
          datum: vandaagIso,
          status: "gedaan",
          containerId: container.id,
          klikonummer: container.klikonummer,
          uitgevoerdOp: new Date().toISOString(),
          uitgevoerdDoorUid: "",
          uitgevoerdDoorNaam: "",
        },
      ]);
      setScan({
        type: "klaar",
        container,
        klantNaam,
        tijd: new Date().toLocaleTimeString("nl-NL", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        reinigingId,
      });
    } catch {
      setScan({ type: "fout", berichtKey: "kliko.scan.opslaan.err" });
    }
  }

  /** Optionele bewijsfoto bij een zojuist gescande container-beurt. */
  async function scanFotoErbij(file: File) {
    if (scan?.type !== "klaar") return;
    setScanFoto("bezig");
    try {
      const fotoUrl = await uploadReinigingFoto(
        datum ?? isoDatum(new Date()),
        scan.container.id,
        file
      );
      await voegFotoToeAanReiniging(scan.reinigingId, fotoUrl);
      setScanFoto("klaar");
    } catch {
      setScanFoto("fout");
    }
  }

  // Aantal vandaag gescande containers per klant (distinct containerIds),
  // voor de "x van y kliko's gescand" regel op de stop-kaart.
  const gescandPerKlant = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of containerReinigingen) {
      if (!r.containerId) continue;
      const set = map.get(r.klantId) ?? new Set<string>();
      set.add(r.containerId);
      map.set(r.klantId, set);
    }
    return map;
  }, [containerReinigingen]);

  // Route-volgorde: eerst op de office-volgorde van de buurt (uit
  // /beheer/buurten), binnen een buurt op klantnaam. Stops met een buurt
  // die niet (meer) in de lijst staat komen achteraan. Echte afstand-
  // optimalisatie (kortste route) vereist later een Maps-API + geocoding;
  // tot die tijd ordenen we pragmatisch op buurt-volgorde.
  const buurtVolgorde = useMemo(
    () => new Map(buurten.map((b) => [b.naam, b.volgorde])),
    [buurten]
  );
  // Voor de Selibon-info bij de eerste stop van elke wijk.
  const buurtPerNaam = useMemo(
    () => new Map(buurten.map((b) => [b.naam, b])),
    [buurten]
  );
  const route = useMemo(() => {
    const lijst = [...(stops ?? [])];
    lijst.sort((a, b) => {
      const va = buurtVolgorde.get(a.klant.wijk) ?? Number.MAX_SAFE_INTEGER;
      const vb = buurtVolgorde.get(b.klant.wijk) ?? Number.MAX_SAFE_INTEGER;
      return (
        va - vb ||
        a.klant.wijk.localeCompare(b.klant.wijk) ||
        a.klant.naam.localeCompare(b.klant.naam)
      );
    });
    return lijst;
  }, [stops, buurtVolgorde]);

  // Alleen de nog niet afgehandelde stops horen in de navigatie-route.
  const teRijden = route.filter(
    (s) => s.fase !== "gedaan" && s.fase !== "overgeslagen"
  );
  const routeDelen: Stop[][] = [];
  for (let i = 0; i < teRijden.length; i += MAX_STOPS_PER_ROUTE) {
    routeDelen.push(teRijden.slice(i, i + MAX_STOPS_PER_ROUTE));
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

      {/* Scan kliko: QR-label op de bak scannen en de beurt per container
          registreren. Werkt ook voor bakken buiten de stops van vandaag. */}
      {isFirebaseConfigured() && (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              setScan(null);
              setScanFoto("geen");
              setScannerOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-kliko-navy bg-white px-4 py-3.5 text-base font-bold text-kliko-navy"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M3 8V5a2 2 0 0 1 2-2h3" />
              <path d="M16 3h3a2 2 0 0 1 2 2v3" />
              <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
              <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
              <line x1="3" y1="12" x2="21" y2="12" />
            </svg>
            {t("kliko.scan.btn")}
          </button>

          {scan?.type === "zoeken" && (
            <p className="rounded-xl bg-kliko-navy/5 px-4 py-3 text-sm font-bold text-kliko-navy/70">
              {t("kliko.scan.zoeken")}
            </p>
          )}
          {scan?.type === "fout" && (
            <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
              {t(scan.berichtKey)}
            </p>
          )}
          {scan?.type === "al" && (
            <div className="rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3">
              <p className="text-sm font-bold text-kliko-navy">
                {t("kliko.scan.al")}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-kliko-navy/70">
                {scan.klantNaam} &middot; {scan.container.klikonummer}
                {scan.tijd ? <> &middot; {scan.tijd}</> : null}
              </p>
            </div>
          )}
          {scan?.type === "klaar" && (
            <div className="rounded-xl border border-kliko-blue/30 bg-kliko-blue/5 px-4 py-3">
              <p className="text-base font-black text-kliko-blue">
                {t("kliko.scan.geregistreerd")}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-kliko-navy">
                {scan.klantNaam} &middot; {scan.container.klikonummer} &middot;{" "}
                {scan.tijd}
              </p>
              {storageActief && scanFoto !== "klaar" && (
                <label
                  className={`mt-2.5 flex cursor-pointer items-center justify-center rounded-xl bg-kliko-blue px-4 py-3 text-sm font-bold text-white ${
                    scanFoto === "bezig" ? "opacity-60" : ""
                  }`}
                >
                  {scanFoto === "bezig"
                    ? t("kliko.scan.foto.busy")
                    : t("kliko.scan.foto.toevoegen")}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={scanFoto === "bezig"}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) scanFotoErbij(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {scanFoto === "klaar" && (
                <p className="mt-2 text-sm font-bold text-kliko-blue">
                  {t("kliko.scan.foto.klaar")}
                </p>
              )}
              {scanFoto === "fout" && (
                <p className="mt-2 text-sm font-bold text-kliko-red">
                  {t("kliko.scan.foto.err")}
                </p>
              )}
            </div>
          )}
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
        <>
          {/* Start route: hele rij nog-te-rijden stops in 1 Google Maps route.
              Bij meer dan MAX_STOPS_PER_ROUTE stops gesplitst in delen. */}
          {teRijden.length >= 2 && (
            <div className="flex flex-col gap-2">
              {routeDelen.length > 1 && (
                <p className="text-xs font-semibold text-kliko-navy/60">
                  {t("vandaag.route.gesplitst")}
                </p>
              )}
              {routeDelen.map((deel, i) => (
                <a
                  key={i}
                  href={mapsRouteUrl(deel)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-kliko-navy px-4 py-3.5 text-base font-bold text-white"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <polygon points="6 4 18 12 6 20" />
                  </svg>
                  {routeDelen.length === 1
                    ? t("vandaag.route.start")
                    : `${t("vandaag.route.deel")} ${i + 1}`}
                  <span className="text-sm font-semibold text-white/70">
                    ({deel.length} {t("vandaag.route.stops")})
                  </span>
                </a>
              ))}
            </div>
          )}

          <ul className="flex flex-col gap-3">
          {route.map((stop, idx) => {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${stop.klant.adres}, Bonaire`
            )}`;
            const klaar = stop.fase === "gedaan" || stop.fase === "overgeslagen";
            // Selibon-info alleen bij de eerste stop van een wijk (de route
            // is op wijk gesorteerd), zodat de lijst rustig blijft.
            const eersteVanWijk =
              idx === 0 || route[idx - 1].klant.wijk !== stop.klant.wijk;
            const selibon = eersteVanWijk
              ? selibonTekst(buurtPerNaam.get(stop.klant.wijk), t)
              : null;
            // Vandaag per QR gescande containers van deze klant (kan meer
            // zijn dan aantalKlikos als er losse labels bij zijn gekomen).
            const gescand = gescandPerKlant.get(stop.klant.id)?.size ?? 0;
            return (
              <li
                key={stop.abo.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  klaar ? "border-kliko-navy/10 opacity-80" : "border-kliko-navy/15"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {/* Zichtbaar route-nummer (1, 2, 3, ...) in route-volgorde. */}
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums ${
                        klaar
                          ? "bg-kliko-navy/10 text-kliko-navy/50"
                          : "bg-kliko-blue text-white"
                      }`}
                    >
                      {idx + 1}
                    </span>
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
                      {selibon && (
                        <p className="mt-0.5 text-xs font-semibold text-kliko-navy/45">
                          {selibon}
                        </p>
                      )}
                      {gescand > 0 && (
                        <p className="mt-1 inline-block rounded-full bg-kliko-blue/10 px-2.5 py-0.5 text-xs font-bold text-kliko-blue">
                          {t("kliko.scan.teller")
                            .replace("{x}", String(gescand))
                            .replace("{y}", String(stop.klant.aantalKlikos))}
                        </p>
                      )}
                    </div>
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
        </>
      )}

      {/* Fullscreen camera-overlay voor het scannen van een kliko-label. */}
      {scannerOpen && (
        <KlikoScanner
          onGescand={verwerkScan}
          onSluit={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
