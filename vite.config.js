import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [{
    name: 'copy-static-prototype-assets',
    closeBundle() {
      const root = resolve(process.cwd());
      const out = resolve(root, 'dist');
<<<<<<< HEAD
      for (const file of ['app.js', 'backend-api.js', 'styles.css']) {
=======
      for (const file of ['app.js', 'styles.css']) {
>>>>>>> b5682cd19735da78855d07f84547c974bcb0c01b
        const source = resolve(root, file);
        if (existsSync(source)) cpSync(source, resolve(out, file));
      }
    }
  }]
});
