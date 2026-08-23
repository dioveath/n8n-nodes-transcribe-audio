import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';
import { globalIgnores } from 'eslint/config';

// This package embeds a local ML runtime and is intentionally self-hosted-only.
export default [
	globalIgnores([
		'test-my-transformer-package/**',
		'test-server/**',
		'test-xenova-alpine/**',
	]),
	...configWithoutCloudSupport,
	{
		files: ['package.json'],
		rules: {
			'@n8n/community-nodes/no-runtime-dependencies': 'off',
		},
	},
];
