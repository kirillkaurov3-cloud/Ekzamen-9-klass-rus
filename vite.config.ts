import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import {config} from './src/config';
const base = process.env.OGE_BASE_PATH || '/';
export default defineConfig({base, plugins:[react(),VitePWA({registerType:'prompt', includeAssets:['*.png','*.svg'],manifest:{name:config.name,short_name:config.name,lang:'ru',display:'standalone',start_url:base,scope:base,theme_color:'#513589',background_color:'#EEF0F6',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'},{src:'maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},workbox:{globPatterns:['**/*.{js,mjs,css,html,png,svg,webmanifest,woff2}'],navigateFallback:'index.html',maximumFileSizeToCacheInBytes:4000000}})]});
