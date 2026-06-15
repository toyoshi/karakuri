/* ============================================================
   Karakuri — score API. Stores each player's best gate-count per
   level and returns the distribution so the game can show
   "you're in the top X% (rank R of N)".

   Storage: Postgres via DATABASE_URL (Railway plugin). If unset,
   falls back to in-memory (fine for local dev, not durable).
   ============================================================ */
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());                 // public read/write; no secrets here
app.use(express.json({ limit: '8kb' }));

const PORT = process.env.PORT || 8080;
const DB_URL = process.env.DATABASE_URL;

/* ---- storage layer (Postgres or in-memory) ---- */
let store;
if (DB_URL) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: DB_URL, ssl: DB_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  await pool.query(`CREATE TABLE IF NOT EXISTS scores (
    anon text NOT NULL, level text NOT NULL, gates int NOT NULL, delay int NOT NULL,
    ts timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (anon, level))`);
  store = {
    async submit(anon, level, gates, delay) {
      await pool.query(
        `INSERT INTO scores (anon, level, gates, delay) VALUES ($1,$2,$3,$4)
         ON CONFLICT (anon, level) DO UPDATE SET gates=LEAST(scores.gates, EXCLUDED.gates),
           delay=CASE WHEN EXCLUDED.gates < scores.gates THEN EXCLUDED.delay ELSE scores.delay END, ts=now()`,
        [anon, level, gates, delay]);
    },
    async dist(level, gates) {
      const { rows } = await pool.query(
        `SELECT count(*)::int n, min(gates)::int best, count(*) FILTER (WHERE gates < $2)::int better FROM scores WHERE level=$1`,
        [level, gates]);
      return rows[0] || { n: 0, best: null, better: 0 };
    },
  };
  console.log('storage: postgres');
} else {
  const mem = new Map(); // key `${anon}|${level}` -> {gates, delay}
  store = {
    async submit(anon, level, gates, delay) {
      const k = anon + '|' + level, cur = mem.get(k);
      if (!cur || gates < cur.gates) mem.set(k, { gates, delay });
    },
    async dist(level, gates) {
      let n = 0, best = null, better = 0;
      for (const [k, v] of mem) {
        if (!k.endsWith('|' + level)) continue;
        n++; if (best === null || v.gates < best) best = v.gates; if (v.gates < gates) better++;
      }
      return { n, best, better };
    },
  };
  console.log('storage: in-memory (set DATABASE_URL for persistence)');
}

const okStr = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
const okInt = (n) => Number.isInteger(n) && n >= 0 && n <= 100000;

app.get('/', (_req, res) => res.json({ ok: true, service: 'karakuri-scores' }));

app.post('/api/score', async (req, res) => {
  const { anon, level, gates, delay } = req.body || {};
  if (!okStr(anon, 64) || !okStr(level, 40) || !okInt(gates) || gates < 1 || !okInt(delay)) {
    return res.status(400).json({ error: 'bad input' });
  }
  try { await store.submit(anon, level, gates, delay); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'store failed' }); }
});

app.get('/api/dist', async (req, res) => {
  const level = String(req.query.level || ''), gates = parseInt(String(req.query.gates), 10);
  if (!okStr(level, 40) || !okInt(gates)) return res.status(400).json({ error: 'bad input' });
  try { res.json(await store.dist(level, gates)); }
  catch (e) { console.error(e); res.status(500).json({ error: 'store failed' }); }
});

app.listen(PORT, () => console.log(`karakuri-scores on :${PORT}`));
