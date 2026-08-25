import { expo } from "@better-auth/expo"
import { passkey } from "@better-auth/passkey"
import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthEndpoint } from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import * as z from "zod"

const REGISTRATION_INTENT_PREFIX = "passkey-registration:"
const REGISTRATION_COMPLETION_PREFIX = "passkey-registration-complete:"
const REGISTRATION_INTENT_TTL_MS = 5 * 60 * 1_000
const REGISTRATION_COMPLETION_TTL_MS = 60 * 1_000
const IOS_BUNDLE_IDENTIFIER = "com.kristofferaas.postcards"
export const ANDROID_PACKAGE_NAME = "com.kristofferaas.postcards"
export const DEVELOPMENT_APPLE_TEAM_ID = "FAKETEAMID"

const requireAuthTestMode = () => {
  if (process.env.AUTH_TEST_MODE !== "true") {
    throw APIError.from("NOT_FOUND", {
      code: "NOT_FOUND",
      message: "Not found."
    })
  }
}

const startRegistrationBody = z.object({
  name: z.string().trim().min(1).max(80)
})

const completeRegistrationBody = z.object({
  context: z.string().uuid()
})

const passkeyRegistration = () => ({
  id: "passkey-registration",
  endpoints: {
    startPasskeyRegistration: createAuthEndpoint(
      "/passkey-registration/start",
      {
        method: "POST",
        body: startRegistrationBody
      },
      async (ctx) => {
        const token = crypto.randomUUID()
        const pendingUser = {
          id: crypto.randomUUID(),
          name: ctx.body.name
        }

        await ctx.context.internalAdapter.createVerificationValue({
          identifier: `${REGISTRATION_INTENT_PREFIX}${token}`,
          value: JSON.stringify(pendingUser),
          expiresAt: new Date(Date.now() + REGISTRATION_INTENT_TTL_MS)
        })

        return ctx.json({ context: token })
      }
    ),
    completePasskeyRegistration: createAuthEndpoint(
      "/passkey-registration/complete",
      {
        method: "POST",
        body: completeRegistrationBody
      },
      async (ctx) => {
        const completion =
          await ctx.context.internalAdapter.consumeVerificationValue(
            `${REGISTRATION_COMPLETION_PREFIX}${ctx.body.context}`
          )

        if (!completion) {
          throw APIError.from("BAD_REQUEST", {
            code: "REGISTRATION_COMPLETION_INVALID",
            message: "The passkey registration was not verified or has expired."
          })
        }

        const user = await ctx.context.internalAdapter.findUserById(
          completion.value
        )
        if (!user) {
          throw APIError.from("BAD_REQUEST", {
            code: "REGISTRATION_COMPLETION_INVALID",
            message: "The passkey registration could not be completed."
          })
        }

        const session =
          await ctx.context.internalAdapter.createSession(user.id)
        await setSessionCookie(ctx, { session, user })

        return ctx.json({ userId: user.id })
      }
    )
  },
  rateLimit: [
    {
      pathMatcher: (path: string) =>
        path === "/passkey-registration/start",
      window: 60,
      max: 5
    }
  ]
}) satisfies BetterAuthPlugin

const authTestSupport = () => ({
  id: "auth-test-support",
  endpoints: {
    createAuthTestSession: createAuthEndpoint(
      "/auth-test/session",
      {
        method: "POST",
        body: z.object({
          name: z.string().trim().min(1).max(80).optional()
        })
      },
      async (ctx) => {
        requireAuthTestMode()
        const user = await ctx.context.internalAdapter.createUser({
          email: `integration-${crypto.randomUUID()}@postcards.invalid`,
          emailVerified: false,
          name: ctx.body.name ?? "Integration Test"
        })
        const session =
          await ctx.context.internalAdapter.createSession(user.id)

        await setSessionCookie(ctx, { session, user })
        return ctx.json({ userId: user.id })
      }
    ),
    countAuthTestUsers: createAuthEndpoint(
      "/auth-test/user-count",
      { method: "GET" },
      async (ctx) => {
        requireAuthTestMode()
        const count = await ctx.context.internalAdapter.countTotalUsers()
        return ctx.json({ count })
      }
    )
  }
}) satisfies BetterAuthPlugin

const publicWorkerUrl = process.env.PUBLIC_URL
const publicWorkerHost = publicWorkerUrl
  ? new URL(publicWorkerUrl).hostname
  : undefined
const relyingPartyId =
  process.env.PASSKEY_RP_ID ?? publicWorkerHost ?? "localhost"
const relyingPartyOrigin =
  process.env.PASSKEY_ORIGIN ?? `https://${relyingPartyId}`

export const appleTeamId =
  process.env.APPLE_TEAM_ID?.trim() || DEVELOPMENT_APPLE_TEAM_ID
export const appleAppId = `${appleTeamId}.${IOS_BUNDLE_IDENTIFIER}`

const androidFingerprintPattern =
  /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/

export const androidCertFingerprints = (
  process.env.ANDROID_CERT_FINGERPRINTS?.trim() || ""
)
  .split(",")
  .map((fingerprint) => fingerprint.trim().toUpperCase())
  .filter((fingerprint) => fingerprint.length > 0)
  .map((fingerprint) => {
    if (!androidFingerprintPattern.test(fingerprint)) {
      throw new Error(
        `Invalid Android SHA-256 certificate fingerprint: ${fingerprint}`
      )
    }
    return fingerprint
  })

export const androidAssetLinks = androidCertFingerprints.map(
  (fingerprint) => ({
    relation: ["delegate_permission/common.get_login_creds"],
    target: {
      namespace: "android_app",
      package_name: ANDROID_PACKAGE_NAME,
      sha256_cert_fingerprints: [fingerprint]
    }
  })
)

export const authOptions = {
  baseURL: {
    allowedHosts: [
      "localhost",
      "localhost:*",
      "127.0.0.1",
      "127.0.0.1:*",
      "*.workers.dev",
      relyingPartyId
    ],
    protocol: "auto" as const
  },
  basePath: "/api/auth",
  appName: "Post Cards",
  trustedOrigins: [
    "post-cards://",
    "http://localhost:*",
    "https://localhost:*",
    relyingPartyOrigin
  ],
  plugins: [
    expo(),
    passkeyRegistration(),
    authTestSupport(),
    passkey({
      rpID: relyingPartyId,
      rpName: "Post Cards",
      origin: relyingPartyOrigin,
      registration: {
        requireSession: false,
        resolveUser: async ({ ctx, context }) => {
          if (!context) {
            throw APIError.from("BAD_REQUEST", {
              code: "REGISTRATION_INTENT_REQUIRED",
              message: "A passkey registration intent is required."
            })
          }

          const intent =
            await ctx.context.internalAdapter.consumeVerificationValue(
              `${REGISTRATION_INTENT_PREFIX}${context}`
            )

          if (!intent) {
            throw APIError.from("BAD_REQUEST", {
              code: "REGISTRATION_INTENT_INVALID",
              message: "The passkey registration intent expired or was used."
            })
          }

          return z
            .object({
              id: z.string().min(1),
              name: z.string().min(1)
            })
            .parse(JSON.parse(intent.value))
        },
        afterVerification: async ({ ctx, user, context }) => {
          const databaseUser =
            await ctx.context.internalAdapter.createUser({
              id: user.id,
              email: `passkey-${crypto.randomUUID()}@postcards.invalid`,
              emailVerified: false,
              name: user.name
            })

          if (!context) {
            throw APIError.from("BAD_REQUEST", {
              code: "REGISTRATION_INTENT_REQUIRED",
              message: "A passkey registration intent is required."
            })
          }

          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${REGISTRATION_COMPLETION_PREFIX}${context}`,
            value: databaseUser.id,
            expiresAt: new Date(
              Date.now() + REGISTRATION_COMPLETION_TTL_MS
            )
          })

          return { userId: databaseUser.id }
        }
      }
    })
  ]
}
