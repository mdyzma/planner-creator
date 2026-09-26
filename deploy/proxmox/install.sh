#!/bin/sh
# Installs or updates YAPCO in a Debian 12 or 13 container (docs/operations/deploy-subdomain.md, B).
# Run as root inside the container, as often as you like:
#
#   curl -fsSL https://raw.githubusercontent.com/mdyzma/yapco/main/deploy/proxmox/install.sh | sh
#
# First run: installs Node.js, Chromium and Caddy, builds the app, and starts two services:
#   yapco-export  the PDF export service on 127.0.0.1:8787
#   caddy         the site and /api/export/* on port 8080 (for the Cloudflare Tunnel)
# Later runs: pulls main, rebuilds and restarts. The Cloudflare Tunnel is set up separately.
#
# Jenkins runs it over SSH with the commit it has just tested (Jenkinsfile, Deploy stage).
#
# YAPCO_ORIGIN  the public address (default https://planner.example.com); the container's own
#               http://<LAN address>:8080 is allowed too, for testing before the tunnel exists
# YAPCO_REPO    where to fetch the code (default GitHub; e.g. your Gitea mirror)
# YAPCO_BRANCH  the branch to deploy (default main)
# YAPCO_COMMIT  deploy exactly this commit instead of the tip of the branch
set -eu

ORIGIN="${YAPCO_ORIGIN:-https://planner.example.com}"
REPO="${YAPCO_REPO:-https://github.com/mdyzma/yapco.git}"
BRANCH="${YAPCO_BRANCH:-main}"
COMMIT="${YAPCO_COMMIT:-}"
HOME_DIR=/opt/yapco
APP="$HOME_DIR/app"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1

say() { printf '\n==> %s\n' "$*"; }
as_yapco() { runuser -u yapco -- env HOME="$HOME_DIR" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1 "$@"; }

# The whole script is read before anything runs, and nothing reads the rest of it as input:
# it arrives through a pipe (curl | sh, or ssh … sh -s from Jenkins).
main() {
exec </dev/null
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
LAN="http://$(hostname -I | awk '{print $1}'):8080"

say "System packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  curl git ca-certificates gnupg chromium fonts-dejavu-core fonts-liberation >/dev/null

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  say "Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
fi
corepack enable

if ! command -v caddy >/dev/null; then
  say "Caddy"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy >/dev/null
fi

if ! id yapco >/dev/null 2>&1; then
  say "User yapco"
  useradd --system --create-home --home-dir "$HOME_DIR" --shell /usr/sbin/nologin yapco
fi
# Debian 13 creates homes as 0700; Caddy (its own user) must be able to read the built site.
chmod 755 "$HOME_DIR"

say "Code ($REPO, $BRANCH${COMMIT:+ at $COMMIT})"
if [ -d "$APP/.git" ]; then
  as_yapco git -C "$APP" remote set-url origin "$REPO"
  as_yapco git -C "$APP" fetch --quiet origin "$BRANCH"
  as_yapco git -C "$APP" checkout --quiet "$BRANCH"
else
  as_yapco git clone --quiet --branch "$BRANCH" "$REPO" "$APP"
fi
as_yapco git -C "$APP" reset --quiet --hard "${COMMIT:-origin/$BRANCH}"
echo "at $(as_yapco git -C "$APP" log -1 --format='%h %s')"

say "Install and build (a few minutes)"
cd "$APP"
as_yapco corepack pnpm install --frozen-lockfile
SHA="$(as_yapco git -C "$APP" rev-parse HEAD)"
as_yapco env BUILD_SHA="$SHA" corepack pnpm turbo run build --filter=@planner/web...

say "Export service"
cat > /etc/systemd/system/yapco-export.service <<EOF
[Unit]
Description=YAPCO PDF export service
After=network.target

[Service]
User=yapco
WorkingDirectory=$APP
Environment=HOME=$HOME_DIR
Environment=COREPACK_ENABLE_DOWNLOAD_PROMPT=0
Environment=EXPORT_PORT=8787
Environment=EXPORT_ALLOWED_ORIGINS=$ORIGIN,$LAN
Environment=CHROME_PATH=/usr/bin/chromium
ExecStart=/usr/bin/corepack pnpm --filter @planner/export-node serve
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --quiet yapco-export
systemctl restart yapco-export

say "Caddy"
cat > /etc/caddy/Caddyfile <<EOF
{
	auto_https off
	admin off
}

:8080 {
	root * $APP/apps/web/out

	# The same security headers as on Cloudflare (apps/web/public/_headers).
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
EOF
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl enable --quiet caddy
systemctl restart caddy

say "Checks"
ok=true
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS http://127.0.0.1:8787/api/export/health 2>/dev/null | grep -q '"ok":true' && break
  [ "$i" = 10 ] && { echo "export service: NOT answering (journalctl -u yapco-export)"; ok=false; }
  sleep 2
done
curl -fsS http://127.0.0.1:8080/pl | grep -q '<title>YAPCO' \
  && echo "site on :8080: ok" || { echo "site on :8080: NOT ok (journalctl -u caddy)"; ok=false; }
curl -fsS http://127.0.0.1:8080/api/export/health | grep -q '"ok":true' \
  && echo "PDF service through Caddy: ok" || { echo "PDF service through Caddy: NOT ok"; ok=false; }

if $ok; then
  say "Done. Serving $ORIGIN (and $LAN on your network); point the Cloudflare Tunnel at $LAN."
else
  exit 1
fi
}

main "$@"
