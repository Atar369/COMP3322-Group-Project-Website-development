# The Kitchen Ledger

> **Deployment URL:** [http://c3322-pg04.cs.hku.hk](http://c3322-pg04.cs.hku.hk)
> 
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

## Deployment & Server Configuration (COMP3322)

This project is configured and deployed on the assigned HKU CS project server (**Group 04**). Following the course instructions, we have chosen **Option B (HTTP on Port 80)** for public access within the HKUVPN network.

### Server Link
* **Production URL:** [http://c3322-pg04.cs.hku.hk](http://c3322-pg04.cs.hku.hk)
* *Note: This URL is strictly accessible only when connected to the HKUVPN.*

---

### Network & Port Architecture

Since the school's external firewall restricts traffic exclusively to standard ports, the services have been mapped to utilize standard port interactions safely behind Docker:

| Service | Container Internal Port | Host External Port | Accessibility / Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend (Vite)** | `3000` | `80` | **Public Web Traffic** (Accessible via HKUVPN) |
| **Backend (Express)** | `5000` | `5001` | **Internal Proxy/API** (Proxied via Vite `/api`) |
| **Database (MySQL)** | `3306` | *None* | **Isolated Internal Network Only** (Secure, No Port Published) |

---

### Local Production Setup & Execution

To seamlessly deploy and start the application stacking on the container host, execute the following workflow sequence from the root directory:

1. **Permission Alignment & Reset:**
   Ensure the host's runtime mapping allows Docker execution context accessibility to internal project modules:
   ```bash
   chmod -R 755 ~/COMP3322-Group-Project-Website-development
   ```

2. **Clean Container Environment Initialization:**
   To drop any conflicting active volumes or overlapping configurations, completely cycle the network composition:
   ```bash
   docker compose down -v
   ```

3. **Production Build & Launch:**
   Compile the respective production components and service arguments dynamically on background context:
   ```bash
   docker compose up -d --build
   ```

### Operational Resource Management Reminders
* **Storage Pruning:** Due to strict host environment boundaries (8.6 GB disk cap), the local repository structure maintains a clean automated build architecture. Run `docker image prune -a -f` and `docker builder prune -f` regularly to prevent deployment lockups.
* **API Rate Control:** All outbound API streams strictly abide by HKU ITS compliance; endpoint communication uses loop-guards to guarantee server stability prior to grading.

## Local run with Docker Compose 

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

### School-server demo configuration

The Compose default `FRONTEND_URL` is `http://c3322-pg04.cs.hku.hk`, so verification links return to the deployed app. The coursework demo intentionally runs the backend in development mode: when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are blank, registration and resend show an Ethereal **Preview verification email** link. This does not deliver email to the customer's inbox; tutors can complete verification by opening the preview link.

Keep the server's project-root `.env` private. Set a strong `DB_ROOT_PASSWORD` and `JWT_SECRET`, keep `DB_NAME=restaurant_app`, and do not copy a local `FRONTEND_URL=http://localhost` override to the server. Leave SMTP values blank for preview links, or configure valid SMTP credentials privately if real email delivery is required. Deploy the Git version with `docker compose up -d --build`; do not run `docker compose down -v` on the school server because it deletes the database volume.

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
| Customer | alex@example.com      | [password]   |
| Manager  | manager@example.com   | [password]   |

Managers sign in using their email address. This shared demo credential is for local coursework/demo use only. Replace or remove it before deploying the app publicly; for a custom first manager, use the bootstrap process above.

## Register and verify a customer

1. Open **Customer login** and choose **Register**, or go to `/register/customer`.
2. Enter a name, a unique email address, a unique phone number, and a password of at least 8 characters. Public registration creates customer accounts only.
3. After registration, the app opens **Check your email**. With the provided development email configuration, select **Preview verification email**. With SMTP configured, open the email in the recipient inbox instead.
4. Open the verification link in the same app environment where you registered. A valid link works once and expires after 24 hours. The page should say **Email verified**.
5. Select **Continue to login** and sign in with the email and password used to register. Verification does not sign you in automatically.

If delivery fails, verify the `FRONTEND_URL` and SMTP settings in the project-root `.env`, then recreate the backend with `docker compose up -d --force-recreate backend`. Verification links default to the deployed server; set `FRONTEND_URL=http://localhost` for local Docker. Without SMTP credentials, the development configuration sends a preview email through Ethereal instead of delivering to an inbox. For an existing unverified account, sign in once to reach the verification page or use **Resend verification email** there. Resend is limited to once per 60 seconds.

## Notes

- Never commit `.env` or real credentials. Only `.env.example` belongs in the repo.
- Credits for third-party code or components are listed on the app's credits page.
