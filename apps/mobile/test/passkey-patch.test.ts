import { atom } from 'nanostores';
import { describe, expect, it, vi } from 'vitest';

const nativePasskey = vi.hoisted(() => ({
  authenticatePasskey: vi.fn(),
  registerPasskey: vi.fn(),
}));

vi.mock('expo', () => ({
  requireNativeModule: () => nativePasskey,
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { getPasskeyActionsNative } from '../../../node_modules/expo-better-auth-passkey/build/plugin.js';

const makeActions = (fetch: ReturnType<typeof vi.fn>) =>
  getPasskeyActionsNative(fetch as never, {
    $listPasskeys: atom(0),
    $store: { notify: vi.fn() } as never,
  });

describe('patched native passkey client', () => {
  it('preserves native cancellation and failure codes', async () => {
    const cancelledFetch = vi.fn().mockResolvedValueOnce({
      data: { challenge: 'challenge', rpId: 'example.com' },
      error: null,
    });
    nativePasskey.authenticatePasskey.mockRejectedValueOnce(
      Object.assign(new Error('Authentication was cancelled'), {
        code: 'AUTH_CANCELLED',
      }),
    );

    await expect(
      makeActions(cancelledFetch).signIn.passkey(),
    ).resolves.toMatchObject({
      error: { code: 'AUTH_CANCELLED', status: 400 },
    });

    const failedFetch = vi.fn().mockResolvedValueOnce({
      data: { challenge: 'challenge', rpId: 'example.com' },
      error: null,
    });
    nativePasskey.authenticatePasskey.mockRejectedValueOnce(
      Object.assign(new Error('No matching passkey'), {
        code: 'PASSKEY_AUTHENTICATION_FAILED',
      }),
    );

    await expect(
      makeActions(failedFetch).signIn.passkey(),
    ).resolves.toMatchObject({
      error: { code: 'PASSKEY_AUTHENTICATION_FAILED', status: 500 },
    });
  });

  it('forwards registration context to the server options request', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        data: { challenge: 'challenge', rp: { id: 'example.com' } },
        error: null,
      })
      .mockResolvedValueOnce({ data: { passkey: { id: 'passkey' } }, error: null });
    nativePasskey.registerPasskey.mockResolvedValueOnce({ id: 'credential' });

    await makeActions(fetch).passkey.addPasskey({
      context: 'registration-context',
      name: 'Primary passkey',
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/passkey/generate-register-options',
      expect.objectContaining({
        query: expect.objectContaining({ context: 'registration-context' }),
      }),
    );
  });
});
