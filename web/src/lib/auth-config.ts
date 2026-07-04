// Bootstrap-allowlist voor office-toegang.
// Rollen staan in Firestore `users/{uid}` (zie src/lib/data/team.ts); die hebben
// altijd voorrang. Deze lijst is alleen nog een vangnet zodat de eerste eigenaar
// kan binnenkomen (eerste-keer login op /login maakt account + users-doc aan).
// Verwijderen kan wanneer alle office-users een users-doc hebben.

export type Rol = "eigenaar" | "kantoor" | "schoonmaker";

/** Rollen die het office-gedeelte op /beheer mogen zien. */
export const OFFICE_ROLLEN: Rol[] = ["eigenaar", "kantoor"];

export interface AllowlistEntry {
  naam: string;
  rol: Rol;
}

/** Bootstrap-allowlist: e-mail -> naam + rol. */
export const OFFICE_ALLOWLIST: Record<string, AllowlistEntry> = {
  "svankuppevelt@gmail.com": { naam: "Steffie", rol: "eigenaar" },
  "marchenamgm@gmail.com": { naam: "Geno", rol: "eigenaar" },
  "bachatapassion@gmail.com": { naam: "Office", rol: "kantoor" }, // gedeeld office-account
};

export function allowlistEntryVoorEmail(
  email: string | null | undefined
): AllowlistEntry | null {
  if (!email) return null;
  return OFFICE_ALLOWLIST[email.trim().toLowerCase()] ?? null;
}

export function rolVoorEmail(email: string | null | undefined): Rol | null {
  return allowlistEntryVoorEmail(email)?.rol ?? null;
}
