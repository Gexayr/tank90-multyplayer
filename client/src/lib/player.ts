const NAME_STORAGE_KEY = 'tank90-player-name';

export const NAME_MAX_LENGTH = 16;

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // Storage unavailable - the name just won't be remembered
  }
}

export function cleanName(raw: string): string {
  return raw.trim().slice(0, NAME_MAX_LENGTH);
}

/** Matches the server rule: 3-12 characters A-Z / 0-9 */
export function cleanRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
