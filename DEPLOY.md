# Linux Production Deployment Instructions

## Quick Deploy (Recommended)

```bash
# 1. Install dependencies
npm install

# 2. Build with crypto polyfill
node build-prod.js

# 3. Start production server
node start-prod.js
```

## Alternative Commands (If Quick Deploy Fails)

### Option A: Manual Build with Crypto Polyfill
```bash
export NODE_ENV=production
NODE_OPTIONS="--require ./crypto-polyfill.cjs" npm run build
node --require ./crypto-polyfill.cjs dist/index.js
```

### Option B: Direct Build Commands
```bash
# Build frontend with forced crypto polyfill
NODE_OPTIONS="--require ./crypto-polyfill.cjs" npx vite build

# Build server
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Start with crypto polyfill
node --require ./crypto-polyfill.cjs dist/index.js
```

### Option C: Using PM2 Process Manager
```bash
# Build first
node build-prod.js

# Install PM2 if not installed
npm install -g pm2

# Start with PM2
pm2 start start-prod.js --name "recruiter-app"

# Monitor
pm2 logs recruiter-app
pm2 monit
```

## Environment Variables Required
```bash
export NODE_ENV=production
export DATABASE_URL="your_database_url"
export OPENAI_API_KEY="your_openai_key"
# Add other environment variables as needed
```

## Troubleshooting

If you still get crypto errors:
1. Ensure Node.js version is 16+ 
2. Try: `node --version`
3. Use the crypto-polyfill.cjs version which forces CommonJS compatibility

The crypto-polyfill.cjs file specifically addresses Linux production crypto issues that don't occur on Windows.