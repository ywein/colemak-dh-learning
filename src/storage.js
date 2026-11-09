// localStorage persistence: settings + completed training sessions.
const SETTINGS_KEY = 'colemak-dh-trainer';
const HISTORY_KEY = 'colemak-dh-trainer:history';

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadSettings() {
  return read(SETTINGS_KEY, {});
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Completed sessions, oldest first. */
export function loadHistory() {
  const history = read(HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}

export function addSession(record) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([...loadHistory(), record]));
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function clearLevel(level) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(loadHistory().filter((r) => r.level !== level)));
}
