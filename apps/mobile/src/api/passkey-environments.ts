import passkeyEnvironments from './passkey-environments.json';

export const developmentWorkerApiUrl =
  passkeyEnvironments.developmentWorkerApiUrl;

export const developmentPasskeyRelyingPartyIds = [
  'localhost',
  new URL(developmentWorkerApiUrl).hostname,
] as const;

export const passkeyAssociatedDomain = (relyingPartyId: string) =>
  relyingPartyId === 'localhost'
    ? 'webcredentials:localhost?mode=developer'
    : `webcredentials:${relyingPartyId}`;
