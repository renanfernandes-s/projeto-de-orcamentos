import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            '/api-asaas': {
                target: 'https://sandbox.asaas.com/api/v3',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api-asaas/, '')
            }
        }
    }
});