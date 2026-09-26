# Deploying to planner.example.com

Step-by-step instructions for putting YAPCO online at `https://planner.example.com`, a
subdomain of a domain you already own. Two ways, both behind Cloudflare:

| | A. Cloudflare Worker (recommended) | B. Proxmox server + Cloudflare Tunnel |
|---|---|---|
| Runs on | Cloudflare (static files + Worker + Browser Run) | Your own LXC container |
| PDF creation | Browser Run: 10 browser-minutes a day on the free plan (a few full planners) | Chromium on your server, no daily limit |
| Updates | Automatic on every push to `main` (CI tests, deploys, smoke-tests, rolls back) | You run an update script |
| Cost | Free (Workers Paid, $5/month, if you need more PDF time) | Your electricity |
| Home server down | Site still up | Site down |

Start with **A**. Use **B** if the Browser Run limit becomes a problem, or if you prefer to keep
everything on your own hardware. The two are independent; you can switch later by pointing the
hostname elsewhere.

Everything below assumes the repository is `github.com/mdyzma/yapco`.

---

## Step 0 (both ways): example.com on Cloudflare DNS

Both a Worker custom domain and a Tunnel need the domain's DNS to be managed by Cloudflare.

1. In the Cloudflare dashboard: **Websites** (or **Domains**) → check whether `example.com` is
   listed as **Active**. If it is, skip to step A1 or B1.
2. Otherwise: **Add a domain** → `example.com` → **Free** plan. Cloudflare scans the existing
   DNS records.
3. **Compare the records carefully** with those at your current DNS provider before switching:
   the main website (`A` / `CNAME` for `@` and `www`), **mail** (`MX`, plus `TXT` records for SPF,
   DKIM and DMARC), and any verification `TXT` records. Add anything the scan missed. A missing MX
   record means lost email.
4. For records of your existing main site, keep the proxy status Cloudflare suggests, or set them
   to **DNS only** (grey cloud) if you want nothing about the main site to change.
5. At your **registrar**, replace the nameservers with the two Cloudflare shows you. Activation
   usually takes minutes to a few hours; Cloudflare emails you when the zone is **Active**.
6. **Do not** create a DNS record for `planner` yourself; the Worker (A) or the Tunnel (B)
   creates it.

> SSL/TLS mode is zone-wide. Before you change it to *Full (strict)* (see "Security settings"
> below), make sure your main site's server has a valid certificate, or its proxied records will
> start failing.

---

## A. Cloudflare Worker

The repository already contains everything: `apps/worker` (one Worker named `yapco` serving the
static site and the PDF API), and `.github/workflows/deploy.yml` (deploys `main` after CI passes).
Only the credentials and the domain are missing. Background: [cloudflare.md](cloudflare.md).

### A1. Account ID

Dashboard → **Workers & Pages** → the **Account ID** on the right. Copy it.

(If it asks you to pick a `*.workers.dev` subdomain, choose any name; it also serves as a backup
address for the app.)

### A2. API token

**My Profile** → **API Tokens** → **Create Token** → template **Edit Cloudflare Workers** → *Use
template*. Then adjust:

- **Account Resources**: *Include* → your account.
- **Zone Resources**: *Include* → *Specific zone* → `example.com`.
- Make sure these permissions are in the list (add rows if needed):
  - Account → **Workers Scripts** → Edit
  - Account → **Browser Rendering** → Edit
  - Zone → **Workers Routes** → Edit
  - Zone → **DNS** → Edit
  - Zone → **Zone** → Read

**Continue to summary** → **Create Token** → copy it (it is shown once).

### A3. GitHub secrets and variable

In GitHub: `mdyzma/yapco` → **Settings** → **Secrets and variables** → **Actions**.

- *Secrets* tab → **New repository secret**:
  - `CLOUDFLARE_API_TOKEN` = the token from A2
  - `CLOUDFLARE_ACCOUNT_ID` = the ID from A1
- *Variables* tab → **New repository variable**:
  - `PRODUCTION_URL` = `https://planner.example.com`

`PRODUCTION_URL` is used by the smoke test after each deploy and by the weekly drift check.

### A4. Attach the subdomain

In `apps/worker/wrangler.jsonc`, replace the commented-out example:

```jsonc
  // With a domain, add it here (docs/operations/cloudflare.md):
  // "routes": [{ "pattern": "planner.example.com", "custom_domain": true }],
```

with:

```jsonc
  "routes": [{ "pattern": "planner.example.com", "custom_domain": true }],
```

Keep `"workers_dev": true` for now, so the `*.workers.dev` address works as a fallback.

### A5. Deploy

Commit and push to `main`. In GitHub → **Actions** → **Deploy**, watch the run:

1. `verify`: lint, types, tests, build, PDF check in Chrome (the same as CI).
2. `Deploy to Cloudflare`: `wrangler deploy` creates the Worker, the DNS record for
   `planner.example.com` and its certificate.
3. Smoke test on `https://planner.example.com`: the page loads, `/api/export/health` answers
   `{"ok":true}`, and the security headers are present. If it fails, the deploy is rolled back
   automatically.

The very first time, the certificate can take a few minutes. If the smoke test fails only for
that reason, re-run the job (**Re-run failed jobs**) after five minutes.

*Alternative, from your own computer* (the same result, without GitHub):

```bash
pnpm install
pnpm --filter @planner/web build
pnpm --filter @planner/worker exec wrangler login
pnpm --filter @planner/worker deploy
```

### A6. Check it by hand

```bash
curl -sI https://planner.example.com/en
```

```bash
curl -s https://planner.example.com/api/export/health
```

Then in a browser: create a planner, open **Export** → **Create PDF** for one month, and check
that the PDF downloads. The address bar should offer to **install** the app (PWA).

### A7. Later

- When everything works, you may set `"workers_dev": false` in `wrangler.jsonc` so only the
  subdomain serves the app.
- Browser Run usage: **Workers & Pages** → **Browser Rendering**. If the daily 10 minutes run out,
  PDF creation answers "busy" until the next day; the app still works, and printing from the
  browser always works. Workers Paid ($5/month) raises the limit.
- Logs: `pnpm --filter @planner/worker exec wrangler tail`.
- Roll back: `pnpm --filter @planner/worker exec wrangler rollback`.

---

## B. Proxmox + Cloudflare Tunnel

The site is a set of static files, and PDF creation is `apps/export-node`, which renders pages
in a local Chromium. On one small container, **Caddy** serves the static files and forwards
`/api/export/*` to the export service. **cloudflared** connects the container to Cloudflare
without opening any port on your router.

```text
browser ──https──> Cloudflare ──tunnel──> cloudflared ──> Caddy :8080 ──┬─ static files (apps/web/out)
                                                                         └─ /api/export/* ──> export-node 127.0.0.1:8787 ──> Chromium
```

**Do not set the Cloudflare GitHub secrets** in this setup (step A3). Without them, the Deploy
workflow only runs the checks and skips deploying to Workers.

### B1. Create the container

In Proxmox: **Create CT**.

- Template: **Debian 12** (standard).
- Unprivileged: yes. Nesting: not needed.
- 2 CPU cores, 2048 MB RAM (4096 is more comfortable for large planners), 16 GB disk.
- Network: DHCP or a fixed IP in your LAN. No port forwarding is needed.

Start it and open the console (as root).

### B2. Install the software

```bash
apt update && apt full-upgrade -y
apt install -y curl git ca-certificates gnupg chromium fonts-dejavu-core debian-keyring debian-archive-keyring apt-transport-https
```

Node.js 24 (the version in `.nvmrc`) and pnpm:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
corepack enable
```

Caddy:

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

cloudflared is installed in step B6, with the command the dashboard gives you.

### B3. Get and build the app

```bash
useradd --system --create-home --home-dir /opt/yapco --shell /usr/sbin/nologin yapco
sudo -u yapco git clone https://github.com/mdyzma/yapco.git /opt/yapco/app
cd /opt/yapco/app
sudo -u yapco corepack pnpm install --frozen-lockfile
sudo -u yapco corepack pnpm --filter @planner/web build
```

The build ends with `build-sw: … files`; the site is now in `/opt/yapco/app/apps/web/out`.

(If `sudo` is missing: `apt install -y sudo`.)

### B4. The export service (systemd)

`/etc/systemd/system/yapco-export.service`:

```ini
[Unit]
Description=YAPCO PDF export service
After=network.target

[Service]
User=yapco
WorkingDirectory=/opt/yapco/app
Environment=EXPORT_PORT=8787
Environment=EXPORT_ALLOWED_ORIGINS=https://planner.example.com
Environment=CHROME_PATH=/usr/bin/chromium
ExecStart=/usr/bin/corepack pnpm --filter @planner/export-node serve
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now yapco-export
journalctl -u yapco-export -n 20
curl -s http://127.0.0.1:8787/api/export/health
```

The log should say `Export service on http://127.0.0.1:8787 for https://planner.example.com`,
and the health check should answer `{"ok":true}`. The service listens on localhost only, and
answers only pages from `https://planner.example.com`.

### B5. Caddy (static files + API)

`/etc/caddy/Caddyfile` (replace its contents). Caddy listens on plain HTTP inside the container;
Cloudflare terminates HTTPS.

```caddyfile
{
	auto_https off
	admin off
}

:8080 {
	root * /opt/yapco/app/apps/web/out

	# The same security headers as the Cloudflare setup (apps/web/public/_headers).
	header {
		Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
		X-Content-Type-Options nosniff
		Referrer-Policy no-referrer
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
		Cross-Origin-Opener-Policy same-origin
		Strict-Transport-Security "max-age=31536000"
		-Server
	}
	header /_next/static/* Cache-Control "public, max-age=31536000, immutable"
	header /sw.js Cache-Control "no-cache"

	handle /api/export/* {
		request_body {
			max_size 10MB
		}
		reverse_proxy 127.0.0.1:8787
	}

	handle {
		try_files {path} {path}.html {path}/index.html
		file_server
	}

	handle_errors {
		rewrite * /404.html
		file_server
	}
}
```

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
curl -sI http://127.0.0.1:8080/en | head -5
curl -s http://127.0.0.1:8080/api/export/health
```

### B6. Cloudflare Tunnel

In the Cloudflare dashboard: **Zero Trust** (first time: choose a team name and the **Free**
plan) → **Networks** → **Tunnels** → **Create a tunnel** → **Cloudflared** → name it `proxmox`.

1. **Install connector**: choose **Debian**, **64-bit**, and run the command shown (it installs
   `cloudflared` and registers it as a service with your tunnel token) in the container.
2. **Public hostname** (on the next screen):
   - Subdomain: `planner`
   - Domain: `example.com`
   - Service: **HTTP**, URL `localhost:8080`
3. **Save tunnel**. Cloudflare creates the `planner` DNS record (a CNAME to the tunnel) itself.

Check the tunnel shows **Healthy**, then from any computer:

```bash
curl -s https://planner.example.com/api/export/health
```

Open the site, create a planner and make a PDF of one month.

### B7. Updating

`/opt/yapco/update.sh`:

```bash
#!/bin/sh
set -e
cd /opt/yapco/app
sudo -u yapco git pull --ff-only
sudo -u yapco corepack pnpm install --frozen-lockfile
sudo -u yapco corepack pnpm --filter @planner/web build
systemctl restart yapco-export
echo "Updated to $(sudo -u yapco git rev-parse --short HEAD)"
```

```bash
chmod +x /opt/yapco/update.sh
/opt/yapco/update.sh
```

Run it after pushing to `main` (ideally once the CI run is green). Caddy needs no restart. Open
copies of the app pick up the new version on their next visit (the service worker checks
`/sw.js` every time).

### B8. Notes

- Back up the container with Proxmox's normal backups; it holds no user data (planners live
  only in each user's browser), so a rebuild from the steps above is just as good.
- The export service keeps nothing and logs no planners; keep `journalctl` at its defaults.
- Several people making PDFs at the same time share the container's CPU; one six-month planner
  takes about a minute.

---

## Security settings (both ways)

On the `example.com` zone in Cloudflare:

- **Security** → **WAF** → **Rate limiting rules** (one rule is free): *URI Path* *starts with*
  `/api/export/`, more than **60** requests per **10 seconds** per IP → **Block** for 10
  seconds. With B this is the only rate limit (the Worker in A has its own as well).
- **Security** → **Bots**: **Bot Fight Mode** on.
- **SSL/TLS** → **Edge Certificates**: **Always Use HTTPS** on, **Minimum TLS Version** 1.2.
  **Overview** → encryption mode **Full (strict)**, but only if your main site's origin has a
  valid certificate (see the note in step 0). Neither A nor B depends on this setting.
- Leave **Web Analytics**, **Zaraz** and **Browser Insights** off. The privacy notice
  (`/en/privacy`) promises no analytics.

### Optional: keep it private at first

To try the site before anyone else can reach it: **Zero Trust** → **Access** → **Applications**
→ **Add an application** → *Self-hosted* → domain `planner.example.com` → policy *Allow* →
*Emails* → your own address. Visitors then log in with a one-time code sent by email. Remove the
application when you go public.

Two caveats while Access is on:

- The GitHub smoke test (A) cannot pass the login. Either add a *Service Auth* policy with a
  service token, or expect the smoke test to fail and re-run it after removing Access.
- The weekly drift check stops working for the same reason.

The privacy notice mentions Cloudflare hosting; with Access, Cloudflare also processes your
email address for the login.
