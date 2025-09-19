# 🛡️ Tank 90 Multiplayer – Project Documentation

## 📌 Overview

**Tank 90 Multiplayer** is a modern web-based remake of the classic Tank 1990 game. It supports real-time multiplayer gameplay in a browser. The game is developed using **TypeScript** for both frontend and backend and is containerized using **Docker Compose** for ease of deployment and development.

---

## 🚀 Tech Stack

### Frontend
- **TypeScript**
- **React** or **PixiJS** (for rendering the 2D game canvas)
- **Socket.IO** (for real-time multiplayer sync)
- **HTML/CSS**

### Backend
- **Node.js** (TypeScript)
- **Express.js**
- **Socket.IO Server**
- **MongoDB** (for storing leaderboard and player stats)

### Infrastructure
- **Docker**
- **Docker Compose**
- **Nginx** (optional, for production reverse proxy)
- **.env** for configuration

---

## 🧩 Project Structure


## 🧩 Project Structure
```
tank90/
├── client/ # Frontend code
│ ├── public/
│ ├── src/
│ │ ├── assets/
│ │ ├── components/
│ │ ├── game/ # Game engine and canvas logic
│ │ ├── utils/
│ │ └── main.tsx
│ └── package.json
│
├── server/ # Backend code
│ ├── src/
│ │ ├── controllers/
│ │ ├── services/
│ │ ├── sockets/
│ │ └── index.ts
│ └── package.json
│
├── docker-compose.yml
├── Dockerfile.client
├── Dockerfile.server
├── .env
└── README.md
```

---

---

## 🎮 Game Features

- Multiplayer mode (2+ players)
- Destructible and indestructible walls
- Power-ups (star, shield, speed boost, etc.)
- Player stats and leaderboard
- Level progression

---

## 🧱 Game Mechanics

### Controls

| Player | Movement           | Fire        |
|--------|--------------------|-------------|
| P1     | Arrow keys         | Spacebar    |
| P2     | W A S D            | F           |

### Objects

- 🟥 Red Tanks – Enemies
- 🟦 Blue Tank – Player 2
- 🟨 Yellow Tank – Player 1
- 🧱 Brick Wall – Destructible
- 🧱 Metal Wall – Indestructible
- ⭐ Star – Power-up
- ⚡ Bolt – Speed boost

---

## ⚙️ Setup & Deployment

### Prerequisites

- Docker & Docker Compose installed

### 1. Clone the repo
```bash
git clone https://github.com/gexayr/tank90.git
cd tank90
```


### 2. Create .env file
```aiexclude
PORT=3000
MONGO_URI=mongodb://mongo:27017/tank90
```

### 3. Build & Run
```aiexclude
docker-compose up --build
```

This starts:
- Frontend at `http://localhost:5173`
- Backend at `http://localhost:3000`
- MongoDB at port `27017`

---

## 🧪 Development

### Frontend
```bash
cd client
npm install
npm run dev
```

### Backend

```aiexclude
cd server
npm install
npm run dev
```

## 🛠️ Backend API

### REST Endpoints

| Method | Endpoint          | Description           |
|--------|-------------------|-----------------------|
| GET    | /leaderboard      | Get top scores        |
| POST   | /player/register  | Register a new player |
| POST   | /score/update     | Update player score   |

### WebSocket Events

| Event           | Direction       | Description                       |
|----------------|------------------|-----------------------------------|
| `player-join`  | Client → Server | Player joins game                |
| `state-update` | Server → Client | Broadcast game state             |
| `player-move`  | Client → Server | Player movement input            |
| `fire`         | Client → Server | Player fires a shot              |
| `game-over`    | Server → Client | Game ends                        |

---

## 🧾 License

MIT License

---

## 📞 Contact

For collaboration or issues, reach out to the development team at [your-email@example.com].


## Notes on WebSocket connectivity behind reverse proxies

If you see errors like `Connection error: websocket error` or browser logs showing that a WebSocket connection to `/socket.io/?EIO=4&transport=websocket` failed, your reverse proxy (e.g., NGINX) might not be configured to pass WebSocket upgrade headers.

This project configures the client to prefer HTTP long-polling first and then upgrade to WebSocket when the environment allows it. This ensures the app still works in environments where WebSocket upgrades are blocked.

To enable WebSocket upgrades through NGINX, ensure your site config includes:

```
location /socket.io/ {
  proxy_pass http://server:3000; # adjust upstream
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 600s;
}
```

Environment configuration:
- FRONT_URI should list allowed front-end origins (comma-separated). Example:
  `FRONT_URI=https://tank.amsoft.am,http://localhost:5173`
- VITE_SERVER_URL should point to your backend base URL that serves Socket.IO. Example:
  `VITE_SERVER_URL=https://tank-back.amsoft.am`

With these settings, polling will connect even if WebSockets are blocked, and will upgrade to WebSockets automatically when the proxy is correctly configured.
