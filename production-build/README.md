# Velocity Tech - Linux Deployment Guide

This package contains everything needed to deploy the Velocity Tech recruitment platform on a Linux server.

## Quick Deployment

1. **Upload this folder to your Linux server**
2. **Run the automated deployment script:**
   ```bash
   chmod +x deploy-linux.sh
   ./deploy-linux.sh
   ```

## Manual Deployment Steps

If you prefer manual installation:

### 1. System Prerequisites
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install PM2 and Nginx
sudo npm install -g pm2
sudo apt install nginx -y
```

### 2. Database Setup
```bash
sudo -u postgres psql
CREATE DATABASE velocity_tech;
CREATE USER velocity_user WITH PASSWORD 'VelocityDB2025!';
GRANT ALL PRIVILEGES ON DATABASE velocity_tech TO velocity_user;
\q
```

### 3. Application Setup
```bash
# Copy files to web directory
sudo mkdir -p /var/www/velocity-tech
sudo chown $USER:$USER /var/www/velocity-tech
cp -r * /var/www/velocity-tech/
cd /var/www/velocity-tech

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Setup database
npx drizzle-kit push

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Nginx Configuration
```bash
# Copy the nginx config from deploy-linux.sh
# Enable and restart nginx
sudo systemctl restart nginx
```

## Access Information

**Application URL:** http://your-server-ip

**Admin Login:**
- Username: `admin`
- Password: `VelocityAdmin2025!`

**Recruiter Login:**
- Username: `recruiter`
- Password: `VelocityRecruit2025!`

## Management Commands

```bash
# Check application status
pm2 status
pm2 logs velocity-tech

# Restart application
pm2 restart velocity-tech

# Check nginx
sudo systemctl status nginx

# View database
psql -h localhost -U velocity_user -d velocity_tech
```

## File Structure

```
production-build/
├── server/           # Backend application
├── client/           # Frontend React app
├── shared/           # Shared types and schemas
├── package.json      # Production dependencies
├── ecosystem.config.js # PM2 configuration
├── drizzle.config.ts # Database configuration
├── .env.example      # Environment template
├── deploy-linux.sh   # Automated deployment
└── README.md         # This file
```

## Security Notes

- Change default passwords after first login
- Setup SSL certificate for production use
- Configure firewall rules
- Regular database backups recommended

## Troubleshooting

**Application won't start:**
- Check PM2 logs: `pm2 logs velocity-tech`
- Verify database connection in .env file
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`

**Cannot access from browser:**
- Check nginx status: `sudo systemctl status nginx`
- Verify firewall: `sudo ufw status`
- Check if port 5000 is accessible: `netstat -tlnp | grep 5000`

**Database connection issues:**
- Test connection: `psql -h localhost -U velocity_user -d velocity_tech`
- Check PostgreSQL logs: `sudo journalctl -u postgresql`