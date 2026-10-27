# Open Glades — Deployment

The Open Glades site (`openglades.com`) is a **static** site served by nginx straight
from this repo, plus one tiny Node service that relays the contact form through SendGrid,
and **Fairweather** (`openglades.com/fairweather`), a small standalone Next.js app.
It is completely independent of the Next.js app in `website/`.

```
open-glades/
  site/         ← static files, this is the nginx root
  server/       ← contact mailer (Node + SendGrid)
  fairweather/  ← Fairweather weather PWA (Next.js, own SQLite, own systemd service)
  deploy/       ← nginx config, systemd units, this doc
```

Paths below assume the repo is checked out at `/srv/jroverton.com`. **Change the paths**
in `nginx-openglades.conf` and `openglades-mailer.service` if you clone elsewhere.

---

## 1. DNS

Point the domain at the server:

| Record | Name | Value |
|--------|------|-------|
| A (+ AAAA) | `openglades.com` | server IP |
| A (+ AAAA) | `www.openglades.com` | server IP |

## 2. Get the code on the server

```sh
sudo mkdir -p /srv && cd /srv
sudo git clone https://github.com/john-overton/jroverton.com.git
# (or: cd /srv/jroverton.com && sudo git pull)
```

The site is now at `/srv/jroverton.com/open-glades/site` — no build step needed.

## 3. Contact mailer (SendGrid)

The SendGrid API key is server-side only; it must never go in the static site.

```sh
cd /srv/jroverton.com/open-glades/server
npm ci                         # installs @sendgrid/mail
cp config.example.json config.json
sudo nano config.json          # fill in the real values (see below)
```

`config.json` fields:

| key | meaning |
|-----|---------|
| `sendgridApiKey` | a SendGrid API key with **Mail Send** permission |
| `contactFrom` | a **verified** SendGrid sender/domain address (e.g. `website@openglades.com`) |
| `contactTo` | where contact submissions are delivered (e.g. `hello@openglades.com`) |
| `allowedOrigins` | `["https://openglades.com","https://www.openglades.com"]` |
| `port` / `host` | leave as `8787` / `127.0.0.1` (nginx proxies to this) |

> `config.json` is git-ignored. With a placeholder/missing key the service runs in
> **dry-run** mode (logs the message, returns success) — handy for testing.

Install + start the service:

```sh
sudo cp /srv/jroverton.com/open-glades/deploy/openglades-mailer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openglades-mailer
curl -s http://127.0.0.1:8787/api/health        # -> {"ok":true,"dryRun":false}
```

## 4. Fairweather (openglades.com/fairweather)

A Next.js app with its own SQLite database (push subscriptions only) and a server crontab.
Needs Node 20 to 25 (better-sqlite3 has no Node 26 build yet).

```sh
cd /srv/jroverton.com/open-glades/fairweather
npm ci
cp env.sample .env.local
sudo nano .env.local           # fill in the values below
npx web-push generate-vapid-keys   # paste into FAIRWEATHER_VAPID_PUBLIC_KEY / _PRIVATE_KEY
openssl rand -hex 32               # paste into FAIRWEATHER_CRON_SECRET
npm run build                      # NEXT_PUBLIC_* values are baked in here; rebuild if they change
sudo install -d -o www-data -g www-data data .next
sudo chown -R www-data:www-data .next
```

`.env.local` keys (see `env.sample`):

| key | meaning |
|-----|---------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public token for the Radar page; add `openglades.com` to its URL restrictions |
| `NEXT_PUBLIC_MAPBOX_STYLE_LIGHT` / `NEXT_PUBLIC_MAPBOX_STYLE_DARK` | Mapbox style URLs for the radar's Day and Night basemaps (blank = stock light-v11 / dark-v11) |
| `FAIRWEATHER_VAPID_PUBLIC_KEY` / `FAIRWEATHER_VAPID_PRIVATE_KEY` | Web Push keys. Generate once; changing them invalidates every subscription |
| `FAIRWEATHER_VAPID_SUBJECT` | `mailto:` contact sent to push services |
| `FAIRWEATHER_CRON_SECRET` | shared secret between the crontab and the app |
| `AIRNOW_API_KEY` (optional) | EPA AirNow; falls back to CAMS air quality without it |

Install + start the service, then the crontab:

```sh
sudo cp /srv/jroverton.com/open-glades/deploy/openglades-fairweather.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openglades-fairweather
curl -s http://127.0.0.1:3100/fairweather/api/radar/manifest | head -c 200   # -> {"latestObs":...}

sudo crontab -u www-data -e
#   */2 * * * *   /srv/jroverton.com/open-glades/fairweather/scripts/cron.sh alerts   >/dev/null
#   */15 * * * *  /srv/jroverton.com/open-glades/fairweather/scripts/cron.sh rain     >/dev/null
#   17 3 * * *    /srv/jroverton.com/open-glades/fairweather/scripts/cron.sh cleanup  >/dev/null
#   */5 * * * *   /srv/jroverton.com/open-glades/fairweather/scripts/cron.sh radar    >/dev/null
```

The `radar` job keeps a disk cache of radar tiles in `fairweather/data/tiles` (about 50 to 100 MB, pruned
to the last 25 h) and pre-fetches the default view so phones load radar quickly.

nginx (next step) proxies `/fairweather` to `127.0.0.1:3100` and returns 404 for
`/fairweather/api/cron/` so only the local crontab can trigger jobs.

## 5. nginx

```sh
sudo cp /srv/jroverton.com/open-glades/deploy/nginx-openglades.conf /etc/nginx/sites-available/openglades
sudo ln -s /etc/nginx/sites-available/openglades /etc/nginx/sites-enabled/openglades
sudo nginx -t
sudo systemctl reload nginx
```

## 6. HTTPS

```sh
sudo certbot --nginx -d openglades.com -d www.openglades.com
```

Certbot adds the `:443` listeners and a http→https redirect automatically.

## 7. Verify

```sh
curl -I https://openglades.com                  # 200, Cache-Control: no-cache
curl -I https://openglades.com/assets/css/styles.css   # 200, long cache
curl -I https://openglades.com/fairweather       # 200, the weather app
curl -s 'https://openglades.com/fairweather/api/forecast?lat=39.10&lon=-94.58' | head -c 200
curl -s -X POST https://openglades.com/api/contact \
  -H 'Content-Type: application/json' -H 'Origin: https://openglades.com' \
  -d '{"name":"Test","email":"test@example.com","message":"hello"}'   # {"ok":true}
```

Then load the site in a browser: the scene should animate, the SCENE panel should
change time/mood, and the contact form should deliver an email.

---

## Updating after a change

```sh
cd /srv/jroverton.com && sudo git pull
```

- Static changes (HTML/CSS/JS/assets) are live immediately (html is sent `no-cache`).
- Only if `open-glades/server/` changed: `sudo systemctl restart openglades-mailer`.
- Only if `open-glades/fairweather/` changed:
  `cd open-glades/fairweather && npm ci && npm run build && sudo systemctl restart openglades-fairweather`.
  (Unlike the static site, a `git pull` alone does not update Fairweather.)

### Optional: auto-deploy

Add a cron job to pull periodically, e.g. every 5 minutes:

```cron
*/5 * * * * cd /srv/jroverton.com && git pull --quiet
```

(or wire a GitHub webhook / Action to `git pull` on push to `main`).
