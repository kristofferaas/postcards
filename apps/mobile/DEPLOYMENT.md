# Mobile deployment

The checked-in workflow is based on Expo's generated production deployment template:

<https://docs.expo.dev/eas/workflows/examples/deploy-to-production/>

## Production sequence

1. A push to `main` starts `.github/workflows/deploy.yml`.
2. GitHub runs the repository checks.
3. GitHub deploys and tests the production Cloudflare backend.
4. After that succeeds, GitHub checks whether the verified commit changed the mobile app or a shared dependency.
5. For mobile-related changes, GitHub authenticates with the `EXPO_TOKEN` repository secret and starts `.eas/workflows/deploy.yml` at the exact verified commit. GitHub waits for the EAS workflow to finish.
6. Expo Fingerprint checks for a compatible production iOS build.
7. If one exists, EAS publishes an update on the `production` branch. If none exists, EAS builds iOS and submits it to App Store Connect.

EAS cancels an older production-mobile run when a newer verified commit starts. This prevents an older OTA bundle from finishing after a newer one and becoming the latest production update.

## Native build submission recovery

An EAS build can succeed while its App Store Connect submission fails. The same situation can occur if a newer commit cancels a workflow between the build and submission jobs. A later deployment will find that successful build, so it will not retry the failed submission automatically.

Retry the submission explicitly with the build ID from the failed workflow:

```sh
cd apps/mobile
eas workflow:run .eas/workflows/retry-ios-submission.yml \
  -F build_id=<eas-build-id>
```

## TestFlight distribution

The submission job uploads the build to App Store Connect. Internal tester distribution currently relies on the app's "Enable automatic distribution" setting in App Store Connect. No TestFlight group name is hard-coded because the repository does not contain a stable group identifier.

## Environments

- `production` builds and updates use the EAS `production` environment and channel.
- `preview` builds use the EAS `preview` environment and channel. The preview API URL currently points to the production backend because there is no persistent preview backend.
- Android is configured as an Expo platform but is not part of the production deployment workflow yet.
