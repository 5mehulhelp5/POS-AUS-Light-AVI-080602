#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

echo "========================================="
echo "  POS AUS Light - Server Setup"
echo "========================================="

# Update system (no interactive prompts)
apt update
apt -y -o Dpkg::Options::="--force-confold" upgrade

# Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install MySQL 8
echo "Installing MySQL..."
apt install -y mysql-server

# Start MySQL
systemctl start mysql
systemctl enable mysql

# Configure MySQL
echo "Configuring MySQL..."
mysql -u root <<MYSQL_SCRIPT
CREATE DATABASE IF NOT EXISTS pos_aus_light;
CREATE USER IF NOT EXISTS 'pos_user'@'localhost' IDENTIFIED BY 'pos_password_prod_2024';
GRANT ALL PRIVILEGES ON pos_aus_light.* TO 'pos_user'@'localhost';
FLUSH PRIVILEGES;
MYSQL_SCRIPT

# Install nginx
echo "Installing nginx..."
apt install -y nginx

# Install PM2
npm install -g pm2

# Clone repo
echo "Cloning repository..."
cd /opt
if [ -d "pos-aus-light" ]; then
  cd pos-aus-light && git pull
else
  git clone https://github.com/AVI-080602/POS-AUS-Light.git pos-aus-light
  cd pos-aus-light
fi

# Create backend .env
echo "Creating .env..."
cat > backend/.env <<'ENV'
# Application
NODE_ENV=production
PORT=4000
API_PREFIX=api/v1

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=pos_user
DB_PASSWORD=pos_password_prod_2024
DB_DATABASE=pos_aus_light

# JWT Authentication
JWT_SECRET=pos-aus-prod-xK9mP2vL8nQ5wR7tY3jF6hB4dA1cE0gI
JWT_EXPIRATION=8h

# Magento Integration
MAGENTO_BASE_URL=https://australianlightingandfans.com.au
MAGENTO_ADMIN_USERNAME=unmdev
MAGENTO_ADMIN_PASSWORD=DuL$unKih23
MAGENTO_TIMEOUT=30000

# Store Settings
STORE_NAME=Australian Lighting & Fans
TAX_RATE=0.10
ENV

# Install dependencies
echo "Installing backend dependencies..."
cd /opt/pos-aus-light/backend
npm ci --production=false

echo "Installing frontend dependencies..."
cd /opt/pos-aus-light/frontend
npm ci

# Build frontend
echo "Building frontend..."
npm run build

# Build backend
echo "Building backend..."
cd /opt/pos-aus-light/backend
npm run build

# Run database seeds
echo "Seeding database..."
npm run seed || echo "Seed may have already been run, continuing..."

# Start with PM2
echo "Starting app with PM2..."
cd /opt/pos-aus-light
pm2 delete pos-aus-light 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Configure nginx
echo "Configuring nginx..."
cat > /etc/nginx/sites-available/pos <<'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/pos /etc/nginx/sites-enabled/pos
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Open firewall
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable

echo ""
echo "========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "========================================="
echo "  POS URL: http://$(curl -s ifconfig.me)"
echo "========================================="
