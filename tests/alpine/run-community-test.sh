#!/bin/sh
set -eu

image_name='n8n-nodes-transcribe-audio:test-community'

docker build \
	--file tests/alpine/Dockerfile \
	--tag "$image_name" \
	.

docker run \
	--rm \
	--env "RUN_TRANSCRIPTION_TEST=${RUN_TRANSCRIPTION_TEST:-true}" \
	"$image_name"
