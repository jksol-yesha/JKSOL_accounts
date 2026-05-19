import './config/load-env';

const { createApp } = await import('./app');

const app = createApp();

app.listen({
    port: Number(process.env.PORT) || 8100,
    hostname: '0.0.0.0'
});
