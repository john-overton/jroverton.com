# Open Glades — Deployment

The Open Glades site (`openglades.com`) is a **static** site served by nginx straight
from this repo, plus one tiny Node service that relays the contact form through SendGrid,
and **Fairweather** (`openglades.com/fairweather`), a weather app from its own repo
([john-overton/fairweather](https://github.com/john-overton/fairweather)) that nginx proxies to.
It is completely independent of the Next.js app in `website/`.

```
open-glades/
  site/         ← static files, this is the nginx root
  server/       ← contact mailer (Node + SendGrid)
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

Fairweather lives in its own repo, [john-overton/fairweather](https://github.com/john-overton/fairweather),
checked out at `/var/www/fairweather` and run as the `fairweather` systemd service on `127.0.0.1:3100`.
Install, configure, cron, and update steps are in that repo's
[docs/DEPLOYMENT.md](https://github.com/john-overton/fairweather/blob/main/docs/DEPLOYMENT.md).

The Open Glades nginx config (next step) already proxies `/fairweather` to `127.0.0.1:3100` and
returns 404 for `/fairweather/api/cron/` so only the local crontab can trigger jobs.

## 4b. HN Reader (openglades.com/hn)

The reader itself is static (`site/hn/`) and needs nothing. Its **reader view** (the "read"
links, which show an article in the reader's own colours and text size) needs the small
extraction service in `open-glades/hn-reader/`:

```sh
cd /srv/jroverton.com/open-glades/hn-reader
npm ci
sudo cp /srv/jroverton.com/open-glades/deploy/openglades-hn-reader.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openglades-hn-reader
curl -s http://127.0.0.1:8788/hn/api/health        # -> {"ok":true,...}
```

The nginx config (next step) proxies `/hn/api/` to `127.0.0.1:8788`. The service only accepts a
Hacker News item id and fetches that story's link; it refuses private and loopback addresses.
Local testing: `node reader.mjs --dev`, then open `http://localhost:8788/hn/`.
After changing `hn-reader/`: `npm ci` if dependencies changed, then
`sudo systemctl restart openglades-hn-reader`.

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
- Fairweather updates separately, from its own repo (see its `docs/DEPLOYMENT.md`).

### Optional: auto-deploy

Add a cron job to pull periodically, e.g. every 5 minutes:

```cron
*/5 * * * * cd /srv/jroverton.com && git pull --quiet
```

(or wire a GitHub webhook / Action to `git pull` on push to `main`).
