# karakuri-scores

Tiny score/leaderboard API for Karakuri. Stores each player's best gate-count
per level and returns the distribution so the game shows "rank R of N · top X%".

- `POST /api/score` `{ anon, level, gates, delay }` — upserts the player's best.
- `GET /api/dist?level=X&gates=N` — `{ n, best, better }` (n solvers, best gates, how many beat N).
- CORS open (public, no secrets). Storage: Postgres via `DATABASE_URL`, else in-memory.

## Deploy on Railway
```bash
railway login                 # interactive (run with `! railway login` in the session)
cd server
railway init                  # create/link a project
railway add --database postgres   # provisions DATABASE_URL
railway up                    # deploy; Nixpacks runs `npm install` && `npm start`
railway domain                # get the public URL, e.g. https://karakuri-scores.up.railway.app
```

Then point the frontend at it: set `VITE_KARAKURI_API` to that URL in the
GitHub Pages build (`.github/workflows/deploy.yml`) and push — the game starts
showing live rankings. (Until then the leaderboard is dormant and the game
works exactly as before.)

Local test: `npm install && PORT=8090 npm start` (in-memory), then in the game
console `localStorage.setItem('karakuri.api','http://localhost:8090')`.
