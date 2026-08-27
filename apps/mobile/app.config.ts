import type { ConfigContext, ExpoConfig } from 'expo/config';

import {
  developmentPasskeyRelyingPartyIds,
  passkeyAssociatedDomain,
} from './src/api/passkey-environments.ts';

const APPLE_TEAM_ID = '8ZJAHCVAGF';

export default ({ config }: ConfigContext): ExpoConfig => {
  const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const nativeBuildProfile =
    process.env.POSTCARDS_NATIVE_BUILD_PROFILE ??
    process.env.EAS_BUILD_PROFILE ??
    'development';
  const isSwitchableDevelopmentBuild = nativeBuildProfile === 'development';

  if (
    nativeBuildProfile !== 'development' &&
    nativeBuildProfile !== 'preview' &&
    nativeBuildProfile !== 'production'
  ) {
    throw new Error(
      `Unsupported native build profile "${nativeBuildProfile}".`,
    );
  }

  if (!isSwitchableDevelopmentBuild && !configuredApiUrl) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is required for ${nativeBuildProfile} builds.`,
    );
  }

  const apiUrl = new URL(configuredApiUrl ?? 'http://localhost:3000');
  const relyingPartyId = apiUrl.hostname;

  if (!isSwitchableDevelopmentBuild && apiUrl.protocol !== 'https:') {
    throw new Error(
      `EXPO_PUBLIC_API_URL must use HTTPS for ${nativeBuildProfile} builds.`,
    );
  }

  if (
    isSwitchableDevelopmentBuild &&
    !developmentPasskeyRelyingPartyIds.some(
      (developmentId) => developmentId === relyingPartyId,
    )
  ) {
    throw new Error(
      `The development client does not support passkeys for "${relyingPartyId}". ` +
        'Add the host to developmentPasskeyRelyingPartyIds before rebuilding.',
    );
  }

  const relyingPartyIds = isSwitchableDevelopmentBuild
    ? developmentPasskeyRelyingPartyIds
    : [relyingPartyId];
  return {
    ...config,
    name: config.name ?? 'Post Cards',
    slug: config.slug ?? 'post-cards',
    ios: {
      ...config.ios,
      associatedDomains: relyingPartyIds.map(passkeyAssociatedDomain),
      appleTeamId: APPLE_TEAM_ID,
    },
  };
};
