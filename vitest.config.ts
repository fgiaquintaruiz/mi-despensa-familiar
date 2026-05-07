import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, '**/.claude/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      exclude: [
        // Requires Tesseract.js WASM + Web Worker — both unavailable in happy-dom.
        // retryWithHint/reset are exercised indirectly via import-ticket page tests.
        'src/lib/ocr/use-ocr.ts',
        // Pure factory — depends on next/headers cookies() which requires the
        // full Next.js RSC server request context. No branching logic to test.
        'src/lib/supabase/server.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
