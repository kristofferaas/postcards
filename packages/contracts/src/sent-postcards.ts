import * as Schema from "effect/Schema"
import * as Rpc from "effect/unstable/rpc/Rpc"
import * as RpcGroup from "effect/unstable/rpc/RpcGroup"
import { BlobNotFound, BlobUri } from "./blob-storage.ts"

export class SentPostcard extends Schema.Class<SentPostcard>("SentPostcard")({
  id: Schema.Int,
  postcardDesignId: Schema.Int,
  frontImageUri: BlobUri,
  backImageUri: BlobUri,
  sentAt: Schema.String,
  openedAt: Schema.NullOr(Schema.String)
}) {}

export class SendPostcard extends Schema.Class<SendPostcard>("SendPostcard")({
  postcardDesignId: Schema.Int,
  frontImageUri: BlobUri,
  backImageUri: BlobUri
}) {}

export class SentPostcardsUnavailable extends Schema.TaggedError<SentPostcardsUnavailable>()(
  "SentPostcardsUnavailable",
  { message: Schema.String }
) {}

export const SENT_POSTCARDS_RPC_METHODS = {
  list: "sentPostcards.list",
  send: "sentPostcards.send"
} as const

export const ListSentPostcardsRpc = Rpc.make(
  SENT_POSTCARDS_RPC_METHODS.list,
  {
    success: Schema.Array(SentPostcard),
    error: SentPostcardsUnavailable
  }
)

export const SendPostcardRpc = Rpc.make(SENT_POSTCARDS_RPC_METHODS.send, {
  payload: SendPostcard,
  success: SentPostcard,
  error: Schema.Union([BlobNotFound, SentPostcardsUnavailable])
})

export const SentPostcardsRpc = RpcGroup.make(
  ListSentPostcardsRpc,
  SendPostcardRpc
)
