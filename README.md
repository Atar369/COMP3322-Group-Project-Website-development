# The Kitchen Ledger

A restaurant queuing, table booking, and ordering web app for a single virtual restaurant. Customers can browse the menu, place orders, join the queue, and book tables. Managers can manage the menu, orders, queue, and bookings, and view a sales dashboard.

## Tech stack

- **Frontend:** React (Vite), React Router, Recharts, Socket.io client
- **Backend:** Node.js + Express (REST API + Socket.io)
- **Database:** MySQL 8
- **Deployment:** Docker Compose on a Linux VM

## Project structure

```
.
├── frontend/          React SPA + Dockerfile + nginx.conf
├── backend/           Express API + Dockerfile
├── database/init/     SQL schema and seed data (runs on first DB start)
├── docker-compose.yml
└── .env.example
```

## Run with Docker Compose (recommended)

Requirements: Docker and the Docker Compose plugin.

1. Copy the environment template and fill in your own values:

```bash
   cp .env.example .env
```

   | Variable           | Description                     |
   | ------------------ | ------------------------------- |
   | `DB_ROOT_PASSWORD` | MySQL root password             |
   | `DB_NAME`          | Database name (`restaurant_app`) |
   | `JWT_SECRET`       | Secret used to sign login tokens |

2. Build and start all services:

```bash
   docker compose up --build
```

3. Open <http://localhost> (or the server's IP address on port 80).

How it works: the frontend container serves the built React app with nginx and forwards `/api` and `/socket.io` requests to the `backend` service. The backend connects to the `db` service. On the first start, MySQL runs the scripts in `database/init/` automatically, so no manual import is needed. Only the frontend port is exposed to the host.

To stop the services:

```bash
docker compose down
```

To reset the database (deletes all data and re-runs the SQL scripts):

```bash
docker compose down -v
```

## Run locally without Docker

Requirements: Node.js 20+ and a running MySQL 8 instance with the scripts in `database/init/` imported.

Backend (in one terminal):

```bash
cd backend
npm install
npm start
```

Frontend (in another terminal):

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs at <http://localhost:5173> and proxies `/api` and `/socket.io` to the backend at `http://localhost:5000`.

## Demo accounts

| Role     | Email                 | Password     |
| -------- | --------------------- | ------------ |
| Customer | alice@example.com     | [password]   |
| Manager  | manager@example.com   | [password]   |

## Notes

- Never commit `.env` or real credentials. Only `.env.example` belongs in the repo.
- Credits for third-party code or components are listed on the app's credits page.