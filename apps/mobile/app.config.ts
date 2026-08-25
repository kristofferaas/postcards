import type { ConfigContext, ExpoConfig } from 'expo/config';

const DEVELOPMENT_APPLE_TEAM_ID = 'FAKETEAMID';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = new URL(
    process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  );
  const relyingPartyId =
    process.env.EXPO_PUBLIC_PASSKEY_RP_ID?.trim() || apiUrl.hostname;
  const associatedDomain =
    relyingPartyId === 'localhost'
      ? 'webcredentials:localhost?mode=developer'
      : `webcredentials:${relyingPartyId}`;
  const configuredAppleTeamId = process.env.APPLE_TEAM_ID?.trim();

  if (process.env.EAS_BUILD_PROFILE === 'production' && !configuredAppleTeamId) {
    throw new Error('APPLE_TEAM_ID is required for production builds.');
  }

  const appleTeamId = configuredAppleTeamId || DEVELOPMENT_APPLE_TEAM_ID;

  return {
    ...config,
    name: config.name ?? 'Post Cards',
    slug: config.slug ?? 'post-cards',
    ios: {
      ...config.ios,
      associatedDomains: [associatedDomain],
      appleTeamId,
    },
  };
};
