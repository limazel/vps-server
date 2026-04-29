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
command -v docker         >/dev/null 2>&1 || err "Docker kurulu değil."
command -v docker compose >/dev/null 2>&1 || err "Docker Compose kurulu değil."
command -v nginx          >/dev/null 2>&1 || err "Nginx kurulu değil."
ok "Ön koşullar tamam"

# --- port çakışması kontrolü ---
for PORT in 3000 3001; do
  if ss -tlnp 2>/dev/null | grep -q ":$PORT " || \
     netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
    err "Port $PORT zaten kullanımda. docker-compose.yml içinden port değiştir."
  fi
done
ok "Portlar (3000, 3001) müsait"

# --- .env ---
if [ ! -f .env ]; then
  cp .env.example .env
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s/change-this-to-a-long-random-string-at-least-32-chars/$JWT_SECRET/" .env
  warn ".env oluşturuldu. Aşağıdaki değerleri düzenle:"
  echo ""
  echo "  nano .env"
  echo ""
  echo "  Düzenlenmesi gerekenler:"
  echo "    CERTBOT_EMAIL       → e-posta adresin"
  echo "    NEXT_PUBLIC_API_URL → https://panel.kovente.com"
  echo "    FRONTEND_URL        → https://panel.kovente.com"
  echo ""
  read -p "Düzenledikten sonra Enter'a bas..."
fi

# Domaini .env'den oku
DOMAIN=$(grep "^NEXT_PUBLIC_API_URL" .env | cut -d'=' -f2 | sed 's|https\?://||' | tr -d '[:space:]')
[ -z "$DOMAIN" ] && err "NEXT_PUBLIC_API_URL .env içinde ayarlanmamış."
ok "Panel domain: $DOMAIN"

# --- host dizinleri ---
sudo mkdir -p /var/www/apps
ok "/var/www/apps hazır"

# --- nginx panel config ---
# Mevcut sitelere dokunmaz — sadece panel için yeni bir dosya ekler
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"

if [ -f "$NGINX_CONF" ]; then
  warn "Nginx config zaten mevcut: $NGINX_CONF — atlanıyor"
else
  sed "s/panel.example.com/$DOMAIN/g" nginx/panel.conf.example \
    | sudo tee "$NGINX_CONF" > /dev/null

  sudo ln -sf "$NGINX_CONF" "$NGINX_LINK"

  # Config geçerliyse reload, hata varsa geri al
  if sudo nginx -t 2>/dev/null; then
    sudo nginx -s reload
    ok "Nginx config eklendi ve reload yapıldı ($DOMAIN)"
  else
    sudo rm -f "$NGINX_CONF" "$NGINX_LINK"
    err "Nginx config hatası — eklenen config geri alındı. 'sudo nginx -t' çıktısını kontrol et."
  fi
fi

# --- build ve başlat ---
echo ""
echo "Containerlar build ediliyor (ilk seferde birkaç dakika sürebilir)..."
docker compose build
ok "Build tamamlandı"

docker compose up -d
ok "Containerlar başlatıldı"

# --- backend'in hazır olmasını bekle ---
echo "Backend hazır olana kadar bekleniyor..."
READY=0
for i in $(seq 1 20); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    READY=1; break
  fi
  sleep 3
done
[ "$READY" -eq 1 ] || err "Backend başlamadı. 'docker compose logs backend' ile kontrol et."
ok "Backend hazır"

# --- admin kullanıcı ---
echo ""
echo "Admin kullanıcısı oluştur:"
read -p "  Kullanıcı adı [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}
read -s -p "  Şifre: " ADMIN_PASS
echo ""
[ -z "$ADMIN_PASS" ] && err "Şifre boş olamaz."

docker compose exec backend node scripts/create-admin.js "$ADMIN_USER" "$ADMIN_PASS"
ok "Admin oluşturuldu: $ADMIN_USER"

# --- SSL ---
echo ""
read -p "SSL kurmak ister misin? ($DOMAIN) [y/N]: " INSTALL_SSL
if [[ "$INSTALL_SSL" =~ ^[Yy]$ ]]; then
  EMAIL=$(grep "^CERTBOT_EMAIL" .env | cut -d'=' -f2 | tr -d '[:space:]')
  [ -z "$EMAIL" ] && err "CERTBOT_EMAIL .env içinde ayarlanmamış."
  sudo certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect
  ok "SSL kuruldu — HTTPS aktif"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Kurulum tamamlandı!"
echo ""
echo "  Panel  : https://$DOMAIN"
echo "  Loglar : docker compose logs -f"
echo "  Güncelle: git pull && docker compose build && docker compose up -d"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
