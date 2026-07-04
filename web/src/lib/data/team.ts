// Repository-helpers voor Firestore-collectie `users` (teamleden / office-rollen).
// Doc-id = Firebase Auth uid. Alleen aanroepen vanuit client components (Web SDK).
//
// BELANGRIJK (beperking client-side Auth):
// - Een NIEUW teamlid aanmaken gebeurt via een secundaire Firebase-app-instantie,
//   zodat de ingelogde eigenaar niet wordt uitgelogd door createUserWithEmailAndPassword.
// - Het Auth-account van een ANDER teamlid kun je client-side niet verwijderen of
//   het wachtwoord ervan wijzigen (dat vereist de Admin SDK / een Cloud Function).
//   "Verwijderen" is daarom: het users-doc weghalen = office-toegang intrekken.
//   Het onderliggende Auth-account blijft bestaan tot we later een Cloud Function
//   of admin-route toevoegen voor volledige verwijdering.
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb, getFirebaseAuth, getFirebaseConfig } from "@/lib/firebase";
import type { Rol } from "@/lib/auth-config";

const USERS = "users";

export interface TeamUser {
  /** = Firebase Auth uid (doc-id). */
  uid: string;
  naam: string;
  email: string;
  rol: Rol;
  actief: boolean;
  /** ISO-datum/tijd string. */
  aangemaaktOp: string;
}

export async function listTeamUsers(): Promise<TeamUser[]> {
  const snap = await getDocs(
    query(collection(getDb(), USERS), orderBy("aangemaaktOp", "asc"))
  );
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as TeamUser);
}

/** users/{uid}-doc schrijven (ook gebruikt door de eerste-keer bootstrap op /login). */
export async function writeTeamUserDoc(
  uid: string,
  data: Omit<TeamUser, "uid">
): Promise<void> {
  await setDoc(doc(getDb(), USERS, uid), data);
}

/**
 * Nieuw teamlid: Auth-account + users-doc.
 * Gebruikt een secundaire app-instantie zodat de ingelogde eigenaar NIET wordt
 * uitgelogd (createUserWithEmailAndPassword logt op de gebruikte Auth-instantie in).
 */
export async function createTeamUser(input: {
  naam: string;
  email: string;
  rol: Rol;
  wachtwoord: string;
}): Promise<TeamUser> {
  // Unieke naam per aanroep: voorkomt "duplicate-app" bij snel achter elkaar aanmaken.
  const secondaryApp = initializeApp(getFirebaseConfig(), `secondary-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim().toLowerCase(),
      input.wachtwoord
    );
    const data: Omit<TeamUser, "uid"> = {
      naam: input.naam.trim(),
      email: input.email.trim().toLowerCase(),
      rol: input.rol,
      actief: true,
      aangemaaktOp: new Date().toISOString(),
    };
    // users-doc schrijven via de PRIMAIRE app (de ingelogde eigenaar).
    await writeTeamUserDoc(cred.user.uid, data);
    await signOut(secondaryAuth);
    return { uid: cred.user.uid, ...data };
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function updateTeamUser(
  uid: string,
  data: Partial<Pick<TeamUser, "naam" | "rol" | "actief">>
): Promise<void> {
  await updateDoc(doc(getDb(), USERS, uid), data);
}

/**
 * Toegang intrekken: users-doc verwijderen. Het Auth-account blijft bestaan
 * (client-side niet te verwijderen); zonder users-doc en zonder allowlist-entry
 * komt de gebruiker het office-gedeelte niet meer in.
 */
export async function revokeTeamUser(uid: string): Promise<void> {
  await deleteDoc(doc(getDb(), USERS, uid));
}

/** Wachtwoord-reset-mail naar een teamlid (wachtwoord van een ander kun je client-side niet direct zetten). */
export async function sendTeamPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim().toLowerCase());
}
