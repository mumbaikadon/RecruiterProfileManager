module.exports = {
  apps: [{
    name: 'recruiter-app',
    script: 'dist/index.js',
    cwd: '/home/opc/RecruiterProfileManager',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    node_args: '--require ./crypto-polyfill.cjs',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};