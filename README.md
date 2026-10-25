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

The Vite dev server runs at <http://localhost:3000> and proxies `/api` and `/socket.io` to the backend at `http://localhost:5000`.

## Create the first manager

Public registration always creates customer accounts. Create the first manager once by running the bootstrap command against the running database. Set `BOOTSTRAP_MANAGER_NAME`, `BOOTSTRAP_MANAGER_ID`, `BOOTSTRAP_MANAGER_EMAIL`, `BOOTSTRAP_MANAGER_PHONE`, and `BOOTSTRAP_MANAGER_PASSWORD` in your local environment first. Choose a unique manager ID and phone number and a strong password. Do not put the password directly in a command or commit it to a file.

With Docker Compose:

```sh
docker compose run --rm \
  -e BOOTSTRAP_MANAGER_NAME \
  -e BOOTSTRAP_MANAGER_ID \
  -e BOOTSTRAP_MANAGER_EMAIL \
  -e BOOTSTRAP_MANAGER_PHONE \
  -e BOOTSTRAP_MANAGER_PASSWORD \
  backend npm run bootstrap-manager
```

The command refuses to create an account if any manager already exists. Apply `database/migrations/20261025_add_manager_id.sql` to an existing database before running it. Afterward, sign in at `/login/manager` with the manager's email; the manager ID is for identification and is not a login credential. The manager can create additional managers from **New Manager Registration** in the manager navigation. The API enforces manager-only access independently of the page.

For a local backend, set the bootstrap variables in the backend process environment and run `npm run bootstrap-manager` from `Backend`. The bootstrap password must be at least 12 characters and is hashed with bcrypt before storage.

## Demo accounts

| Role     | Email                 | Password     |
| -------- | --------------------- | ------------ |
| Customer | alice@example.com     | [password]   |
| Manager  | manager@example.com   | [password]   |

Managers sign in using their email address. This shared demo credential is for local coursework/demo use only. Replace or remove it before deploying the app publicly; for a custom first manager, use the bootstrap process above.

## Notes

- Never commit `.env` or real credentials. Only `.env.example` belongs in the repo.
- Credits for third-party code or components are listed on the app's credits page.