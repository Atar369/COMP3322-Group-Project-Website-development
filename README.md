# React + Express Demo

A small full-stack project for demonstrating how a React form sends data to a Node.js/Express backend.

## Run with Docker Compose

On the Ubuntu LXC container, install Docker and the Compose plugin, then run:

```bash
docker compose up --build
```

Open <http://localhost:3000> (or the container host's IP address on port `3000`).

The frontend container runs the Vite development server on container port `3000`. Compose publishes the same port on the host, so students use `localhost:3000`. Vite proxies `/api` requests to the backend service at `backend:5000`. The backend receives the form data, logs it, and returns a JSON response.

This Vite-based container is intentionally simple for the classroom demonstration. A production deployment would normally build the static frontend and serve it with a production web server or hosting platform.

To stop the services:

```bash
docker compose down
```

## Run locally without Docker

In one terminal:

```bash
cd backend
npm install
npm start
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

The local Vite server is available at <http://localhost:3000>. Outside Docker, the proxy falls back to `http://localhost:3000`.
