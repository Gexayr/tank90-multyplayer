import { useSyncExternalStore } from 'react';

// Minimal client-side router: pathname + query, history.pushState navigation

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

function snapshot() {
  return window.location.pathname + window.location.search;
}

export function navigate(to: string, { replace = false } = {}) {
  if (to === snapshot()) return;
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  listeners.forEach((l) => l());
}

export function useLocation(): { path: string; query: URLSearchParams } {
  const current = useSyncExternalStore(subscribe, snapshot);
  const url = new URL(current, window.location.origin);
  return { path: url.pathname.replace(/\/+$/, '') || '/', query: url.searchParams };
}
