import * as RpcGroup from "effect/unstable/rpc/RpcGroup"
import {
  CreatePostcardDesignRpc,
  ListPostcardDesignsRpc
} from "./postcard-designs.ts"
import { ListSentPostcardsRpc, SendPostcardRpc } from "./sent-postcards.ts"

export const PostcardsRpc = RpcGroup.make(
  ListPostcardDesignsRpc,
  CreatePostcardDesignRpc,
  ListSentPostcardsRpc,
  SendPostcardRpc
)
