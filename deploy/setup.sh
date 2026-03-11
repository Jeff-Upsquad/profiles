#!/bin/bash
# ============================================
# Profiles Platform — VPS Setup Script
# Run this once on a fresh Hostinger VPS
# ============================================

set -e

echo "=== Updating system ==="
sudo apt update && sudo apt upgrade -y

echo "=== Installing Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "=== Installing MongoDB ==="
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

echo "=== Installing Nginx ==="
sudo apt install -y nginx
sudo systemctl enable nginx

echo "=== Installing PM2 ==="
sudo npm install -g pm2

echo "=== Creating project directory ==="
sudo mkdir -p /var/www/profiles
sudo chown -R $USER:$USER /var/www/profiles

echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Clone your repo: cd /var/www/profiles && git clone YOUR_REPO_URL ."
echo "2. Install dependencies: cd backend && npm install"
echo "3. Create .env file: cp .env.example .env && nano .env"
echo "4. Build frontend: cd ../frontend && npm install && npm run build"
echo "5. Build admin: cd ../admin && npm install && npm run build"
echo "6. Seed database: cd ../backend && npm run seed"
echo "7. Start backend: pm2 start src/app.js --name profiles-api"
echo "8. Copy nginx config: sudo cp deploy/nginx.conf /etc/nginx/sites-available/profiles"
echo "9. Enable site: sudo ln -s /etc/nginx/sites-available/profiles /etc/nginx/sites-enabled/"
echo "10. Remove default: sudo rm /etc/nginx/sites-enabled/default"
echo "11. Test & restart nginx: sudo nginx -t && sudo systemctl restart nginx"
echo "12. Save PM2: pm2 save && pm2 startup"
