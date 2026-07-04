"use client";

// Hooks voor auth-status. Firestore `users/{uid}` is de bron van waarheid
// (velden: naam, email, rol, actief). Bestaat er een users-doc, dan geldt dat doc:
// `actief: false` = geen toegang, ook al staat het e-mailadres in de allowlist.
// Alleen ZONDER users-doc valt de hook terug op de bootstrap-allowlist in
// src/lib/auth-config.ts (vangnet voor de eerste eigenaar).
//
// - useHuidigeGebruiker(): elke geldige rol (eigenaar, kantoor, schoonmaker).
// - useOfficeUser(): daarop gebouwd; office = eigenaar|kantoor, een schoonmaker
//   krijgt status "schoonmaker" zodat /beheer netjes kan doorsturen naar /vandaag.
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { OFFICE_ROLLEN, rolVoorEmail, type Rol } from "@/lib/auth-config";

export type HuidigeGebruikerState =
  | { status: "loading" }
  | { status: "unconfigured" } // Firebase env-vars nog niet gezet
  | { status: "signed-out" }
  | { status: "geen-rol"; email: string } // ingelogd maar geen rol (of actief: false)
  | { status: "ingelogd"; user: User; email: string; rol: Rol; naam: string };

export function useHuidigeGebruiker(): HuidigeGebruikerState {
  // NEXT_PUBLIC_* env-vars zijn build-time constanten, dus dit is op server en
  // client gelijk (geen hydration-verschil) en kan direct in de initializer.
  const [state, setState] = useState<HuidigeGebruikerState>(() =>
    isFirebaseConfigured() ? { status: "loading" } : { status: "unconfigured" }
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        setState({ status: "signed-out" });
        return;
      }
      const email = user.email ?? "";
      let rol: Rol | null = null;
      let naam = "";
      let heeftUsersDoc = false;
      try {
        const snap = await getDoc(doc(getDb(), "users", user.uid));
        if (snap.exists()) {
          heeftUsersDoc = true;
          const data = snap.data();
          naam = (data.naam as string) ?? "";
          // Inactief account = geen toegang, ongeacht rol of allowlist.
          rol = data.actief === false ? null : ((data.rol as Rol) ?? null);
        }
      } catch {
        // users-doc niet leesbaar (bv. rules): behandel als "geen doc" -> allowlist
      }
      // Allowlist alleen als bootstrap-vangnet wanneer er GEEN users-doc bestaat.
      if (!heeftUsersDoc) rol = rolVoorEmail(email);
      if (rol) {
        setState({ status: "ingelogd", user, email, rol, naam });
      } else {
        setState({ status: "geen-rol", email });
      }
    });
    return unsub;
  }, []);

  return state;
}

export type OfficeUserState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "no-access"; email: string } // ingelogd maar geen rol (of actief: false)
  | { status: "schoonmaker"; user: User; email: string; naam: string }
  | { status: "office"; user: User; email: string; rol: Rol; naam: string };

export function useOfficeUser(): OfficeUserState {
  const gebruiker = useHuidigeGebruiker();
  switch (gebruiker.status) {
    case "ingelogd":
      if (OFFICE_ROLLEN.includes(gebruiker.rol)) {
        return {
          status: "office",
          user: gebruiker.user,
          email: gebruiker.email,
          rol: gebruiker.rol,
          naam: gebruiker.naam,
        };
      }
      return {
        status: "schoonmaker",
        user: gebruiker.user,
        email: gebruiker.email,
        naam: gebruiker.naam,
      };
    case "geen-rol":
      return { status: "no-access", email: gebruiker.email };
    default:
      return gebruiker;
  }
}

export async function signOutOffice(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await fbSignOut(getFirebaseAuth());
}
