#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function buildProduction() {
  console.log('🚀 Starting production build...');
  
  try {
    // Clean dist directory
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.mkdirSync('dist', { recursive: true });
    
    // Build client with Node.js compatibility
    console.log('📦 Building client...');
    await execAsync('NODE_OPTIONS="--openssl-legacy-provider" vite build --mode production');
    
    // Copy server files
    console.log('🔧 Preparing server files...');
    fs.mkdirSync('dist/server', { recursive: true });
    
    // Copy essential server files
    const serverFiles = [
      'server/index.ts',
      'server/auth.ts', 
      'server/routes.ts',
      'server/storage.ts',
      'server/vite.ts'
    ];
    
    serverFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const destPath = path.join('dist', file);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(file, destPath);
      }
    });
    
    // Copy shared directory
    if (fs.existsSync('shared')) {
      fs.cpSync('shared', 'dist/shared', { recursive: true });
    }
    
    // Create production package.json
    const prodPackageJson = {
      "name": "velocity-tech-production",
      "version": "1.0.0",
      "type": "module",
      "main": "server/index.js",
      "scripts": {
        "start": "node --loader tsx server/index.ts"
      },
      "dependencies": {
        "express": "^4.18.2",
        "express-session": "^1.17.3",
        "passport": "^0.7.0",
        "passport-local": "^1.0.0",
        "drizzle-orm": "^0.29.0",
        "tsx": "^4.7.0",
        "@neondatabase/serverless": "^0.10.4",
        "connect-pg-simple": "^9.0.1",
        "dotenv": "^16.3.1",
        "multer": "^1.4.5"
      }
    };
    
    fs.writeFileSync('dist/package.json', JSON.stringify(prodPackageJson, null, 2));
    
    // Copy environment template
    const envTemplate = `DATABASE_URL=postgresql://username:password@localhost:5432/velocity_tech
SESSION_SECRET=your_super_secret_session_key_change_this_in_production
NODE_ENV=production
PORT=5000
`;
    
    fs.writeFileSync('dist/.env.example', envTemplate);
    
    // Create startup script
    const startupScript = `#!/bin/bash
# Velocity Tech Production Startup Script

echo "🚀 Starting Velocity Tech..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Start the application
echo "🌟 Launching application..."
npm start
`;
    
    fs.writeFileSync('dist/start.sh', startupScript);
    fs.chmodSync('dist/start.sh', '755');
    
    // Create PM2 ecosystem file
    const pm2Config = `module.exports = {
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
};`;
    
    fs.writeFileSync('dist/ecosystem.config.js', pm2Config);
    
    console.log('✅ Production build complete!');
    console.log('📁 Build output: ./dist/');
    console.log('');
    console.log('📋 Next steps for Linux deployment:');
    console.log('1. Copy the dist/ folder to your Linux server');
    console.log('2. Run: cd dist && npm install --production');
    console.log('3. Configure your .env file');
    console.log('4. Run: chmod +x start.sh && ./start.sh');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

buildProduction();