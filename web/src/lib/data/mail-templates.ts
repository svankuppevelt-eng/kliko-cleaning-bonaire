// Office-beheerbare mail-templates in Firestore-collectie `mailTemplates`
// (1 doc per template-key, bv. mailTemplates/factuur). Per doc staan de drie
// talen met onderwerp + body:
//   { nl: { onderwerp: "...", body: "..." }, pap: {...}, en: {...} }
// Alleen ingevulde overrides worden opgeslagen; een leeg veld valt terug op
// de standaardtekst hieronder (zelfde patroon als siteContent/landing).
//
// Variabelen in de teksten ({{naam}}, {{bedrag}}, ...) worden bij het
// versturen ingevuld via vulTemplate().
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { Lang } from "@/lib/i18n";

const MAIL_TEMPLATES = "mailTemplates";

export type MailTemplateKey =
  | "aanmelding"
  | "factuur"
  | "herinnering"
  | "komtMorgen"
  | "gedaan";

export const MAIL_TEMPLATE_KEYS: MailTemplateKey[] = [
  "aanmelding",
  "factuur",
  "herinnering",
  "komtMorgen",
  "gedaan",
];

/** Onderwerp + body van 1 mail in 1 taal. */
export interface MailTekst {
  onderwerp: string;
  body: string;
}

/** Office-overrides: alleen ingevulde velden staan in Firestore. */
export type MailTemplateOverrides = Partial<
  Record<MailTemplateKey, Partial<Record<Lang, Partial<MailTekst>>>>
>;

/** Welke variabelen per template beschikbaar zijn (voor de editor-UI). */
export const MAIL_VARIABELEN: Record<MailTemplateKey, string[]> = {
  aanmelding: ["{{naam}}", "{{type}}", "{{frequentie}}", "{{datum}}"],
  factuur: [
    "{{naam}}",
    "{{factuurnummer}}",
    "{{bedrag}}",
    "{{periode}}",
    "{{vervaldatum}}",
  ],
  herinnering: [
    "{{naam}}",
    "{{factuurnummer}}",
    "{{bedrag}}",
    "{{periode}}",
    "{{vervaldatum}}",
  ],
  komtMorgen: ["{{naam}}", "{{datum}}"],
  gedaan: ["{{naam}}", "{{datum}}"],
};

/**
 * Standaardteksten per template per taal. Nederlands is leidend;
 * Papiamentu en Engels zijn best-effort vertalingen.
 * LET OP: Papiamentu laten nakijken door Roderick (native speaker).
 */
export const STANDAARD_MAILS: Record<
  MailTemplateKey,
  Record<Lang, MailTekst>
> = {
  aanmelding: {
    nl: {
      onderwerp: "Welkom bij Kliko Cleaning Bonaire, {{naam}}!",
      body:
        "Beste {{naam}},\n\n" +
        "Bedankt voor je aanmelding bij Kliko Cleaning Bonaire. We hebben je gegevens goed ontvangen.\n\n" +
        "Je abonnement: {{type}}, {{frequentie}}.\n\n" +
        "We nemen snel contact met je op om je vaste schoonmaakdag in te plannen.\n\n" +
        "Met vriendelijke groet,\nKliko Cleaning Bonaire",
    },
    pap: {
      onderwerp: "Bon bini na Kliko Cleaning Bonaire, {{naam}}!",
      body:
        "Apresia {{naam}},\n\n" +
        "Danki pa bo registrashon na Kliko Cleaning Bonaire. Nos a risibi bo datos bon.\n\n" +
        "Bo abono: {{type}}, {{frequentie}}.\n\n" +
        "Nos lo tuma kontakto pronto pa planifika bo dia fiho di limpiesa.\n\n" +
        "Ku kordial saludo,\nKliko Cleaning Bonaire",
    },
    en: {
      onderwerp: "Welcome to Kliko Cleaning Bonaire, {{naam}}!",
      body:
        "Dear {{naam}},\n\n" +
        "Thank you for signing up with Kliko Cleaning Bonaire. We have received your details.\n\n" +
        "Your subscription: {{type}}, {{frequentie}}.\n\n" +
        "We will contact you soon to schedule your fixed cleaning day.\n\n" +
        "Kind regards,\nKliko Cleaning Bonaire",
    },
  },
  factuur: {
    nl: {
      onderwerp: "Factuur {{factuurnummer}} van Kliko Cleaning Bonaire",
      body:
        "Beste {{naam}},\n\n" +
        "In de bijlage vind je factuur {{factuurnummer}} voor de kliko-reiniging van {{periode}}.\n\n" +
        "Het totaalbedrag is {{bedrag}}. We vragen je vriendelijk dit voor {{vervaldatum}} te voldoen.\n\n" +
        "Vragen over deze factuur? Stuur ons gerust een bericht.\n\n" +
        "Met vriendelijke groet,\nKliko Cleaning Bonaire",
    },
    pap: {
      onderwerp: "Faktura {{factuurnummer}} di Kliko Cleaning Bonaire",
      body:
        "Apresia {{naam}},\n\n" +
        "Den e atachment bo ta hana faktura {{factuurnummer}} pa e limpiesa di kliko di {{periode}}.\n\n" +
        "E montante total ta {{bedrag}}. Nos ta pidi bo amablemente pa paga prome ku {{vervaldatum}}.\n\n" +
        "Bo tin pregunta tokante e faktura aki? Manda nos un mensahe.\n\n" +
        "Ku kordial saludo,\nKliko Cleaning Bonaire",
    },
    en: {
      onderwerp: "Invoice {{factuurnummer}} from Kliko Cleaning Bonaire",
      body:
        "Dear {{naam}},\n\n" +
        "Attached you will find invoice {{factuurnummer}} for the kliko cleaning of {{periode}}.\n\n" +
        "The total amount is {{bedrag}}. We kindly ask you to pay before {{vervaldatum}}.\n\n" +
        "Questions about this invoice? Feel free to send us a message.\n\n" +
        "Kind regards,\nKliko Cleaning Bonaire",
    },
  },
  herinnering: {
    nl: {
      onderwerp: "Herinnering: factuur {{factuurnummer}} staat nog open",
      body:
        "Beste {{naam}},\n\n" +
        "Volgens onze administratie staat factuur {{factuurnummer}} voor {{periode}} nog open. " +
        "Het gaat om {{bedrag}}, met vervaldatum {{vervaldatum}}.\n\n" +
        "Heb je al betaald? Dan mag je deze herinnering negeren.\n\n" +
        "Met vriendelijke groet,\nKliko Cleaning Bonaire",
    },
    pap: {
      onderwerp: "Rekordatorio: faktura {{factuurnummer}} ta habri ainda",
      body:
        "Apresia {{naam}},\n\n" +
        "Segun nos atministrashon faktura {{factuurnummer}} pa {{periode}} ta habri ainda. " +
        "Ta trata di {{bedrag}}, ku fecha di vensementu {{vervaldatum}}.\n\n" +
        "Bo a paga kaba? E ora ei bo por ignora e rekordatorio aki.\n\n" +
        "Ku kordial saludo,\nKliko Cleaning Bonaire",
    },
    en: {
      onderwerp: "Reminder: invoice {{factuurnummer}} is still outstanding",
      body:
        "Dear {{naam}},\n\n" +
        "According to our records, invoice {{factuurnummer}} for {{periode}} is still outstanding. " +
        "The amount is {{bedrag}}, due {{vervaldatum}}.\n\n" +
        "Already paid? Then you can ignore this reminder.\n\n" +
        "Kind regards,\nKliko Cleaning Bonaire",
    },
  },
  komtMorgen: {
    nl: {
      onderwerp: "Morgen komen we je kliko reinigen",
      body:
        "Beste {{naam}},\n\n" +
        "Morgen ({{datum}}) komen we langs om je kliko te reinigen. " +
        "Zet je kliko goed bereikbaar neer, dan kunnen we direct aan de slag.\n\n" +
        "Tot morgen!\n\n" +
        "Met vriendelijke groet,\nKliko Cleaning Bonaire",
    },
    pap: {
      onderwerp: "Manan nos ta bin hasi bo kliko limpi",
      body:
        "Apresia {{naam}},\n\n" +
        "Manan ({{datum}}) nos ta pasa pa hasi bo kliko limpi. " +
        "Pone bo kliko na un luga bon alkansabel, e ora ei nos por kuminsa mesora.\n\n" +
        "Te manan!\n\n" +
        "Ku kordial saludo,\nKliko Cleaning Bonaire",
    },
    en: {
      onderwerp: "We are coming to clean your kliko tomorrow",
      body:
        "Dear {{naam}},\n\n" +
        "Tomorrow ({{datum}}) we will come by to clean your kliko. " +
        "Please make sure your kliko is easy to reach so we can get started right away.\n\n" +
        "See you tomorrow!\n\n" +
        "Kind regards,\nKliko Cleaning Bonaire",
    },
  },
  gedaan: {
    nl: {
      onderwerp: "Je kliko is weer fris en schoon",
      body:
        "Beste {{naam}},\n\n" +
        "We hebben vandaag ({{datum}}) je kliko gereinigd. Hij is weer fris, schoon en geurvrij.\n\n" +
        "Bedankt dat je klant bent bij Kliko Cleaning Bonaire!\n\n" +
        "Met vriendelijke groet,\nKliko Cleaning Bonaire",
    },
    pap: {
      onderwerp: "Bo kliko ta fresku i limpi atrobe",
      body:
        "Apresia {{naam}},\n\n" +
        "Awe ({{datum}}) nos a hasi bo kliko limpi. E ta fresku, limpi i sin holo atrobe.\n\n" +
        "Danki ku bo ta kliente di Kliko Cleaning Bonaire!\n\n" +
        "Ku kordial saludo,\nKliko Cleaning Bonaire",
    },
    en: {
      onderwerp: "Your kliko is fresh and clean again",
      body:
        "Dear {{naam}},\n\n" +
        "Today ({{datum}}) we cleaned your kliko. It is fresh, clean and odour-free again.\n\n" +
        "Thank you for being a Kliko Cleaning Bonaire customer!\n\n" +
        "Kind regards,\nKliko Cleaning Bonaire",
    },
  },
};

const TALEN: Lang[] = ["pap", "nl", "en"];

function isTemplateKey(id: string): id is MailTemplateKey {
  return (MAIL_TEMPLATE_KEYS as string[]).includes(id);
}

/**
 * Lees alle office-overrides. Bestaat de collectie niet, is Firebase nog
 * niet geconfigureerd of gaat het lezen mis, dan komt er {} terug en gelden
 * overal de standaardteksten (geen crash, mail blijft werken).
 */
export async function getMailTemplates(): Promise<MailTemplateOverrides> {
  if (!isFirebaseConfigured()) return {};
  try {
    const snap = await getDocs(collection(getDb(), MAIL_TEMPLATES));
    const overrides: MailTemplateOverrides = {};
    for (const d of snap.docs) {
      if (!isTemplateKey(d.id)) continue;
      const data = d.data() as Record<string, unknown>;
      const perTaal: Partial<Record<Lang, Partial<MailTekst>>> = {};
      for (const lang of TALEN) {
        const veld = data[lang];
        if (!veld || typeof veld !== "object") continue;
        const v = veld as Record<string, unknown>;
        const tekst: Partial<MailTekst> = {};
        if (typeof v.onderwerp === "string" && v.onderwerp.trim() !== "") {
          tekst.onderwerp = v.onderwerp;
        }
        if (typeof v.body === "string" && v.body.trim() !== "") {
          tekst.body = v.body;
        }
        if (Object.keys(tekst).length > 0) perTaal[lang] = tekst;
      }
      if (Object.keys(perTaal).length > 0) overrides[d.id] = perTaal;
    }
    return overrides;
  } catch {
    // Firestore onbereikbaar of rules blokkeren lezen: standaardteksten gelden.
    return {};
  }
}

/**
 * Schrijf de overrides weg: per template-key 1 setDoc ZONDER merge, zodat
 * een leeggemaakt veld echt uit het doc verdwijnt en weer terugvalt op de
 * standaardtekst. De aanroeper geeft alleen ingevulde waarden mee.
 */
export async function saveMailTemplates(
  overrides: MailTemplateOverrides
): Promise<void> {
  const db = getDb();
  await Promise.all(
    MAIL_TEMPLATE_KEYS.map((key) =>
      setDoc(doc(db, MAIL_TEMPLATES, key), overrides[key] ?? {})
    )
  );
}

/**
 * De tekst die daadwerkelijk verstuurd wordt: office-override als die er is,
 * anders de standaardtekst. Per veld (onderwerp/body) apart, zodat office
 * bv. alleen het onderwerp kan aanpassen.
 */
export function effectieveMailTekst(
  overrides: MailTemplateOverrides,
  key: MailTemplateKey,
  lang: Lang
): MailTekst {
  const override = overrides[key]?.[lang];
  const standaard = STANDAARD_MAILS[key][lang];
  return {
    onderwerp: override?.onderwerp ?? standaard.onderwerp,
    body: override?.body ?? standaard.body,
  };
}

/**
 * Vervang {{variabele}}-placeholders door hun waarde. Onbekende variabelen
 * blijven letterlijk staan, zodat een typfout in de editor zichtbaar is.
 */
export function vulTemplate(
  tekst: string,
  vars: Record<string, string>
): string {
  return tekst.replace(/\{\{(\w+)\}\}/g, (match, naam: string) =>
    vars[naam] !== undefined ? vars[naam] : match
  );
}
