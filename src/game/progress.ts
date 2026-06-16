/* ============================================================
   Export / import all local progress (chips you built, cleared
   levels, best scores, in-progress circuits, grid sizes, language).
   Everything lives under the `karakuri.` localStorage prefix, so a
   backup is just those keys — portable between browsers / devices.
   ============================================================ */

const PREFIX = 'karakuri.';
const FORMAT = 'switch-to-cpu/progress';
const FORMAT_VERSION = 1;

/** gather every karakuri.* key into a plain object */
function collect(): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      const v = localStorage.getItem(k);
      if (v != null) data[k] = v;
    }
  }
  return data;
}

/** download the current progress as a JSON file */
export function exportProgress(stamp: string) {
  const payload = { format: FORMAT, version: FORMAT_VERSION, exportedAt: stamp, data: collect() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `switch-to-cpu-progress-${stamp.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** restore progress from a file the user picked. Overwrites the matching
    keys, then the caller should reload so the store re-initialises. */
export async function importProgress(file: File): Promise<{ keys: number }> {
  const text = await file.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('not valid JSON'); }
  // accept either our wrapper {format,data} or a bare {karakuri.*: value} map
  const obj = parsed as { format?: string; data?: Record<string, unknown> };
  const data = (obj && typeof obj === 'object' && obj.data && typeof obj.data === 'object')
    ? obj.data
    : (parsed as Record<string, unknown>);
  if (!data || typeof data !== 'object') throw new Error('unrecognised file');
  const entries = Object.entries(data).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === 'string');
  if (!entries.length) throw new Error('no progress data found in file');
  for (const [k, v] of entries) localStorage.setItem(k, v as string);
  return { keys: entries.length };
}
