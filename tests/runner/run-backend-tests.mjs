#!/usr/bin/env node
// Backend unit test runner
// Runs vitest tests and outputs progress

import { spawn } from 'node:child_process';

console.log('🧪 Running Backend Unit Tests...\n');

const start = Date.now();
const vitest = spawn('npx', ['vitest', 'run', '--reporter=verbose'], {
  stdio: 'inherit', // Show output in real-time
  env: { ...process.env, FORCE_COLOR: '1' }
});

vitest.on('close', (code) => {
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n⏱️  Backend tests completed in ${duration}s`);
  
  if (code === 0) {
    console.log('✅ All backend tests passed!\n');
  } else {
    console.log(`❌ Backend tests failed with exit code ${code}\n`);
  }
  
  process.exit(code);
});

vitest.on('error', (err) => {
  console.error('Failed to start vitest:', err);
  process.exit(1);
});
