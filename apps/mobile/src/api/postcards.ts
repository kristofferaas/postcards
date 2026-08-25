import {
  POSTCARD_DESIGNS_RPC_METHODS,
  SENT_POSTCARDS_RPC_METHODS,
  PostcardsRpc,
  type SentPostcard,
} from '@post-cards/contracts';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { fetch } from 'expo/fetch';
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient';
import * as HttpClient from 'effect/unstable/http/HttpClient';
import * as HttpClientRequest from 'effect/unstable/http/HttpClientRequest';
import * as RpcClient from 'effect/unstable/rpc/RpcClient';
import * as RpcSerialization from 'effect/unstable/rpc/RpcSerialization';

import { authClient } from './auth';
import { apiUrl } from './config';

export type Postcard = SentPostcard;

export { apiUrl } from './config';

const fetchHttpClientLayer = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
);

const rpcProtocolLayer = RpcClient.layerProtocolHttp({
  url: new URL('/rpc', apiUrl).toString(),
  transformClient: (client) =>
    HttpClient.mapRequest(client, (request) => {
      const cookie = authClient.getCookie();
      return cookie.length > 0
        ? HttpClientRequest.setHeader(request, 'cookie', cookie)
        : request;
    }),
}).pipe(
  Layer.provide([fetchHttpClientLayer, RpcSerialization.layerJson]),
);

const makePostcardsClient = RpcClient.make(PostcardsRpc).pipe(
  Effect.map((client) => ({
    listPostcards: () => client[SENT_POSTCARDS_RPC_METHODS.list](),
    listPostcardDesigns: () => client[POSTCARD_DESIGNS_RPC_METHODS.list](),
    sendPostcard: client[SENT_POSTCARDS_RPC_METHODS.send],
  })),
);

type PostcardsClientService = Effect.Success<typeof makePostcardsClient>;

export class PostcardsClient extends Context.Service<
  PostcardsClient,
  PostcardsClientService
>()('@post-cards/mobile/PostcardsClient') {}

export const postcardsClientLayer = Layer.effect(
  PostcardsClient,
  makePostcardsClient,
).pipe(Layer.provide(rpcProtocolLayer));

export const postcardImageUrl = (uri: string) =>
  new URL(uri, apiUrl).toString();
