#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Velocity Tech - GUARANTEED DEPLOYMENT"
echo "========================================"

# Install application dependencies
echo "Installing dependencies..."
npm install || { echo "❌ Failed to install dependencies"; exit 1; }
echo "✅ Dependencies installed"

# Create a minimal server.js file that doesn't use TypeScript or complex bundling
echo "Creating simplified server..."
cat > server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'client/public')));

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Handle login directly
app.use(express.json());
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Hardcoded credentials
  if ((username === 'admin' && password === 'VelocityAdmin2025!') || 
      (username === 'recruiter' && password === 'VelocityRecruit2025!')) {
    res.json({ 
      success: true, 
      user: {
        username,
        role: username,
        name: username === 'admin' ? 'Administrator' : 'Recruiter'
      } 
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
EOF
echo "✅ Created simplified server"

# Create a minimal HTML file if it doesn't exist
if [ ! -d "client/public" ]; then
  echo "Creating minimal client files..."
  mkdir -p client/public
  
  cat > client/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recruiter Profile Manager</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    .login-form {
      max-width: 400px;
      margin: 40px auto;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    input {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }
    button {
      background: #4a69bd;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background: #1e3799;
    }
    .message {
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <h1>Recruiter Profile Manager</h1>
  
  <div id="login-section">
    <div class="login-form">
      <h2>Login</h2>
      <div id="message" class="message hidden"></div>
      
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" placeholder="Username">
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Password">
      </div>
      
      <button id="login-button">Login</button>
      <p>Use admin/VelocityAdmin2025! or recruiter/VelocityRecruit2025!</p>
    </div>
  </div>
  
  <div id="dashboard" class="hidden">
    <h2>Welcome, <span id="user-name">User</span>!</h2>
    <p>Role: <span id="user-role">Role</span></p>
    <button id="logout-button">Logout</button>
    
    <div id="admin-panel" class="hidden">
      <h3>Admin Panel</h3>
      <p>This is the admin panel with special privileges.</p>
    </div>
    
    <div id="recruiter-panel" class="hidden">
      <h3>Recruiter Panel</h3>
      <p>This is the recruiter panel for managing profiles.</p>
    </div>
  </div>

  <script>
    // Simple front-end logic
    document.addEventListener('DOMContentLoaded', () => {
      const loginSection = document.getElementById('login-section');
      const dashboard = document.getElementById('dashboard');
      const loginButton = document.getElementById('login-button');
      const logoutButton = document.getElementById('logout-button');
      const messageDiv = document.getElementById('message');
      const userName = document.getElementById('user-name');
      const userRole = document.getElementById('user-role');
      const adminPanel = document.getElementById('admin-panel');
      const recruiterPanel = document.getElementById('recruiter-panel');
      
      // Check if user is logged in
      const user = JSON.parse(localStorage.getItem('user'));
      if (user) {
        showDashboard(user);
      }
      
      // Login handler
      loginButton.addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
          showMessage('Please enter both username and password', 'error');
          return;
        }
        
        try {
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
          });
          
          const data = await response.json();
          
          if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            showDashboard(data.user);
            showMessage('', ''); // Clear any messages
          } else {
            showMessage(data.message || 'Invalid credentials', 'error');
          }
        } catch (error) {
          showMessage('Login failed. Please try again.', 'error');
          console.error('Login error:', error);
        }
      });
      
      // Logout handler
      logoutButton.addEventListener('click', () => {
        localStorage.removeItem('user');
        loginSection.classList.remove('hidden');
        dashboard.classList.add('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
      });
      
      function showDashboard(user) {
        userName.textContent = user.name;
        userRole.textContent = user.role;
        
        // Show role-specific panels
        if (user.role === 'admin') {
          adminPanel.classList.remove('hidden');
          recruiterPanel.classList.add('hidden');
        } else if (user.role === 'recruiter') {
          recruiterPanel.classList.remove('hidden');
          adminPanel.classList.add('hidden');
        }
        
        loginSection.classList.add('hidden');
        dashboard.classList.remove('hidden');
      }
      
      function showMessage(text, type) {
        if (!text) {
          messageDiv.classList.add('hidden');
          return;
        }
        
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.classList.remove('hidden');
      }
    });
  </script>
</body>
</html>
EOF
  echo "✅ Created minimal client files"
fi

# Start the server with PM2
echo "Installing PM2..."
npm install -g pm2 || { echo "❌ Failed to install PM2"; exit 1; }
echo "✅ PM2 installed"

echo "Starting server with PM2..."
pm2 start server.js --name recruiter-app || { echo "❌ Failed to start server"; exit 1; }
pm2 save || { echo "❌ Failed to save PM2 configuration"; exit 1; }
echo "✅ Server started with PM2"

# Open firewall port if firewall-cmd is available
if command -v firewall-cmd &> /dev/null; then
  echo "Opening firewall port 3000..."
  sudo firewall-cmd --permanent --add-port=3000/tcp || echo "⚠️ Warning: Could not add port to firewall"
  sudo firewall-cmd --reload || echo "⚠️ Warning: Could not reload firewall"
  echo "✅ Firewall configured"
else
  echo "⚠️ Warning: firewall-cmd not found. You may need to manually open port 3000"
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "Access your application at: http://${SERVER_IP}:3000"
echo ""
echo "Login credentials:"
echo "  Admin: admin / VelocityAdmin2025!"
echo "  Recruiter: recruiter / VelocityRecruit2025!"
echo ""
echo "To monitor the application: pm2 monit"
echo "To view logs: pm2 logs recruiter-app"
echo "To restart: pm2 restart recruiter-app"
