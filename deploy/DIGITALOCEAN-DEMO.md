# Wdrożenie na DigitalOcean (Droplet) — `demo.flowdoc.pl`

Krótka ścieżka: **jeden serwer (Droplet)**, **Docker Compose**, **Caddy** (HTTPS), domena **`demo.flowdoc.pl`**.

## 1. DNS

W panelu domeny `flowdoc.pl` dodaj rekord:

- **Typ:** A  
- **Nazwa / host:** `demo`  
- **Wartość:** publiczny **IP Droplet** (IPv4)

Propagacja: zwykle kilka minut do kilku godzin.

## 2. Droplet — przygotowanie systemu i Docker

- Ubuntu 24 LTS (lub 22 LTS), najmniejszy plan wystarczy na start.
- **Firewall:** w panelu DigitalOcean (Networking → Firewalls) lub na hoście przez `ufw` muszą być otwarte **22** (SSH), **80**, **443**.

### 2.1 Aktualizacja i podstawowe narzędzia (jako `root` lub z `sudo`)

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git
```

### 2.2 Firewall `ufw` (opcjonalnie, jeśli nie używasz tylko firewalla w panelu DO)

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

### 2.3 Docker Engine + Compose (oficjalny repozytorium Docker dla Ubuntu)

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Sprawdzenie:

```bash
docker --version
docker compose version
```

Caddy w tym repozytorium jest już w `docker-compose.yml`: obraz `caddy:2-alpine` z montowaniem `./caddy/Caddyfile` — po `git clone` i uruchomieniu Compose używasz **tego samego** pliku co w repo (domena `demo.flowdoc.pl` w `caddy/Caddyfile`).

## 3. Kod na serwerze

```bash
git clone https://github.com/patrykflowdoc/flowdoc_demo_app.git
cd flowdoc_demo_app
```

## 4. Pliki środowiskowe

- Otwórz `deploy/env.production.example` i na tej podstawie utwórz dwa pliki:
  - **`.env`** w katalogu głównym (obok `docker-compose.yml`): `COMPOSE_PROJECT_NAME=flowdoc-demo`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — hasło musi być takie samo jak w `DATABASE_URL`.
  - **`backend/.env`**: `DATABASE_URL`, `JWT_SECRET`, **`CORS_ORIGIN=https://demo.flowdoc.pl`**, `PORT=25044`, `NODE_ENV=production` (szczegóły w przykładzie).

## 5. Uruchomienie (produkcja)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

## 6. Sprawdzenie

- W przeglądarce: `https://demo.flowdoc.pl`
- Jeśli certyfikat się nie tworzy: sprawdź DNS (A na właściwy IP) i logi:  
  `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f caddy`

## Uwagi

- **App Platform** DigitalOcean nie wykrywa automatycznie tego monorepo — Droplet + Compose jest prostszy dla tego projektu.
- `docker-compose.prod.yml` wyłącza mapowanie portu Postgresa na hosta — baza jest dostępna tylko w sieci Dockera.
- Kopie zapasowe: wolumen Postgres (`postgres_data`) i uploady (`uploads_data`).
