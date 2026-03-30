import { createApp } from './app';

const app = createApp();

app.listen({
    port: 3000,
    hostname: '0.0.0.0'
});

import { env } from './config/env';

console.log(`🚀 API running at ${env.BASE_URL}/api`);
console.log(`🌍 Env Config - FRONTEND_URL: ${env.FRONTEND_URL}`);
console.log(`🔍 Process Env - FRONTEND_URL: ${process.env.FRONTEND_URL}`);
console.log(`🐰 Bun Env - FRONTEND_URL: ${Bun.env.FRONTEND_URL}`);
console.log('Registered Routes:');
app.routes.forEach(route => console.log(`${route.method} ${route.path}`));
