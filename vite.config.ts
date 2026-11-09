import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import {config} from './src/config';
const base = process.env.OGE_BASE_PATH || '/';
export default defineConfig({base, plugins:[react(),VitePWA({registerType:'prompt', includeAssets:['*.png','*.svg'],manifest:{name:config.name,short_name:config.name,lang:'ru',display:'standalone',start_url:base,scope:base,theme_color:'#5841E5',background_color:'#F5F5FA',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'},{src:'maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},workbox:{globPatterns:['**/*.{js,css,html,png,svg,webmanifest}'],navigateFallback:'index.html',maximumFileSizeToCacheInBytes:4000000}})]});
