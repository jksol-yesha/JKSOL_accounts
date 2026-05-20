const http = require('http');

async function test() {
    console.log("Starting test...");
    // 1. We don't have user credentials, so let's just make a dummy request to see the error
    const data = JSON.stringify({ refreshToken: "dummy" });

    const req = http.request('http://localhost:8100/api/auth/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log("Status:", res.statusCode);
            console.log("Body:", body);
        });
    });

    req.on('error', e => console.error(e));
    req.write(data);
    req.end();
}
test();
