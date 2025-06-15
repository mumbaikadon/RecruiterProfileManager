#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to handle errors
handle_error() {
  echo "❌ ERROR: Command failed at line $1"
  exit 1
}

# Set up error trap
trap 'handle_error $LINENO' ERR

echo "🚀 Velocity Tech - Oracle Linux Deployment"
echo "=========================================="

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2 || { echo "❌ Failed to install PM2"; exit 1; }
    echo "✅ PM2 installed successfully"
fi

# Install application dependencies
echo "Installing application dependencies..."
npm install || { echo "❌ Failed to install application dependencies"; exit 1; }
echo "✅ Dependencies installed successfully"

# Fix for crypto.getRandomValues in Vite
echo "Setting up environment for build..."
export NODE_OPTIONS="--openssl-legacy-provider"

# Build the client and server separately
echo "Building client application..."
cd client
echo "Installing client dependencies..."
npm install || { echo "❌ Failed to install client dependencies"; exit 1; }

echo "Building client..."
NODE_OPTIONS="--openssl-legacy-provider" npm run build || { echo "❌ Failed to build client"; exit 1; }
echo "✅ Client build successful"
cd ..

# Build the server
echo "Building server..."
NODE_OPTIONS="--openssl-legacy-provider" npx esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist || { echo "❌ Failed to build server"; exit 1; }
echo "✅ Server build successful"

# Configure environment
echo "Configuring environment..."
if [ ! -f .env ]; then
    echo "Creating .env file..."
    # Generate secure random secrets
    SESSION_SECRET=$(openssl rand -hex 32 || echo "velocity_secure_session_key_$(date +%s)")
    JWT_SECRET=$(openssl rand -hex 32 || echo "velocity_secure_jwt_key_$(date +%s)")
    
    cat > .env << EOF || { echo "❌ Failed to create .env file"; exit 1; }
# Environment
NODE_ENV=production

# Server Configuration
PORT=3000
HOST=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://recruiter_admin:your_secure_password@localhost:5432/recruiter_db

# Authentication
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}

# Security
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

# Other Settings
UPLOAD_DIR=/var/www/recruiter/uploads
LOG_LEVEL=error
EOF
    echo "✅ Created .env file with secure random secrets"
else
    echo "✅ Using existing .env file"
fi

# Create uploads directory if needed
echo "Creating uploads directory..."
sudo mkdir -p /var/www/recruiter/uploads || { echo "❌ Failed to create uploads directory"; exit 1; }
sudo chmod 755 /var/www/recruiter/uploads || { echo "❌ Failed to set permissions on uploads directory"; exit 1; }
echo "✅ Uploads directory configured"

# Configure firewall for port 3000
echo "Configuring firewall..."
# Check if firewall-cmd exists
if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=3000/tcp || echo "⚠ Warning: Failed to add port to firewall"
    sudo firewall-cmd --reload || echo "⚠ Warning: Failed to reload firewall"
    echo "✅ Firewall configured"
else
    echo "⚠ Warning: firewall-cmd not found. Please manually open port 3000 in your firewall"
fi

# Start application with PM2
echo "Starting application..."
pm2 start dist/index.js --name recruiter-app || { echo "❌ Failed to start application with PM2"; exit 1; }
echo "✅ Application started successfully"

echo "Saving PM2 configuration..."
pm2 save || { echo "❌ Failed to save PM2 configuration"; exit 1; }

echo "Setting up PM2 startup script..."
pm2 startup || { echo "❌ Failed to setup PM2 startup script. You may need to run it manually."; }

# Verify deployment
echo "Verifying deployment..."
sleep 3

# Check if the application is running
if pm2 list | grep -q "recruiter-app.*online"; then
    echo ""
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo "Access: http://$(hostname -I | awk '{print $1}'):3000"
    echo "Admin: admin / VelocityAdmin2025!"
    echo "Recruiter: recruiter / VelocityRecruit2025!"
    echo ""
    echo "To monitor the application:"
    echo "  pm2 monit"
    echo "To view logs:"
    echo "  pm2 logs recruiter-app"
    echo "To restart the application:"
    echo "  pm2 restart recruiter-app"
else
    echo ""
    echo "❌ DEPLOYMENT INCOMPLETE: Application is not running"
    echo "Check the logs with: pm2 logs recruiter-app"
    exit 1
fi
