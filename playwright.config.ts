import {defineConfig,devices} from '@playwright/test';
const base=process.env.OGE_BASE_PATH||'/';
export default defineConfig({
 testDir:'tests/e2e',fullyParallel:true,workers:process.env.CI?2:undefined,retries:process.env.CI?1:0,
 use:{baseURL:`http://127.0.0.1:4173${base}`,trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
 webServer:{command:'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',url:`http://127.0.0.1:4173${base}`,reuseExistingServer:!process.env.CI,timeout:120000},
});
