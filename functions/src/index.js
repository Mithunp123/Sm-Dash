import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import app from './app.js';

setGlobalOptions({
  region: 'asia-south1',
  maxInstances: 10,
  memory: '512MiB',
});

export const api = onRequest({ cors: true }, app);

