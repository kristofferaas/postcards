import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { expoPasskeyClient } from 'expo-better-auth-passkey';
import * as SecureStore from 'expo-secure-store';

import { apiUrl } from './config';

const authStoragePrefix = 'postcards-passkey-v1';
const authCookieStorageKey = `${authStoragePrefix}_cookie`;

if (SecureStore.getItem(authCookieStorageKey) === null) {
  SecureStore.setItem(authCookieStorageKey, '{}');
}

export const authClient = createAuthClient({
  baseURL: apiUrl,
  plugins: [
    expoClient({
      scheme: 'post-cards',
      storage: SecureStore,
      storagePrefix: authStoragePrefix,
      cookiePrefix: 'better-auth',
    }),
    expoPasskeyClient(),
  ],
});

const errorMessage = (error: { message?: string } | null) =>
  error?.message ?? 'Authentication could not be completed.';

const accountCreationAvailableErrorCodes = new Set([
  'AUTH_CANCELLED',
  'PASSKEY_NOT_FOUND',
]);

export class PasskeyAccountCreationAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasskeyAccountCreationAvailableError';
  }
}

export const signInWithPasskey = async () => {
  const result = await authClient.signIn.passkey();
  if (result.error) {
    const code = 'code' in result.error ? result.error.code : undefined;
    if (accountCreationAvailableErrorCodes.has(code ?? '')) {
      throw new PasskeyAccountCreationAvailableError(errorMessage(result.error));
    }
    throw new Error(errorMessage(result.error));
  }
};

export const createAccountWithPasskey = async (name: string) => {
  const start = await authClient.$fetch<{ context: string }>(
    '/passkey-registration/start',
    {
      method: 'POST',
      body: { name: name.trim() },
    },
  );

  if (start.error || !start.data) {
    throw new Error(errorMessage(start.error));
  }

  const result = await authClient.passkey.addPasskey({
    context: start.data.context,
    name: 'Primary passkey',
  });

  if (result.error) {
    throw new Error(errorMessage(result.error));
  }

  const completion = await authClient.$fetch<{ userId: string }>(
    '/passkey-registration/complete',
    { method: 'POST', body: {} },
  );

  if (completion.error || !completion.data) {
    throw new Error(errorMessage(completion.error));
  }
};
