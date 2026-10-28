import SmeeClient from 'smee-client';

const source = process.env.SMEE_URL;
const port = process.env.PORT ?? '3000';

if (!source) {
  console.warn('[smee] SMEE_URL not set, webhook forwarding disabled');
  process.exit(0);
}

const smee = new SmeeClient({
  source,
  target: `http://localhost:${port}/api/webhooks/github`,
  logger: console,
});

smee.start();
