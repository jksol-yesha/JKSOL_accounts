const http = require('http');

http.get('http://localhost:8100/api/uploads/transactions/0c49a41e-9da7-44b0-b4d9-3580887b357c-bank%20statement.pdf', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {});
}).on('error', (err) => {
  console.error('Error:', err.message);
});
