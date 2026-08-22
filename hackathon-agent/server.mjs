import {AdkApiServer} from '@google/adk-devtools';
import {fileURLToPath} from 'node:url';

const port = Number.parseInt(process.env.PORT || '8080', 10);
const sharedSecret = process.env.NOTEFLOW_AGENT_SHARED_SECRET?.trim();

if (!sharedSecret) {
  throw new Error('NOTEFLOW_AGENT_SHARED_SECRET is required.');
}

const server = new AdkApiServer({
  agentsDir: fileURLToPath(new URL('./agents', import.meta.url)),
  host: '0.0.0.0',
  port,
  serveDebugUI: false,
  logLevel: 'info',
});

server.app.use((request, response, next) => {
  if (request.method === 'GET' && (request.path === '/' || request.path === '/health')) {
    next();
    return;
  }

  if (request.headers.authorization !== `Bearer ${sharedSecret}`) {
    response.status(401).json({error: 'Unauthorized'});
    return;
  }

  next();
});

await server.start();
