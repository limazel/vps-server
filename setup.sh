#!/bin/bash
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Kovente Panel — VPS Kurulum"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# --- ön koşul kontrolleri ---
command -v docker       >/dev/null 2>&1 || err "Docker kurulu değil."
command -v docker compose >/dev/null 2>&1 || err "Docker Compose kurulu değil."

# --- .env ---
if [ ! -f .env ]; then
  cp .env.example .env

  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s/change-this-to-a-long-random-string-at-least-32-chars/$JWT_SECRET/" .env

  warn ".env oluşturuldu. Şu değerleri düzenle:"
  echo ""
  echo "  CERTBOT_EMAIL   → gerçek e-posta adresin"
  echo "  NEXT_PUBLIC_API_URL / FRONTEND_URL → panel domain adresin"
  echo ""
  read -p "Düzenledikten sonra Enter'a bas..."
fi

# --- host dizinleri ---
sudo mkdir -p /var/www/apps /etc/nginx/sites-available /etc/nginx/sites-enabled
ok "Host dizinleri hazır"

# --- nginx panel config ---
if [ ! -f /etc/nginx/sites-available/panel.conf ]; then
  DOMAIN=$(grep NEXT_PUBLIC_API_URL .env | cut -d'=' -f2 | sed 's|https\?://||')
  sed "s/panel.example.com/$DOMAIN/g" nginx/panel.conf.example \
    | sudo tee /etc/nginx/sites-available/panel.conf > /dev/null
  sudo ln -sf /etc/nginx/sites-available/panel.conf /etc/nginx/sites-enabled/panel.conf
  sudo nginx -t && sudo nginx -s reload
  ok "Nginx panel config oluşturuldu ($DOMAIN)"
else
  warn "Nginx panel config zaten mevcut, atlanıyor"
fi

# --- build ve başlat ---
echo ""
echo "Containerlar build ediliyor..."
docker compose build
ok "Build tamamlandı"

docker compose up -d
ok "Containerlar başlatıldı"

# --- backend'in hazır olmasını bekle ---
echo "Backend bekleniyor..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    ok "Backend hazır"
    break
  fi
  sleep 2
done

# --- admin kullanıcı oluştur ---
echo ""
echo "Admin kullanıcısı oluştur:"
read -p "  Kullanıcı adı [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -s -p "  Şifre: " ADMIN_PASS
echo ""

if [ -z "$ADMIN_PASS" ]; then
  err "Şifre boş olamaz."
fi

docker compose exec backend node scripts/create-admin.js "$ADMIN_USER" "$ADMIN_PASS"
ok "Admin oluşturuldu: $ADMIN_USER"

# --- SSL (opsiyonel) ---
echo ""
DOMAIN=$(grep NEXT_PUBLIC_API_URL .env | cut -d'=' -f2 | sed 's|https\?://||')
read -p "SSL kurmak ister misin? ($DOMAIN) [y/N]: " INSTALL_SSL
if [[ "$INSTALL_SSL" =~ ^[Yy]$ ]]; then
  EMAIL=$(grep CERTBOT_EMAIL .env | cut -d'=' -f2)
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect
  ok "SSL kuruldu"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Kurulum tamamlandı!"
echo ""
echo "  Panel: http://$DOMAIN"
echo "  Loglar: docker compose logs -f"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
