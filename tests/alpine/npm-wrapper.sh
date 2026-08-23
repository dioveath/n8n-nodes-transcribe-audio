#!/bin/sh
set -eu

# n8n's community-node installer always fetches the package with `npm pack`.
# Substitute the package built by this test while leaving every other npm
# operation unchanged. This exercises n8n's real HTTP installation endpoint,
# extraction, isolated dependency installation, and package loader.
if [ "${1:-}" = "pack" ] && [ "${2#n8n-nodes-transcribe-audio@}" != "${2:-}" ]; then
	archive='n8n-nodes-transcribe-audio-candidate.tgz'
	cp /test/candidate.tgz "$PWD/$archive"
	printf '%s\n' "$archive"
	exit 0
fi

exec /usr/bin/npm "$@"
