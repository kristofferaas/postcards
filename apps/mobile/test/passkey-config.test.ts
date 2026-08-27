import type { ExpoConfig } from 'expo/config';
import { afterEach, describe, expect, it } from 'vitest';

import mobilePackage from '../package.json';
import configureApp from '../app.config';
import {
  developmentPasskeyRelyingPartyIds,
  developmentWorkerApiUrl,
} from '../src/api/passkey-environments';

const originalEnvironment = { ...process.env };
const baseConfig: ExpoConfig = {
  name: 'Post Cards',
  slug: 'post-cards',
};

const configure = () => configureApp({ config: baseConfig } as never);

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe('passkey native configuration', () => {
  it('entitles development clients for localhost and the stable Worker', () => {
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.POSTCARDS_NATIVE_BUILD_PROFILE;
    delete process.env.EXPO_PUBLIC_API_URL;

    expect(configure().ios?.associatedDomains).toEqual([
      'webcredentials:localhost?mode=developer',
      `webcredentials:${new URL(developmentWorkerApiUrl).hostname}`,
    ]);
  });

  it('uses one production domain in fingerprint and update jobs', () => {
    delete process.env.EAS_BUILD_PROFILE;
    process.env.POSTCARDS_NATIVE_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://postcards.example.com';

    expect(configure().ios?.associatedDomains).toEqual([
      'webcredentials:postcards.example.com',
    ]);
  });

  it('rejects a production config without an HTTPS API URL', () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    delete process.env.POSTCARDS_NATIVE_BUILD_PROFILE;
    delete process.env.EXPO_PUBLIC_API_URL;

    expect(configure).toThrow('EXPO_PUBLIC_API_URL is required');

    process.env.EXPO_PUBLIC_API_URL = 'http://postcards.example.com';
    expect(configure).toThrow('EXPO_PUBLIC_API_URL must use HTTPS');
  });

  it('keeps the development Worker in the entitlement allowlist', () => {
    expect(developmentPasskeyRelyingPartyIds).toContain(
      new URL(developmentWorkerApiUrl).hostname,
    );
    expect(JSON.stringify(mobilePackage.scripts)).not.toContain('.workers.dev');
    expect(mobilePackage.scripts['dev:worker']).toContain(
      'run-with-development-worker.cjs',
    );
    expect(mobilePackage.scripts['test:ios:passkey:worker']).toContain(
      'run-with-development-worker.cjs',
    );
  });
});
