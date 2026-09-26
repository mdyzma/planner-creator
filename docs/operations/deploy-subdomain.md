# Deploying to a subdomain

Step-by-step instructions for putting YAPCO online at a subdomain of a domain you already own.
The examples use `planner.example.com`; put your own address in its place. Two ways, both
behind Cloudflare:

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

In the Proxmox web UI, open the **Shell** of your node (not of a container) and download the
Debian 12 template once:

```bash
pveam update
pveam available --section system | grep debian-12
```

Download the name it prints (the version number changes over time), for example:

```bash
pveam download local debian-12-standard_12.12-1_amd64.tar.zst
```

Create and start the container. Pick a free ID instead of `120`, and the storage names you use
(`local-lvm` for the disk is the Proxmox default):

```bash
pct create 120 local:vztmpl/debian-12-standard_12.12-1_amd64.tar.zst --hostname yapco --cores 2 --memory 4096 --swap 1024 --rootfs local-lvm:16 --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1 --features nesting=1 --onboot 1 --start 1
```

The same in the web UI: **Create CT** → hostname `yapco`, template Debian 12, disk 16 GB, 2
cores, 4096 MB memory, network DHCP, *Unprivileged* and *Nesting* on. 4 GB of memory matters:
building the web app with less can fail.

No port forwarding on your router is needed.

### B2. Install YAPCO (one script)

Open a shell in the container, as root:

```bash
pct enter 120
```

Then run the install script from the repository
([deploy/proxmox/install.sh](../../deploy/proxmox/install.sh)):

```bash
apt-get update && apt-get install -y curl
curl -fsSL https://raw.githubusercontent.com/mdyzma/yapco/main/deploy/proxmox/install.sh | sh
```

It takes a few minutes and:

1. installs Node.js 24, Chromium and Caddy;
2. creates the user `yapco` and clones the repository into `/opt/yapco/app`;
3. installs the dependencies and builds the site (`apps/web/out`);
4. starts **yapco-export** (systemd): the PDF export service on `127.0.0.1:8787`, which uses the
   container's Chromium and accepts only pages from `https://planner.example.com`;
5. starts **Caddy** on port 8080: the site with the same security headers as on Cloudflare, and
   `/api/export/*` passed to the export service;
6. checks all three and ends with `Done. Serving https://planner.example.com on port 8080`.

For a different address, run it as
`curl -fsSL … | YAPCO_ORIGIN=https://other.example.com sh`.

If a check fails, the logs are in `journalctl -u yapco-export -n 50` and
`journalctl -u caddy -n 50`.

### B3. Cloudflare Tunnel

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

### B4. Updating

After you push to `main` (ideally once CI is green), run the same script again in the container:

```bash
curl -fsSL https://raw.githubusercontent.com/mdyzma/yapco/main/deploy/proxmox/install.sh | sh
```

It pulls `main`, rebuilds and restarts the export service and Caddy; the rest is left as it is.
Open copies of the app pick up the new version on their next visit (the service worker checks
`/sw.js` every time).

### B5. Automatic deploys with Gitea and Jenkins

Instead of running the script by hand after each push, let Jenkins test every change and deploy
it:

```text
push to GitHub → Gitea pull-mirror (every 10 min) → Jenkins polls Gitea (every 5 min)
  → lint, format, types, tests, build, PDF checks in Chromium (the same as GitHub CI)
  → SSH into the container: install.sh for exactly that commit, fetched from Gitea
```

The pipeline is [Jenkinsfile](../../Jenkinsfile) in the repository root. B1 (the container) is
still needed; the first Jenkins deploy then does everything B2 does.

**1. Gitea mirror.** In Gitea: **+** → **New Migration** → **GitHub** → URL
`https://github.com/mdyzma/yapco.git`, tick **This repository will be a mirror**, interval
`10m0s`. Keep it **public** in Gitea: the container clones from it without credentials. (For a
private mirror, put a read-only access token in the URL you give as `YAPCO_REPO` below.)

**2. SSH from Jenkins to the container.** On any computer, make a key pair for deploys only:

```bash
ssh-keygen -t ed25519 -C yapco-deploy -N "" -f yapco-deploy
```

In the container (`pct enter 120`), allow that key for root. Debian's default allows root logins
by key only, never by password:

```bash
apt-get update && apt-get install -y openssh-server
mkdir -p /root/.ssh && chmod 700 /root/.ssh
echo "PASTE THE CONTENTS OF yapco-deploy.pub HERE" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

**3. Jenkins.**

- The Jenkins machine builds YAPCO itself, so it needs Node.js 24, Chromium and git once (as
  root, Debian 12):

  ```bash
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs
  apt-get install -y git chromium fonts-dejavu-core fonts-liberation openssh-client
  corepack enable
  ```

- Plugins (Manage Jenkins → Plugins): **Pipeline**, **Git** and **SSH Agent**.
- Credentials (Manage Jenkins → Credentials → *Add*): kind **SSH Username with private key**,
  ID `yapco-deploy`, username `root`, private key = the contents of the `yapco-deploy` file.
- Environment variables (Manage Jenkins → System → *Global properties* → *Environment
  variables*):
  - `YAPCO_DEPLOY_HOST` = the container's address, e.g. `192.168.1.50` (give it a fixed IP or
    a DHCP reservation)
  - `YAPCO_REPO` = the Gitea clone URL, e.g. `http://gitea.lan:3000/mdyzma/yapco.git`
  - `YAPCO_ORIGIN` = your public address, e.g. `https://planner.example.com`. It stays in
    Jenkins, not in the repository; without it, PDFs work only from the LAN address.
- **New Item** → name `yapco` → **Pipeline** → *Pipeline script from SCM* → **Git** → the Gitea
  URL, branch `*/main`, script path `Jenkinsfile` → *Save* → **Build Now**.

The first build takes longest (it downloads the dependencies). A green build ends with the install script's `Done. Serving …`.

Without `YAPCO_DEPLOY_HOST`, Jenkins runs the checks and skips the deploy.

### B6. Notes

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
