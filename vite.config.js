import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [{
    name: 'copy-static-prototype-assets',
    closeBundle() {
      const root = resolve(process.cwd());
      const out = resolve(root, 'dist');
      for (const file of ['app.js', 'backend-api.js', 'styles.css']) {
        const source = resolve(root, file);
        if (existsSync(source)) cpSync(source, resolve(out, file));
      }
    }
  }]
});
