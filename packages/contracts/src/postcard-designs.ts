import * as Schema from "effect/Schema"
import * as Rpc from "effect/unstable/rpc/Rpc"
import * as RpcGroup from "effect/unstable/rpc/RpcGroup"
import { BlobNotFound, BlobUri } from "./blob-storage.ts"

export class PostcardDesign extends Schema.Class<PostcardDesign>(
  "PostcardDesign"
)({
  id: Schema.Int,
  name: Schema.String,
  frontImageUri: BlobUri,
  backImageUri: BlobUri,
  createdAt: Schema.String
}) {}

export class CreatePostcardDesign extends Schema.Class<CreatePostcardDesign>(
  "CreatePostcardDesign"
)({
  name: Schema.String,
  frontImageUri: BlobUri,
  backImageUri: BlobUri
}) {}

export class PostcardDesignsUnavailable extends Schema.TaggedErrorClass<PostcardDesignsUnavailable>()(
  "PostcardDesignsUnavailable",
  { message: Schema.String }
) {}

export const POSTCARD_DESIGNS_RPC_METHODS = {
  list: "postcardDesigns.list",
  create: "postcardDesigns.create"
} as const

export const ListPostcardDesignsRpc = Rpc.make(
  POSTCARD_DESIGNS_RPC_METHODS.list,
  {
    success: Schema.Array(PostcardDesign),
    error: PostcardDesignsUnavailable
  }
)

export const CreatePostcardDesignRpc = Rpc.make(
  POSTCARD_DESIGNS_RPC_METHODS.create,
  {
    payload: CreatePostcardDesign,
    success: PostcardDesign,
    error: Schema.Union([BlobNotFound, PostcardDesignsUnavailable])
  }
)

export const PostcardDesignsRpc = RpcGroup.make(
  ListPostcardDesignsRpc,
  CreatePostcardDesignRpc
)
