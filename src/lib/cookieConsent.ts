import { useSyncExternalStore } from "react";
export type CookieChoice = "accepted" | "declined" | null;
export const COOKIE_CHOICE_KEY = "azuki.cookie-choice.v1";
const listeners = new Set<() => void>();
let temporaryChoice: CookieChoice = null;
export function readCookieChoice(): CookieChoice {
  if (temporaryChoice) return temporaryChoice;
  try { const choice = localStorage.getItem(COOKIE_CHOICE_KEY); return choice === "accepted" || choice === "declined" ? choice : null; } catch { return null; }
}
function stopAnalytics() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (id) (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
  // Remove only GA cookies; keep Google login and the user's vocabulary data.
  const host = window.location.hostname;
  const domains = ["", host, ...host.split('.').map((_, i, parts) => parts.slice(i).join('.')).filter(domain => domain.includes('.'))];
  for (const entry of document.cookie.split(';')) {
    const name = entry.split('=')[0].trim();
    if (name !== '_ga' && !name.startsWith('_ga_')) continue;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ` Domain=${domain};` : ''} SameSite=Lax`;
  }
}
export function saveCookieChoice(choice: Exclude<CookieChoice, null>) {
  let persisted = true;
  try { localStorage.setItem(COOKIE_CHOICE_KEY, choice); temporaryChoice = null; }
  catch { temporaryChoice = choice; persisted = false; }
  if (choice === "declined") stopAnalytics();
  listeners.forEach(listener => listener());
  return persisted;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  function onStorage(event: StorageEvent) {
    if (event.key !== COOKIE_CHOICE_KEY && event.key !== null) return;
    temporaryChoice = null;
    if (readCookieChoice() !== 'accepted') stopAnalytics();
    listener();
  }
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}
export function useCookieChoice() { return useSyncExternalStore(subscribe, readCookieChoice, () => null); }
