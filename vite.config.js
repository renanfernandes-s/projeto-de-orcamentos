import { defineConfig } from 'vite';
import { resolve } from 'path';

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