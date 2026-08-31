# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.18.0
ARG N8N_VERSION=2.35.7

FROM node:${NODE_VERSION}-alpine AS package-builder

WORKDIR /source
ENV CI=true

RUN npm install --global pnpm@11.22.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY eslint.config.mjs .npmignore .prettierrc.js ./
COPY tsconfig.json README.md LICENSE.md ./
COPY nodes ./nodes

RUN pnpm run lint \
    && pnpm run build \
    && RELEASE_MODE=true pnpm pack --pack-destination /package

FROM n8nio/n8n:${N8N_VERSION} AS community-install-test

USER root
WORKDIR /test

COPY --from=package-builder /package/*.tgz /test/candidate.tgz
COPY package.json /test/candidate-package.json
COPY tests/alpine/community-install.test.cjs /test/community-install.test.cjs
COPY tests/alpine/npm-wrapper.sh /test-bin/npm
COPY tests/fixtures /test/fixtures

RUN chmod 755 /test-bin/npm \
    && mkdir -p /home/node/.n8n/nodes \
    && chown -R node:node /home/node/.n8n /test /test-bin

USER node

# Reproduce the persisted dependency tree that fails after moving an existing
# 0.1.23 installation from a glibc image to n8n's Alpine/musl image. Loading
# this package at startup seeds Node's module-resolution cache with the native
# ONNX dependency, exactly as in the reported upgrade failure.
RUN cd /home/node/.n8n/nodes \
    && printf '%s\n' '{"name":"installed-nodes","private":true,"dependencies":{}}' > package.json \
    && npm install \
        --audit=false \
        --fund=false \
        --bin-links=false \
        --ignore-scripts=true \
        --legacy-peer-deps \
        n8n-nodes-transcribe-audio@0.1.23

# n8n invokes `npm pack` through PATH. The wrapper substitutes the candidate
# tarball only for this package and delegates dependency installation to npm.
ENV PATH="/test-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ENTRYPOINT ["/usr/bin/node", "/test/community-install.test.cjs"]
