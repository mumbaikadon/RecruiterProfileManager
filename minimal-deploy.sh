#!/bin/bash

echo "🚀 Velocity Tech - Minimal Deployment"
echo "====================================="

# Install only Node.js and Nginx
echo "Installing Node.js and Nginx..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# Install application dependencies
echo "Installing application dependencies..."
npm install

# Start application with PM2
echo "Starting application..."
pm2 start server/index.ts --name velocity-tech --interpreter="node" --interpreter-args="--loader tsx"
pm2 save

# Configure Nginx reverse proxy
echo "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/velocity-tech > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/velocity-tech /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo ""
echo "✅ Deployment Complete!"
echo "Access: http://your-server-ip"