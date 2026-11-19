// Save / load game progress in localStorage (offline, no network).
const KEY = 'sunfall-city-save-v1';
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch { return null; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: state.money,
      missionIndex: state.missionIndex,
      earned: state.earned,
      savedAt: Date.now(),
    }));
    return true;
  } catch { return false; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
