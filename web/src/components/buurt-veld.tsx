"use client";

// Herbruikbaar buurt-veld: dropdown met de actieve buurten uit Firestore,
// plus een "Anders / niet in de lijst"-optie met vrij tekstveld als vangnet.
// Backwards compatible: een bestaande waarde die niet (meer) in de lijst
// staat wordt als extra optie getoond, zodat oude klanten niet breken.
// Is de lijst leeg (nog niet geseed, of Firestore onbereikbaar), dan valt
// het veld terug op een gewoon tekstveld.
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Buurt } from "@/lib/data/buurten";

const ANDERS = "__anders__";

interface BuurtVeldProps {
  id?: string;
  value: string;
  onChange: (wijk: string) => void;
  buurten: Buurt[];
  /** true zodra de buurten-lijst geladen (of definitief mislukt) is. */
  geladen: boolean;
  className: string;
}

export function BuurtVeld({
  id,
  value,
  onChange,
  buurten,
  geladen,
  className,
}: BuurtVeldProps) {
  const { t } = useI18n();
  const [anders, setAnders] = useState(false);

  // Geen lijst beschikbaar: gewoon een vrij tekstveld (vangnet).
  if (geladen && buurten.length === 0) {
    return (
      <input
        id={id}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const inLijst = buurten.some((b) => b.naam === value);
  // Bestaande waarde buiten de lijst tonen als extra optie (backwards compatible).
  const extraOptie = !anders && value && !inLijst ? value : null;
  const selectValue = anders ? ANDERS : value;

  return (
    <div className="flex flex-col gap-2">
      <select
        id={id}
        className={className}
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === ANDERS) {
            setAnders(true);
            onChange("");
          } else {
            setAnders(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{t("form.buurt.kies")}</option>
        {buurten.map((b) => (
          <option key={b.id} value={b.naam}>
            {b.naam}
          </option>
        ))}
        {extraOptie && <option value={extraOptie}>{extraOptie}</option>}
        <option value={ANDERS}>{t("form.buurt.anders")}</option>
      </select>
      {anders && (
        <input
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("form.buurt.anders.placeholder")}
          autoFocus
        />
      )}
    </div>
  );
}
