const { spawnSync } = require('node:child_process');

const { developmentWorkerApiUrl } = require('../src/api/passkey-environments.json');

const [command, ...args] = process.argv.slice(2);

if (!command) {
  throw new Error('A command is required.');
}

const result = spawnSync(command, args, {
  env: {
    ...process.env,
    EXPO_PUBLIC_API_URL: developmentWorkerApiUrl,
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
