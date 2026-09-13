import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { dirname, resolve } from 'node:path';

// Recria o __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    server: {
        proxy: {
            '/api-asaas': {
                target: 'https://sandbox.asaas.com/api/v3',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api-asaas/, '')
            }
        }
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'login.html'),
            },
        },
    },
});