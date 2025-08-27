/**
 * Simple migration script to run Phase 3
 */

import http from 'http';

async function runMigration() {
  console.log('🚀 Running Phase 3 Migration via API...');
  
  const postData = JSON.stringify({
    action: 'migrate-all'
  });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/profile-resumes/migrate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
      'Cookie': 'connect.sid=s%3AJdJk6x5uE8LGKV2G8zZnH1FVJ5qXh2WD.kqcjUaU8%2FMTwh0S76nDEGvHdJJgFGUu7s2rUGJGrmjw'
    }
  };
  
  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log('Migration result:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('Error:', error);
  });
  
  req.write(postData);
  req.end();
}

runMigration();