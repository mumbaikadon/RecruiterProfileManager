#!/bin/bash

echo "🚀 Velocity Tech - Direct Deployment Script"
echo "==========================================="

# Install system dependencies
echo "Installing system dependencies..."
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib nginx
sudo npm install -g pm2

# Setup database
echo "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE velocity_tech;"
sudo -u postgres psql -c "CREATE USER velocity_user WITH PASSWORD 'VelocityDB2025!';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE velocity_tech TO velocity_user;"

# Install application dependencies
echo "Installing application dependencies..."
npm install --production

# Setup environment for production
echo "Configuring environment..."
cat > .env << EOF
DATABASE_URL=postgresql://velocity_user:VelocityDB2025!@localhost:5432/velocity_tech
SESSION_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
PORT=5000
EOF

# Setup database schema
echo "Setting up database schema..."
npm run db:push

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'velocity-tech',
    script: 'server/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader tsx',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start application
echo "Starting Velocity Tech application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure Nginx
echo "Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/velocity-tech > /dev/null << EOF
server {
    listen 80;
    server_name _;

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

sudo ln -sf /etc/nginx/sites-available/velocity-tech /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Setup firewall
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443
sudo ufw --force enable

echo ""
echo "✅ Deployment Complete!"
echo "Access: http://your-server-ip"
echo "Admin: admin / VelocityAdmin2025!"
echo "Recruiter: recruiter / VelocityRecruit2025!"
echo ""
echo "Management:"
echo "- Status: pm2 status"
echo "- Logs: pm2 logs velocity-tech"
echo "- Restart: pm2 restart velocity-tech"