# Release checklist

Use this checklist for every public release.

## 1. Check access

```sh
gh auth status
npm whoami
```

The GitHub Actions publish job needs npm Trusted Publishing or a valid `NPM_TOKEN` repository secret. Never paste an npm token into an issue, chat, source file, or shell history.

## 2. Use the supported tools

- Node.js 24
- pnpm version from `packageManager` in `package.json`
- Docker with BuildKit

```sh
node --version
pnpm --version
docker version
```

## 3. Test the source and packed package

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm run build
pnpm run test:community
```

`test:community` must:

1. Build the npm archive.
2. Start the stock n8n Alpine image.
3. Reproduce the native ONNX failure from a persisted 0.1.23 install.
4. Install the candidate through n8n's Community Nodes HTTP endpoint.
5. Load the n8n node.
6. Run a small ONNX model through WASM.
7. Download `Xenova/whisper-tiny.en` and transcribe the WAV and MP3 fixtures.

The GitHub test workflow also runs `test:community:smoke` on an ARM64 runner. Wait for both x64 and ARM64 jobs to pass before creating a release tag.

## 4. Inspect the npm archive

```sh
mkdir -p /tmp/n8n-transcribe-pack
RELEASE_MODE=true pnpm pack --pack-destination /tmp/n8n-transcribe-pack

tar -tzf /tmp/n8n-transcribe-pack/n8n-nodes-transcribe-audio-*.tgz
```

The archive should contain the compiled node, icons, manifest, README, and license. It should not contain `node_modules`, native ONNX `.node` files, native ONNX `.so` files, test fixtures, or model files. The WASM runtime is installed from the exact regular dependencies in `package.json`.

## 5. Review the self-hosted limitation

This package intentionally has runtime dependencies for local Whisper inference. The n8n Cloud community-package scanner currently rejects runtime dependencies and restricted imports. Do not describe this package as n8n Cloud verified. Keep the README marked as self-hosted only.

## 6. Update release notes

- Move the `Unreleased` changelog items into a new version section.
- Confirm the package version and release notes agree.
- Keep the `@huggingface/transformers` and `onnxruntime-web` alias targets pinned to exact tested versions.
- Do not rename or remove the `transformers-wasm` alias without testing an upgrade from 0.1.23 in one running n8n process.

## 7. Create the release

Run this only after reviewing a clean working tree:

```sh
pnpm run release
```

When run locally, `n8n-node release` updates the version, commits, tags, pushes, and creates the GitHub release. The pushed version tag starts `.github/workflows/publish.yml`, which tests the packed package again and publishes it to npm with provenance.

Watch the jobs:

```sh
gh run watch
```

Then verify npm:

```sh
npm view n8n-nodes-transcribe-audio@latest version dist.tarball dist.unpackedSize
npx --yes @n8n/scan-community-package n8n-nodes-transcribe-audio@latest
```

The provenance check should pass. The scanner's runtime-dependency errors are expected while this package remains self-hosted only.

## 8. Deprecate unsafe old releases

This is a one-time public registry change. It needs an npm login with owner access:

```sh
npm login
npm whoami
npm deprecate 'n8n-nodes-transcribe-audio@<0.2.1' \
  'Alpine installs may fail because these releases can load native ONNX. Upgrade to 0.2.1 or newer.'
```

Check the result:

```sh
for version in 0.1.0 0.1.1 0.1.21 0.1.22 0.1.23 0.2.0 0.2.1; do
  printf '%s: ' "$version"
  npm view "n8n-nodes-transcribe-audio@$version" deprecated
done
```

Version 0.2.1 and newer must not show a deprecation message.

## 9. Recovery

If publishing fails, do not reuse a version number. Fix the problem, bump to a new patch version, and run the complete checklist again.
