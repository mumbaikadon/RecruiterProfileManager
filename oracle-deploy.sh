#!/bin/bash

echo "🚀 Velocity Tech - Oracle Linux Deployment"
echo "=========================================="

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install application dependencies
echo "Installing application dependencies..."
npm install

# Fix for crypto.getRandomValues in Vite
echo "Setting up environment for build..."
export NODE_OPTIONS="--max-old-space-size=4096 --openssl-legacy-provider"

# Build the client
echo "Building client application..."
cd client
npm install
npm run build
cd ..

# Configure environment
echo "Configuring environment..."
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Environment
NODE_ENV=production

# Server Configuration
PORT=3000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://recruiter_admin:your_secure_password@localhost:5432/recruiter_db

# Authentication
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# Security
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

# Other Settings
UPLOAD_DIR=/var/www/recruiter/uploads
LOG_LEVEL=error
EOF
    echo "Created .env file with secure random secrets"
fi

# Create uploads directory if needed
sudo mkdir -p /var/www/recruiter/uploads
sudo chmod 755 /var/www/recruiter/uploads

# Configure firewall for port 3000
echo "Configuring firewall..."
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# Start application with PM2
echo "Starting application..."
pm2 start server/index.ts --name recruiter-app --interpreter="node" --interpreter-args="--loader tsx"
pm2 save
pm2 startup

echo ""
echo "✅ Deployment Complete!"
echo "Access: http://your-server-ip:3000"
echo "Admin: admin / VelocityAdmin2025!"
echo "Recruiter: recruiter / VelocityRecruit2025!"
echo ""
echo "To monitor the application:"
echo "  pm2 monit"
echo "To view logs:"
echo "  pm2 logs recruiter-app"
