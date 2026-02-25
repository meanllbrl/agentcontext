import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  splitting: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Don't bundle dependencies - they'll be installed via node_modules
  external: [
    'commander',
    'chalk',
    'gray-matter',
    '@inquirer/prompts',
    'fast-glob',
    'nanoid',
    'boxen',
  ],
  onSuccess: async () => {
    cpSync('src/templates', 'dist/templates', { recursive: true });
    cpSync('agents', 'dist/agents', { recursive: true });
  },
});
