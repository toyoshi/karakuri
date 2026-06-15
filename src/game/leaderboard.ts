/* ============================================================
   KARAKURI — leaderboard client. Submits your best gate-count per
   level and fetches the distribution so the game can show
   "rank R of N · top X%". Entirely optional: if no API is
   configured (or it's unreachable), everything no-ops and the
   game works exactly as before.

   Set the API base via VITE_KARAKURI_API at build time, or
   localStorage 'karakuri.api' at runtime (for testing).
   ============================================================ */
const ENV_API = (import.meta.env.VITE_KARAKURI_API as string | undefined) || '';
function base(): string {
  let b = ENV_API;
  try { b = localStorage.getItem('karakuri.api') || b; } catch { /* ignore */ }
  return b.replace(/\/+$/, '');
}
export function apiEnabled(): boolean { return !!base(); }

function anonId(): string {
  let id = '';
  try { id = localStorage.getItem('karakuri.anon') || ''; } catch { /* ignore */ }
  if (!id) {
    id = 'k' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem('karakuri.anon', id); } catch { /* ignore */ }
  }
  return id;
}

async function fetchT(url: string, opts: RequestInit = {}, ms = 4000): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}

export async function submitScore(level: string, gates: number, delay: number): Promise<void> {
  const b = base(); if (!b) return;
  try {
    await fetchT(b + '/api/score', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anon: anonId(), level, gates, delay }),
    });
  } catch { /* best effort */ }
}

export interface Dist { n: number; best: number | null; better: number }
export async function getDistribution(level: string, gates: number): Promise<Dist | null> {
  const b = base(); if (!b) return null;
  try {
    const r = await fetchT(b + `/api/dist?level=${encodeURIComponent(level)}&gates=${gates}`);
    if (!r.ok) return null;
    return await r.json() as Dist;
  } catch { return null; }
}

/** "12人中 3位 · 上位 25%" — derived from a Dist + your gate count */
export function rankText(d: Dist, lang: 'ja' | 'en'): string {
  const rank = d.better + 1, n = Math.max(d.n, rank);
  const pct = Math.max(1, Math.round((rank / n) * 100));
  return lang === 'ja' ? `${n}人中 ${rank}位 · 上位${pct}%` : `#${rank} of ${n} · top ${pct}%`;
}
