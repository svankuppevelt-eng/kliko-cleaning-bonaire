"use client";

// Office: de mailteksten bewerken die de app verstuurt, per template en per
// taal (pap/nl/en). Opgeslagen in Firestore-collectie `mailTemplates`
// (1 doc per template-key); een leeg veld = terugvallen op de standaardtekst
// (die als grijze placeholder in elk veld staat). Toegang via de
// OfficeShell-gate in de beheer-layout: eigenaar en kantoor mogen bewerken.
//
// Per template kan de office-gebruiker ook een test-mail naar zichzelf
// sturen (in de actieve UI-taal, met voorbeeldwaarden voor de variabelen).
import { useEffect, useState } from "react";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useOfficeUser } from "@/lib/use-office-user";
import {
  effectieveMailTekst,
  getMailTemplates,
  MAIL_TEMPLATE_KEYS,
  MAIL_VARIABELEN,
  saveMailTemplates,
  STANDAARD_MAILS,
  vulTemplate,
  type MailTemplateKey,
  type MailTemplateOverrides,
} from "@/lib/data/mail-templates";
import { mailHtml, verstuurMail } from "@/lib/mail-verzenden";

const TALEN: Lang[] = LANGS.map((l) => l.code);

/** Formulier-state: per template en taal altijd beide velden als string. */
type FormState = Record<
  MailTemplateKey,
  Record<Lang, { onderwerp: string; body: string }>
>;

function naarForm(overrides: MailTemplateOverrides): FormState {
  const form = {} as FormState;
  for (const key of MAIL_TEMPLATE_KEYS) {
    form[key] = {} as FormState[MailTemplateKey];
    for (const lang of TALEN) {
      form[key][lang] = {
        onderwerp: overrides[key]?.[lang]?.onderwerp ?? "",
        body: overrides[key]?.[lang]?.body ?? "",
      };
    }
  }
  return form;
}

/** Alleen ingevulde waarden bewaren; lege velden verdwijnen uit het doc. */
function naarOverrides(form: FormState): MailTemplateOverrides {
  const overrides: MailTemplateOverrides = {};
  for (const key of MAIL_TEMPLATE_KEYS) {
    const perTaal: MailTemplateOverrides[MailTemplateKey] = {};
    for (const lang of TALEN) {
      const onderwerp = form[key][lang].onderwerp.trim();
      const body = form[key][lang].body.trim();
      if (onderwerp === "" && body === "") continue;
      perTaal[lang] = {
        ...(onderwerp !== "" ? { onderwerp } : {}),
        ...(body !== "" ? { body } : {}),
      };
    }
    if (Object.keys(perTaal).length > 0) overrides[key] = perTaal;
  }
  return overrides;
}

/** Voorbeeldwaarden voor de variabelen in een test-mail. */
function voorbeeldVars(naam: string, lang: Lang): Record<string, string> {
  const vandaag = new Date().toLocaleDateString(
    lang === "en" ? "en-GB" : "nl-NL"
  );
  return {
    naam: naam || "Test",
    type: "Huishouden",
    frequentie: "2x per maand",
    datum: vandaag,
    factuurnummer: "KLIKO-2026-0001",
    bedrag: "$21.60",
    periode: "juli 2026",
    vervaldatum: vandaag,
  };
}

const veldCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm text-kliko-navy placeholder:text-kliko-navy/35 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

export default function MailTekstenPage() {
  const { t, lang } = useI18n();
  const user = useOfficeUser();

  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [testBezig, setTestBezig] = useState<MailTemplateKey | null>(null);
  const [melding, setMelding] = useState<{ tekst: string; fout: boolean } | null>(null);

  useEffect(() => {
    // getMailTemplates vangt fouten zelf af en geeft dan {} terug, zodat de
    // editor altijd opent (met lege velden = standaardteksten).
    getMailTemplates().then((overrides) => setForm(naarForm(overrides)));
  }, []);

  function zetVeld(
    key: MailTemplateKey,
    taal: Lang,
    veld: "onderwerp" | "body",
    waarde: string
  ) {
    setForm((huidig) =>
      huidig
        ? {
            ...huidig,
            [key]: {
              ...huidig[key],
              [taal]: { ...huidig[key][taal], [veld]: waarde },
            },
          }
        : huidig
    );
  }

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    setMelding(null);
    if (!isFirebaseConfigured()) {
      setMelding({ tekst: t("login.offline"), fout: true });
      return;
    }
    setBusy(true);
    try {
      await saveMailTemplates(naarOverrides(form));
      setMelding({ tekst: t("mails.saved"), fout: false });
    } catch {
      setMelding({ tekst: t("mails.err.save"), fout: true });
    } finally {
      setBusy(false);
    }
  }

  async function stuurTest(key: MailTemplateKey) {
    if (!form || testBezig) return;
    setMelding(null);
    const naar = user.status === "office" ? user.email : "";
    if (!naar) return;
    setTestBezig(key);
    try {
      // Test met de teksten zoals ze NU in het formulier staan (nog niet
      // per se opgeslagen), in de actieve UI-taal, met voorbeeldwaarden.
      const tekst = effectieveMailTekst(naarOverrides(form), key, lang);
      const vars = voorbeeldVars(
        user.status === "office" ? user.naam : "",
        lang
      );
      const resultaat = await verstuurMail({
        to: naar,
        subject: vulTemplate(tekst.onderwerp, vars),
        html: mailHtml(vulTemplate(tekst.body, vars)),
      });
      if (!resultaat.configured) {
        setMelding({ tekst: t("mail.nietactief"), fout: true });
      } else if (!resultaat.ok) {
        setMelding({ tekst: t("mails.test.err"), fout: true });
      } else {
        setMelding({ tekst: `${t("mails.test.ok")} ${naar}.`, fout: false });
      }
    } catch {
      setMelding({ tekst: t("mails.test.err"), fout: true });
    } finally {
      setTestBezig(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("mails.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("mails.sub")}</p>

      <p className="mt-4 rounded-xl border border-kliko-blue/20 bg-kliko-blue/5 px-4 py-3 text-sm text-kliko-navy/80">
        {t("mails.uitleg")}
      </p>

      {form === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("mails.loading")}
        </p>
      ) : (
        <form onSubmit={opslaan} className="mt-6 flex flex-col gap-5">
          {MAIL_TEMPLATE_KEYS.map((key) => (
            <section
              key={key}
              className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                    {t(`mails.tpl.${key}`)}
                  </h2>
                  <p className="mt-1 text-xs text-kliko-navy/60">
                    {t(`mails.tpl.${key}.uitleg`)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => stuurTest(key)}
                  disabled={testBezig !== null}
                  className="rounded-full border border-kliko-navy/20 px-3.5 py-1.5 text-xs font-bold text-kliko-navy hover:border-kliko-navy/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testBezig === key ? t("mails.test.busy") : t("mails.test")}
                </button>
              </div>

              {/* Beschikbare variabelen voor deze template */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-kliko-navy/40">
                  {t("mails.variabelen")}:
                </span>
                {MAIL_VARIABELEN[key].map((v) => (
                  <code
                    key={v}
                    className="rounded-md bg-kliko-navy/5 px-1.5 py-0.5 font-mono text-[0.7rem] text-kliko-navy/70"
                  >
                    {v}
                  </code>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-5">
                {TALEN.map((taal) => (
                  <div key={taal}>
                    <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-kliko-navy/40">
                      {taal}
                    </p>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label
                          htmlFor={`mail-${key}-${taal}-onderwerp`}
                          className="mb-1 block text-xs font-bold text-kliko-navy/60"
                        >
                          {t("mails.onderwerp")}
                        </label>
                        <input
                          id={`mail-${key}-${taal}-onderwerp`}
                          type="text"
                          className={veldCls}
                          placeholder={STANDAARD_MAILS[key][taal].onderwerp}
                          value={form[key][taal].onderwerp}
                          onChange={(e) =>
                            zetVeld(key, taal, "onderwerp", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`mail-${key}-${taal}-body`}
                          className="mb-1 block text-xs font-bold text-kliko-navy/60"
                        >
                          {t("mails.body")}
                        </label>
                        <textarea
                          id={`mail-${key}-${taal}-body`}
                          rows={6}
                          className={`${veldCls} resize-y`}
                          placeholder={STANDAARD_MAILS[key][taal].body}
                          value={form[key][taal].body}
                          onChange={(e) =>
                            zetVeld(key, taal, "body", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

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

          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-full bg-kliko-blue px-6 py-3 font-bold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? t("mails.test.busy") : t("mails.save")}
          </button>
        </form>
      )}
    </div>
  );
}
