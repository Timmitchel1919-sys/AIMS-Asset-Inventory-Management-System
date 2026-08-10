import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  fullyParallel:false,
  workers:1,
  timeout:30_000,
  expect:{timeout:7_500},
  reporter:[['list']],
  use:{
    baseURL:'http://127.0.0.1:4174',
    channel:'msedge',
    trace:'retain-on-failure',
    screenshot:'only-on-failure'
  },
  projects:[
    {name:'desktop',testMatch:/.*\.desktop\.spec\.ts/,use:{...devices['Desktop Edge'],viewport:{width:1366,height:768}}},
    {name:'mobile',testMatch:/.*\.mobile\.spec\.ts/,use:{channel:'msedge',viewport:{width:390,height:844}}}
  ],
  webServer:{
    command:'node node_modules/vite/bin/vite.js preview --config vite.config.ts --configLoader runner --host 127.0.0.1 --port 4174 --strictPort',
    url:'http://127.0.0.1:4174',
    reuseExistingServer:true,
    timeout:120_000
  }
});
