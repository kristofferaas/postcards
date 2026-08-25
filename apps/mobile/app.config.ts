import type { ConfigContext, ExpoConfig } from 'expo/config';

const APPLE_TEAM_ID = '8ZJAHCVAGF';

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
  return {
    ...config,
    name: config.name ?? 'Post Cards',
    slug: config.slug ?? 'post-cards',
    ios: {
      ...config.ios,
      associatedDomains: [associatedDomain],
      appleTeamId: APPLE_TEAM_ID,
    },
  };
};
