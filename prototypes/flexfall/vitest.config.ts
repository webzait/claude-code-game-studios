// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 } });
