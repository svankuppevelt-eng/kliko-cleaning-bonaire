// Repository-helpers voor Firestore-collectie `checklists`: office-beheerbare
// checklists (bv. het opstart-draaiboek van het bedrijf). Eén document = één
// checklist met de items als array in het doc; checklists zijn klein, zo
// blijft elke wijziging atomair (heel doc in 1 update).
// Alleen aanroepen vanuit client components (Web SDK, geen Admin SDK).
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export interface ChecklistItem {
  id: string;
  tekst: string;
  gedaan: boolean;
  /** ISO-datum/tijd van afvinken, null zolang niet gedaan. */
  gedaanOp?: string | null;
  /** Naam van wie afvinkte (uit useOfficeUser), null zolang niet gedaan. */
  gedaanDoorNaam?: string | null;
  /** Optionele vrije notitie bij het item. */
  notitie?: string;
  volgorde: number;
}

export interface Checklist {
  id: string;
  titel: string;
  omschrijving?: string;
  volgorde: number;
  /** ISO-datum/tijd van aanmaken. */
  aangemaaktOp: string;
  items: ChecklistItem[];
}

const CHECKLISTS = "checklists";

/** Uniek item-id; crypto.randomUUID met fallback voor oudere browsers. */
function nieuwItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `it-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Items altijd gesorteerd op volgorde teruggeven. */
function sorteerItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => a.volgorde - b.volgorde);
}

/** Alle checklists, gesorteerd op volgorde. */
export async function listChecklists(): Promise<Checklist[]> {
  const snap = await getDocs(
    query(collection(getDb(), CHECKLISTS), orderBy("volgorde", "asc"))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      items: sorteerItems((data.items as ChecklistItem[]) ?? []),
    } as Checklist;
  });
}

/** Nieuwe (lege) checklist onderaan de lijst. Geeft de checklist terug. */
export async function maakChecklist(titel: string): Promise<Checklist> {
  const bestaande = await listChecklists();
  const nieuw: Omit<Checklist, "id"> = {
    titel,
    volgorde: (bestaande.length + 1) * 10,
    aangemaaktOp: new Date().toISOString(),
    items: [],
  };
  const ref = doc(collection(getDb(), CHECKLISTS));
  await setDoc(ref, nieuw);
  return { id: ref.id, ...nieuw };
}

export async function updateChecklist(
  id: string,
  data: { titel?: string; omschrijving?: string }
): Promise<void> {
  // Firestore accepteert geen `undefined`: niet-meegegeven velden weglaten.
  const schoon = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(getDb(), CHECKLISTS, id), schoon);
}

export async function verwijderChecklist(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), CHECKLISTS, id));
}

/** Huidige items van een checklist lezen (bron van waarheid = Firestore). */
async function leesItems(id: string): Promise<ChecklistItem[]> {
  const snap = await getDoc(doc(getDb(), CHECKLISTS, id));
  if (!snap.exists()) throw new Error(`Checklist ${id} bestaat niet.`);
  return sorteerItems((snap.data().items as ChecklistItem[]) ?? []);
}

/** Items-array van het doc wegschrijven (1 atomaire update). */
async function schrijfItems(id: string, items: ChecklistItem[]): Promise<void> {
  await updateDoc(doc(getDb(), CHECKLISTS, id), { items });
}

/** Item onderaan toevoegen. Geeft het nieuwe item terug (voor de UI-state). */
export async function voegItemToe(
  id: string,
  tekst: string
): Promise<ChecklistItem> {
  const items = await leesItems(id);
  const item: ChecklistItem = {
    id: nieuwItemId(),
    tekst,
    gedaan: false,
    gedaanOp: null,
    gedaanDoorNaam: null,
    volgorde: (items.length + 1) * 10,
  };
  await schrijfItems(id, [...items, item]);
  return item;
}

/** Tekst en/of notitie van een item aanpassen. */
export async function wijzigItem(
  id: string,
  itemId: string,
  data: { tekst?: string; notitie?: string }
): Promise<void> {
  const items = await leesItems(id);
  const nieuw = items.map((it) => {
    if (it.id !== itemId) return it;
    const kopie = { ...it };
    if (data.tekst !== undefined) kopie.tekst = data.tekst;
    if (data.notitie !== undefined) kopie.notitie = data.notitie;
    return kopie;
  });
  await schrijfItems(id, nieuw);
}

/** Item af- of terugvinken; zet gedaanOp op nu (ISO) of null. */
export async function toggleItem(
  id: string,
  itemId: string,
  gedaan: boolean,
  gedaanDoorNaam: string
): Promise<void> {
  const items = await leesItems(id);
  const nieuw = items.map((it) =>
    it.id === itemId
      ? {
          ...it,
          gedaan,
          gedaanOp: gedaan ? new Date().toISOString() : null,
          gedaanDoorNaam: gedaan ? gedaanDoorNaam || null : null,
        }
      : it
  );
  await schrijfItems(id, nieuw);
}

export async function verwijderItem(id: string, itemId: string): Promise<void> {
  const items = await leesItems(id);
  await schrijfItems(
    id,
    items.filter((it) => it.id !== itemId)
  );
}

/**
 * Nieuwe volgorde wegschrijven: de meegegeven array is de gewenste volgorde,
 * alles wordt hernummerd naar (index+1)*10 (voorkomt dubbele volgorde-waarden).
 */
export async function herschikItems(
  id: string,
  items: ChecklistItem[]
): Promise<ChecklistItem[]> {
  const hernummerd = items.map((it, i) => ({ ...it, volgorde: (i + 1) * 10 }));
  await schrijfItems(id, hernummerd);
  return hernummerd;
}

/** Vaste doc-id op basis van de titel (slug), zodat een dubbele seed naar
 * dezelfde documenten schrijft en er nooit dubbele checklists ontstaan. */
function checklistDocId(titel: string): string {
  return titel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Startinhoud voor `seedChecklistsAlsLeeg()`: het opstart-draaiboek voor
 * Kliko Cleaning Bonaire. Bewust Nederlands: dit is bewerkbare content
 * (geen UI-chrome), office past het daarna zelf aan via /beheer/checklists.
 */
const START_CHECKLISTS: { titel: string; items: string[] }[] = [
  {
    titel: "Bedrijf oprichten (notaris en structuur)",
    items: [
      "Notaris op Bonaire kiezen (Bonaire Notaris of de tweede notaris)",
      "Rechtsvorm en naam vastleggen (Kliko Cleaning Bonaire B.V.)",
      "Aandeelhoudersstructuur bepalen: Holding Steffie (NL), Holding Geno (NL), Holding Roderick (Bonaire) met verdeling in procenten",
      "Bestuurder of directeur benoemen",
      "Aandeelhoudersovereenkomst (SHA) opstellen: stemrecht, winstuitkering, uitstappen (drag-along en tag-along)",
      "Oprichtingsakte en statuten laten opstellen (doel en aandelen)",
      "Oprichting in persoon ondertekenen bij de notaris (fysiek, geen e-sign)",
      "Oprichtingsakte en inschrijfdocumenten ontvangen",
    ],
  },
  {
    titel: "Registraties en vergunningen",
    items: [
      "Inschrijven bij KvK Bonaire, KvK-nummer en uittreksel ontvangen",
      "Vestigingsvergunning aanvragen bij het Openbaar Lichaam Bonaire (na KvK-uittreksel)",
      "Registreren bij Belastingdienst Caribisch Nederland en CRIB-nummer aanvragen",
      "ABB-registratie regelen (8 procent op diensten), aangifte via MijnCN",
      "Nagaan of er een milieu- of afvalvergunning nodig is voor kliko-reiniging (navraag bij Selibon en Openbaar Lichaam)",
      "Bij personeel: registreren voor loonbelasting en premies",
    ],
  },
  {
    titel: "Bank en financiele administratie",
    items: [
      "Zakelijke rekening openen bij MCB Bonaire of Scotiabank, in US dollars",
      "Documenten verzamelen: KvK-uittreksel, statuten, ID bestuurders, vestigingsvergunning, UBO-opgave",
      "Zakelijke pinpas of creditcard aanvragen",
      "Aandelenkapitaal storten indien vereist",
      "Boekhouder of administratiekantoor met BES-kennis kiezen",
      "Belastingadviseur met BES-kennis inschakelen (deelnemingsvrijstelling NL-holdings, CFC-regels)",
    ],
  },
  {
    titel: "Verzekeringen en juridisch",
    items: [
      "Bedrijfsaansprakelijkheidsverzekering afsluiten",
      "Voertuig- en materieelverzekering",
      "Ongevallen- of personeelsverzekering bij personeel",
      "Algemene voorwaarden voor de dienstverlening opstellen",
      "Privacyverklaring opstellen",
    ],
  },
  {
    titel: "Operationeel opstarten",
    items: [
      "Bedrijfsadres of vestigingslocatie regelen",
      "Reinigingswagen aanschaffen plus belettering in de huisstijl",
      "Reinigingsapparatuur en water-hergebruiksysteem",
      "Cleaner(s) werven en arbeidscontracten",
      "Bedrijfskleding (polo en pet met logo)",
      "Zakelijk e-mailadres info@klikocleaningbonaire.com (mailbox op one.com)",
      "Zakelijk telefoonnummer en WhatsApp Business",
    ],
  },
  {
    titel: "Systeem en online",
    items: [
      "Firebase upgraden naar Blaze",
      "Firestore en Storage security rules schrijven (nu testmodus)",
      "Domein klikocleaningbonaire.com koppelen aan Vercel",
      "Resend-domein verifieren om vanaf info@ naar klanten te mailen",
      "Betaalprovider koppelen (Sentoo of Stripe)",
      "Google Business profiel aanmaken",
      "Inlogaccounts voor het team aanmaken (Roderick als eigenaar via Team)",
    ],
  },
  {
    titel: "Marketing en lancering",
    items: [
      "Prijslijst definitief maken",
      "Website live zetten en teksten controleren",
      "Social media aanmaken (Facebook en Instagram Bonaire)",
      "Eerste wijken benaderen en flyers",
      "Aanmeldflow testen met een echte klant",
    ],
  },
];

/**
 * Idempotente seed: schrijft het opstart-draaiboek alleen als de collectie
 * leeg is. Wordt aangeroepen bij het openen van /beheer/checklists. Vaste
 * doc-id's (slug van de titel) zorgen dat zelfs een dubbele aanroep
 * (bv. React StrictMode) naar dezelfde documenten schrijft.
 */
export async function seedChecklistsAlsLeeg(): Promise<void> {
  const db = getDb();
  const snap = await getDocs(collection(db, CHECKLISTS));
  if (!snap.empty) return;
  const nu = new Date().toISOString();
  const batch = writeBatch(db);
  START_CHECKLISTS.forEach((lijst, i) => {
    const items: ChecklistItem[] = lijst.items.map((tekst, j) => ({
      // Deterministisch item-id binnen het doc: seed is eenmalig.
      id: `seed-${j + 1}`,
      tekst,
      gedaan: false,
      gedaanOp: null,
      gedaanDoorNaam: null,
      volgorde: (j + 1) * 10,
    }));
    batch.set(doc(db, CHECKLISTS, checklistDocId(lijst.titel)), {
      titel: lijst.titel,
      volgorde: (i + 1) * 10,
      aangemaaktOp: nu,
      items,
    });
  });
  await batch.commit();
}
