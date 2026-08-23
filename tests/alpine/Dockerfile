# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.22

FROM node:${NODE_VERSION}-alpine AS package-builder

WORKDIR /source
ENV CI=true

RUN npm install --global pnpm@10.11.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY .eslintrc.js .eslintrc.prepublish.js .npmignore ./
COPY gulpfile.js index.js tsconfig.json README.md LICENSE.md ./
COPY credentials ./credentials
COPY nodes ./nodes

RUN pnpm run prepublishOnly \
    && pnpm pack --pack-destination /package

FROM node:${NODE_VERSION}-alpine AS alpine-test

WORKDIR /test

COPY --from=package-builder /package/*.tgz ./package.tgz
COPY package.json ./source-package.json
COPY tests/alpine/runtime.test.cjs ./runtime.test.cjs

RUN N8N_WORKFLOW_VERSION="$(node -e 'process.stdout.write(require("./source-package.json").devDependencies["n8n-workflow"])')" \
    && npm init --yes >/dev/null \
    && npm install --no-audit --no-fund ./package.tgz "n8n-workflow@${N8N_WORKFLOW_VERSION}"

CMD ["node", "--test", "runtime.test.cjs"]
