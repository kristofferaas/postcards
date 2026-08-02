import { Platform } from 'react-native';

export type Postcard = {
  readonly id: number;
  readonly sentAt: string | null;
  readonly openedAt: string | null;
  readonly frontImage: string;
};

export type CreatePostcardInput = Omit<Postcard, 'id' | 'sentAt' | 'openedAt'>;

const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;

const isNullableString = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null;

const isPostcard = (value: unknown): value is Postcard => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const postcard = value as Record<string, unknown>;

  return (
    typeof postcard.id === 'number' &&
    isNullableString(postcard.sentAt) &&
    isNullableString(postcard.openedAt) &&
    typeof postcard.frontImage === 'string'
  );
};

export async function getPostcards(signal?: AbortSignal): Promise<readonly Postcard[]> {
  const response = await fetch(`${apiUrl}/postcards`, { signal });

  if (!response.ok) {
    throw new Error(`The server responded with ${response.status}.`);
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || !data.every(isPostcard)) {
    throw new Error('The server returned an invalid postcard list.');
  }

  return data;
}

export async function createPostcard(input: CreatePostcardInput): Promise<Postcard> {
  const response = await fetch(`${apiUrl}/postcards`, {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`The server responded with ${response.status}.`);
  }

  const data: unknown = await response.json();

  if (!isPostcard(data)) {
    throw new Error('The server returned an invalid postcard.');
  }

  return data;
}
