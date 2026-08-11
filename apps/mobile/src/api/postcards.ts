import {
  POSTCARD_DESIGNS_RPC_METHODS,
  SENT_POSTCARDS_RPC_METHODS,
  PostcardDesignsRpc,
  SentPostcardsRpc,
  type PostcardDesign,
  type SendPostcard,
  type SentPostcard
} from '@post-cards/contracts';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { fetch } from 'expo/fetch';
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient';
import * as RpcClient from 'effect/unstable/rpc/RpcClient';
import * as RpcSerialization from 'effect/unstable/rpc/RpcSerialization';
import { Platform } from 'react-native';

export type Postcard = SentPostcard;
export type SendPostcardInput = SendPostcard;

const defaultApiUrl =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;

const fetchHttpClientLayer = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
);

const rpcProtocolLayer = RpcClient.layerProtocolHttp({
  url: new URL('/rpc', apiUrl).toString(),
}).pipe(
  Layer.provide([fetchHttpClientLayer, RpcSerialization.layerJson]),
);

const listPostcards = Effect.scoped(
  RpcClient.make(SentPostcardsRpc).pipe(
    Effect.flatMap((client) =>
      client[SENT_POSTCARDS_RPC_METHODS.list](),
    ),
    Effect.provide(rpcProtocolLayer),
  ),
);

const listPostcardDesigns = Effect.scoped(
  RpcClient.make(PostcardDesignsRpc).pipe(
    Effect.flatMap((client) =>
      client[POSTCARD_DESIGNS_RPC_METHODS.list](),
    ),
    Effect.provide(rpcProtocolLayer),
  ),
);

export const postcardImageUrl = (uri: string) =>
  new URL(uri, apiUrl).toString();

export function getPostcards(
  signal?: AbortSignal,
): Promise<readonly SentPostcard[]> {
  return signal === undefined
    ? Effect.runPromise(listPostcards)
    : Effect.runPromise(listPostcards, { signal });
}

export function getPostcardDesigns(
  signal?: AbortSignal,
): Promise<readonly PostcardDesign[]> {
  return signal === undefined
    ? Effect.runPromise(listPostcardDesigns)
    : Effect.runPromise(listPostcardDesigns, { signal });
}

export function sendPostcard(input: SendPostcardInput): Promise<SentPostcard> {
  return Effect.runPromise(
    Effect.scoped(
      RpcClient.make(SentPostcardsRpc).pipe(
        Effect.flatMap((client) =>
          client[SENT_POSTCARDS_RPC_METHODS.send](input),
        ),
        Effect.provide(rpcProtocolLayer),
      ),
    ),
  );
}
