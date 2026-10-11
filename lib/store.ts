"use client";

import { createStore, del, entries, get, set, clear } from "idb-keyval";
import type { Ladder, Session } from "./types";

// All patient data lives in this browser only. Nothing is sent to a server for storage.
const ladderStore = typeof indexedDB !== "undefined" ? createStore("fear-ladder", "ladders") : undefined;
const sessionStore = typeof indexedDB !== "undefined" ? createStore("fear-ladder-sessions", "sessions") : undefined;

const listeners = new Set<(id: string) => void>();

export function onLadderSaved(fn: (id: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function saveLadder(ladder: Ladder): Promise<void> {
  if (!ladderStore) return;
  await set(ladder.id, ladder, ladderStore);
  listeners.forEach((fn) => fn(ladder.id));
}

export async function getLadder(id: string): Promise<Ladder | undefined> {
  if (!ladderStore) return undefined;
  return get<Ladder>(id, ladderStore);
}

export async function listLadders(): Promise<Ladder[]> {
  if (!ladderStore) return [];
  const all = await entries<string, Ladder>(ladderStore);
  return all.map(([, l]) => l).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteLadder(id: string): Promise<void> {
  if (!ladderStore || !sessionStore) return;
  await del(id, ladderStore);
  const sessions = await listSessions(id);
  await Promise.all(sessions.map((s) => del(s.id, sessionStore)));
}

export async function saveSession(session: Session): Promise<void> {
  if (!sessionStore) return;
  await set(session.id, session, sessionStore);
}

export async function listSessions(ladderId: string): Promise<Session[]> {
  if (!sessionStore) return [];
  const all = await entries<string, Session>(sessionStore);
  return all
    .map(([, s]) => s)
    .filter((s) => s.ladderId === ladderId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export async function deleteAllLocalData(): Promise<void> {
  if (ladderStore) await clear(ladderStore);
  if (sessionStore) await clear(sessionStore);
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // storage may be blocked; nothing else to clear
  }
}
