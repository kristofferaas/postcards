import { Platform } from 'react-native';

export type Postcard = {
  readonly id: number;
  readonly to: string;
  readonly from: string;
  readonly sentAt: string | null;
  readonly openedAt: string | null;
  readonly content: string;
  readonly frontImage: string;
  readonly caption: string;
  readonly captionStyle: string;
  readonly accentColor: string;
  readonly stamp: string;
  readonly stickers: readonly string[];
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
    typeof postcard.to === 'string' &&
    typeof postcard.from === 'string' &&
    isNullableString(postcard.sentAt) &&
    isNullableString(postcard.openedAt) &&
    typeof postcard.content === 'string' &&
    typeof postcard.frontImage === 'string' &&
    typeof postcard.caption === 'string' &&
    typeof postcard.captionStyle === 'string' &&
    typeof postcard.accentColor === 'string' &&
    typeof postcard.stamp === 'string' &&
    Array.isArray(postcard.stickers) &&
    postcard.stickers.every((sticker) => typeof sticker === 'string')
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
