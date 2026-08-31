#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime_root="$project_root/.docker/n8n-custom"
pack_root=$(mktemp -d)

cleanup() {
	rm -rf "$pack_root"
}
trap cleanup EXIT INT TERM

# Stop the dev container before replacing its bind-mounted dependency tree.
docker compose --project-directory "$project_root" stop n8n >/dev/null 2>&1 || true

rm -rf "$runtime_root"
mkdir -p "$runtime_root"

RELEASE_MODE=true pnpm pack --pack-destination "$pack_root" >/dev/null
archive=$(find "$pack_root" -maxdepth 1 -name '*.tgz' -print -quit)

if [ -z "$archive" ]; then
	echo 'Could not find the packed community-node archive.' >&2
	exit 1
fi

docker run --rm \
	--user "$(id -u):$(id -g)" \
	--env HOME=/tmp \
	--volume "$archive:/candidate.tgz:ro" \
	--volume "$runtime_root:/runtime" \
	node:24-alpine \
	sh -eu -c '
		printf "%s\n" '\''{"name":"n8n-dev-custom-nodes","private":true}'\'' > /runtime/package.json
		npm install \
			--prefix /runtime \
			--audit=false \
			--fund=false \
			--ignore-scripts=true \
			--legacy-peer-deps \
			/candidate.tgz
	'

echo "Prepared Alpine runtime dependencies in $runtime_root/node_modules"
