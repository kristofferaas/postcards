import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"

const repository = {
  owner: "kristofferaas",
  repository: "postcards"
} as const

export default Alchemy.Stack(
  "PostcardsGitHub",
  {
    providers: Layer.mergeAll(
      Cloudflare.providers(),
      GitHub.providers()
    ),
    state: Cloudflare.state()
  },
  Effect.gen(function*() {
    const { accountId } =
      yield* yield* Cloudflare.CloudflareEnvironment

    const apiToken = yield* Cloudflare.ApiToken.AccountApiToken(
      "CIToken",
      {
        name: "postcards-github-actions",
        accountId,
        policies: [
          {
            effect: "allow",
            permissionGroups: [
              "Secrets Store Write",
              "Workers Scripts Write",
              "Workers R2 Storage Write",
              "D1 Write",
              "Account Settings Write"
            ],
            resources: {
              [`com.cloudflare.api.account.${accountId}`]: "*"
            }
          }
        ]
      }
    )

    yield* GitHub.Secret("CloudflareApiToken", {
      ...repository,
      name: "CLOUDFLARE_API_TOKEN",
      value: apiToken.value
    })

    yield* GitHub.Secret("CloudflareAccountId", {
      ...repository,
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: Redacted.make(accountId)
    })

    const production = yield* GitHub.Environment(
      "ProductionEnvironment",
      {
        ...repository,
        name: "production",
        deploymentBranchPolicy: {
          customBranchPolicies: ["main"]
        }
      }
    )

    return {
      apiTokenName: apiToken.name,
      productionEnvironmentUrl: production.htmlUrl
    }
  })
)
