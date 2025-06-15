#!/bin/bash

echo "🚀 Velocity Tech - Direct Port Deployment"
echo "========================================="

# Install Node.js if needed
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install application dependencies
echo "Installing dependencies..."
npm install

# Update port in your .env to 3000
echo "Configuring port 3000..."
sed -i 's/PORT=5000/PORT=3000/g' .env

# Start application with PM2 on port 3000
echo "Starting application on port 3000..."
pm2 start server/index.ts --name velocity-tech --interpreter="node" --interpreter-args="--loader tsx"
pm2 save

# Open firewall for port 3000
echo "Opening firewall for port 3000..."
sudo ufw allow 3000

echo ""
echo "✅ Deployment Complete!"
echo "Access: http://your-server-ip:3000"
echo "Admin: admin / VelocityAdmin2025!"
echo "Recruiter: recruiter / VelocityRecruit2025!"