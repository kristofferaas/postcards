import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import type { PostcardDesign, SendPostcard, SentPostcard } from '@post-cards/contracts';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { AsyncResult, Atom } from 'effect/unstable/reactivity';

import { PostcardsClient, postcardsClientLayer } from '@/api/postcards';

const POSTCARDS_STALE_TIME_MS = 15_000;
const DESIGNS_STALE_TIME_MS = 5 * 60_000;
const QUERY_IDLE_TTL_MS = 5 * 60_000;

const EMPTY_POSTCARDS: readonly SentPostcard[] = Object.freeze([]);
const EMPTY_POSTCARD_DESIGNS: readonly PostcardDesign[] = Object.freeze([]);

const postcardsRuntime = Atom.runtime(postcardsClientLayer);

export const postcardsAtom = postcardsRuntime
  .atom(
    PostcardsClient.pipe(Effect.flatMap((client) => client.listPostcards())),
  )
  .pipe(
    Atom.swr({
      staleTime: POSTCARDS_STALE_TIME_MS,
      revalidateOnMount: true,
    }),
    Atom.setIdleTTL(QUERY_IDLE_TTL_MS),
    Atom.withLabel('postcards:list'),
  );

export const postcardDesignsAtom = postcardsRuntime
  .atom(
    PostcardsClient.pipe(Effect.flatMap((client) => client.listPostcardDesigns())),
  )
  .pipe(
    Atom.swr({
      staleTime: DESIGNS_STALE_TIME_MS,
      revalidateOnMount: true,
    }),
    Atom.setIdleTTL(QUERY_IDLE_TTL_MS),
    Atom.withLabel('postcard-designs:list'),
  );

export const sendPostcardAtom = postcardsRuntime
  .fn((input: SendPostcard, get) =>
    PostcardsClient.pipe(
      Effect.flatMap((client) => client.sendPostcard(input)),
      Effect.tap(() =>
        Effect.sync(() => {
          get.refresh(postcardsAtom);
        }),
      ),
    ),
  )
  .pipe(Atom.withLabel('postcards:send'));

function errorMessage(
  result: AsyncResult.AsyncResult<unknown, unknown>,
  fallback: string,
): string | null {
  if (!AsyncResult.isFailure(result)) return null;
  const error = Cause.squash(result.cause);
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export function usePostcards() {
  const result = useAtomValue(postcardsAtom);
  const refresh = useAtomRefresh(postcardsAtom);
  const postcards = Option.getOrElse(
    AsyncResult.value(result),
    () => EMPTY_POSTCARDS,
  );

  return {
    postcards,
    refresh,
    isInitialLoading: result._tag === 'Initial',
    isRefreshing: result.waiting && postcards.length > 0,
    error: errorMessage(result, 'Could not load postcards.'),
  } as const;
}

export function usePostcardDesigns() {
  const result = useAtomValue(postcardDesignsAtom);
  const refresh = useAtomRefresh(postcardDesignsAtom);
  const designs = Option.getOrElse(
    AsyncResult.value(result),
    () => EMPTY_POSTCARD_DESIGNS,
  );

  return {
    designs,
    refresh,
    isInitialLoading: result._tag === 'Initial',
    isRefreshing: result.waiting && designs.length > 0,
    error: errorMessage(result, 'Could not load postcard designs.'),
  } as const;
}
