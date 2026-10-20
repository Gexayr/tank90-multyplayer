# 🛡️ Tank 90 Multiplayer

Browser remake of Tank 1990 / Battle City with two modes, picked on the home page:

- **Open World** – free-for-all on a 4000×4000 map (2D, PixiJS). Respawn after 3 s, +100 per kill, minimap, trees/water/bricks/steel.
- **Missions** – co-op, solo or up to 4 friends per room (3D, React Three Fiber). Defend the eagle from 20 enemy tanks, power-ups, 3 lives. Invite friends with a link: `/missions/<CODE>`.

Production: https://tank.amsoft.am

## Stack

| Part   | Tech |
|--------|------|
| Client | React 19, Vite 6, Tailwind 4, PixiJS 7 (open world), three.js + R3F 9 (missions) |
| Server | Node 24, Express 4, Socket.IO 4, SQLite (`node:sqlite`) for the leaderboard |
| Deploy | One Docker container behind host nginx |

```
client/                 Frontend
  src/pages/Home.tsx      Mode selection, nickname, leaderboard
  src/modes/open-world/   2D mode (prediction, interpolation, Pixi managers)
  src/modes/missions/     3D mode (scene, meshes, HUD, mobile controls)
server/                 Backend
  src/index.ts            HTTP + Socket.IO wiring, API, static files
  src/open-world/         Authoritative 25 Hz simulation (namespace /open-world)
  src/missions/           Rooms, enemy AI, 20 Hz simulation (namespace /missions)
  src/security.ts         Name/room sanitising, rate limits, origin + per-IP guards
  src/db.ts               SQLite leaderboard
shared/missions-types.ts  Types used by both server and client
scripts/compute-mem-limit.sh
```

## Development

```bash
cd server && npm install && npm run dev     # http://localhost:3090
cd client && npm install && npm run dev     # http://localhost:5173 (proxies /api and /socket.io to 3090)
```

The local database is created at `server/data/tank90.sqlite`.

## Production

```bash
./scripts/compute-mem-limit.sh       # writes TANK_MEM_LIMIT / TANK_HEAP_MB into .env
docker-compose up -d --build
```

- The image builds the client and server in separate stages; the runtime image only contains compiled JS, production `node_modules` and the static client. It runs as user `node` with a read-only filesystem, no capabilities, `no-new-privileges`.
- Port `127.0.0.1:3090` only – reachable through nginx, not from the internet.
- Leaderboard data lives in the `tank90_data` volume (`/data/tank90.sqlite`).
- Building the image takes ~0.5–1 GB of RAM for a minute; run it when the server isn't under load.

### Memory and CPU limits

`compute-mem-limit.sh` sets the container ceiling to **80% of MemAvailable** at the time it runs (pass another percentage as the first argument). `memswap_limit` equals the limit, so the container can't push the host into swap, and Node's heap is capped at ~60% of it. CPU is limited to 2 cores, processes to 200.

Measured: ~25 MB idle, ~65 MB with 64 open-world players and 30 full mission rooms (184 sockets).

Application limits (env, see `.env.example`): 64 players in open world, 30 mission rooms × 4 players, 8 connections per IP, ~60 inputs/s per socket, 4 KB max message.

### nginx

- `/etc/nginx/conf.d/tank90-limits.conf` – per-IP rate/connection zones
- `/etc/nginx/snippets/tank90-security-headers.conf` – HSTS, CSP, X-Frame-Options, nosniff, Referrer/Permissions-Policy
- `/etc/nginx/sites-available/tank90.conf` – `tank.amsoft.am` → `127.0.0.1:3090`; blocks dotfiles, configs, sources, databases, source maps; only GET/HEAD/POST
- `/etc/nginx/sites-available/tank90-back.conf` – old `tank-back.amsoft.am` → 301 to `tank.amsoft.am`

After editing: `nginx -t && systemctl reload nginx`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leaderboard?mode=open-world\|missions` | Top 10 nicknames by lifetime score |
| GET | `/api/stats` | Players online in open world, active mission rooms |
| GET | `/healthz` | Health check |

## Socket.IO

Connect with `transports: ['websocket']`.

**`/open-world`** (`auth: { name }`)

| Event | Direction | Payload |
|-------|-----------|---------|
| `player-input` | C → S | `{ up, down, left, right, shoot, sequenceId }` ~20/s |
| `game-state`, `map-objects` | S → C | Full state on connect |
| `s` | S → C | Snapshot every tick `{ t, p: [{id,x,y,r,h,s,sid}], b: [...] }` |
| `player-join` / `player-leave` | S → C | Player connected / left or was destroyed |
| `player-died` | S → C | `{ id, killerName, respawnIn }` |
| `map-update` | S → C | `{ objectId, destroyed }` |
| `server-full` | S → C | Open world is at capacity |

**`/missions`**

| Event | Direction | Payload |
|-------|-----------|---------|
| `join-room` | C → S | `{ roomId, name }` (room code 3–12 chars A–Z/0–9) |
| `joined` / `join-error` | S → C | `{ socketId, roomId }` / `{ reason: invalid-room \| room-full \| server-full }` |
| `start-game`, `restart-game`, `leave-room` | C → S | – |
| `player-input` | C → S | `{ up, down, left, right, fire }` on change |
| `mission-init` | S → C | `{ walls }` on join / restart |
| `walls-removed` | S → C | Wall ids destroyed this tick |
| `game-state` | S → C | State without walls, 20 Hz |

## License

MIT
