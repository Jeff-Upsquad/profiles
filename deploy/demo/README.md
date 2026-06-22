# Hosted demo — `squadhire-demo.upsquadconnect.com`

An always-on demo of the Talent + Business modules, running on the VPS against a
**dedicated demo Supabase project** (isolated from prod). Separate from the local
dev demo described in the top-level [`demo/README.md`](../../demo/README.md).

## Topology

```
Internet ──443/TLS──> squadhub-caddy (Caddy, /opt/squadhub/Caddyfile)
                         └─ squadhire-demo.upsquadconnect.com → host.docker.internal:8080
                                                                   │
host nginx :8080 (server_name squadhire-demo.upsquadconnect.com) ──┘
   ├─ /        → 127.0.0.1:3005  (profiles-demo-frontend)
   ├─ /admin   → 127.0.0.1:3006  (profiles-demo-admin)
   └─ /api     → 127.0.0.1:5001  (profiles-demo-api → DEMO Supabase)
```

Checkout: `/root/Profiles-demo` (separate from prod `/root/Profiles`).
Ports: api **5001**, frontend **3005**, admin **3006**.

## Provision from scratch

1. **Clone** a separate checkout on the VPS:
   `git clone https://github.com/Jeff-Upsquad/profiles.git /root/Profiles-demo`
2. **Env:** copy [`backend.env.example`](./backend.env.example) → `/root/Profiles-demo/backend/.env`
   and fill in the demo Supabase URL/keys + `DEMO_REF` + DB password.
3. **DNS:** add an A record `squadhire-demo.upsquadconnect.com → 72.61.245.97` (no wildcard exists).
4. **Build + start:** `cp deploy/deploy-demo.sh /root/Profiles-demo/ && bash /root/Profiles-demo/deploy-demo.sh`
5. **Host nginx:** install [`nginx-profiles-demo.conf`](./nginx-profiles-demo.conf) →
   `/etc/nginx/sites-available/profiles-demo`, symlink into `sites-enabled`, `nginx -t && nginx -s reload`.
6. **Caddy:** append [`Caddyfile.snippet`](./Caddyfile.snippet) to `/opt/squadhub/Caddyfile`, then
   `docker exec squadhub-caddy caddy validate --config /etc/caddy/Caddyfile && docker exec squadhub-caddy caddy reload --config /etc/caddy/Caddyfile`.
   Caddy auto-issues the TLS cert once DNS resolves.

## Update (after code changes land on `main`)

```bash
ssh root@72.61.245.97 'bash /root/Profiles-demo/deploy-demo.sh'   # pulls main, rebuilds, restarts
```

## Refresh the dummy data

```bash
ssh root@72.61.245.97 'cd /root/Profiles-demo/backend && npm run seed:demo'   # wipes + reseeds demo data
```

> Secrets (`backend/.env`) live only on the server and are gitignored. The seed
> script refuses to run unless `SUPABASE_URL` matches `DEMO_REF`, so it can never
> touch production.
