#!/bin/bash

echo "🚀 Velocity Tech - Linux Deployment Script"
echo "==========================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Please don't run this script as root. Run as your regular user."
    exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
echo "🗄️  Installing PostgreSQL..."
sudo apt install postgresql postgresql-contrib -y

# Install PM2
echo "⚡ Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install nginx -y

# Create database
echo "🗄️  Setting up database..."
sudo -u postgres psql -c "CREATE DATABASE velocity_tech;"
sudo -u postgres psql -c "CREATE USER velocity_user WITH PASSWORD 'VelocityDB2025!';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE velocity_tech TO velocity_user;"

# Setup application directory
echo "📁 Setting up application directory..."
sudo mkdir -p /var/www/velocity-tech
sudo chown $USER:$USER /var/www/velocity-tech

# Copy files to production directory
echo "📋 Copying application files..."
cp -r * /var/www/velocity-tech/
cd /var/www/velocity-tech

# Install dependencies
echo "📦 Installing application dependencies..."
npm install --production

# Setup environment
echo "⚙️  Creating environment configuration..."
cp .env.example .env
sed -i "s/your_strong_password/VelocityDB2025!/g" .env
sed -i "s/your_super_secret_session_key_change_this_in_production/$(openssl rand -base64 32)/g" .env

# Setup database schema
echo "🗄️  Setting up database schema..."
npx drizzle-kit push

# Create logs directory
mkdir -p logs

# Start application with PM2
echo "🚀 Starting application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Setup Nginx configuration
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/velocity-tech > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    # Serve static files
    location /assets/ {
        root /var/www/velocity-tech/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Serve React app
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/velocity-tech /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Setup firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo "🌐 Your Velocity Tech platform is now running!"
echo "📍 Access it at: http://your-server-ip"
echo ""
echo "🔐 Admin Credentials:"
echo "   Username: admin"
echo "   Password: VelocityAdmin2025!"
echo ""
echo "👥 Recruiter Credentials:"
echo "   Username: recruiter"
echo "   Password: VelocityRecruit2025!"
echo ""
echo "📋 Management Commands:"
echo "   Check status: pm2 status"
echo "   View logs: pm2 logs velocity-tech"
echo "   Restart app: pm2 restart velocity-tech"
echo "   Check nginx: sudo systemctl status nginx"
echo ""
echo "🔒 To setup SSL certificate:"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d your-domain.com"