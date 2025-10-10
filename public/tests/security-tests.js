// Security and health endpoint tests

const results = [];
const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');

function log(msg, pass = null) {
  const div = document.createElement('div');
  if (pass !== null) {
    div.className = pass ? 'pass' : 'fail';
    div.textContent = `${pass ? '✓' : '✗'} ${msg}`;
  } else {
    div.textContent = msg;
  }
  resultsEl.appendChild(div);
  results.push({ msg, pass });
}

async function testHealthEndpoint() {
  log('Testing /health endpoint...');
  try {
    const res = await fetch('/health');
    const data = await res.json();
    
    log(`Status: ${res.status}`, res.status === 200);
    log(`Has status field: ${!!data.status}`, !!data.status);
    log(`Has version field: ${!!data.version}`, !!data.version);
    log(`Has uptime field: ${!!data.uptime}`, !!data.uptime);
    log(`Has checks field: ${!!data.checks}`, !!data.checks);
    
    if (data.version) {
      log(`Version: ${data.version}`, data.version === '0.3.0');
    }
  } catch (err) {
    log(`Health endpoint error: ${err.message}`, false);
  }
}

async function testReadyEndpoint() {
  log('Testing /ready endpoint...');
  try {
    const res = await fetch('/ready');
    const data = await res.json();
    
    log(`Status: ${res.status}`, res.status === 200 || res.status === 503);
    log(`Has status field: ${!!data.status}`, !!data.status);
    
    if (data.status === 'ready') {
      log(`Calendars loaded: ${data.calendars}`, data.calendars > 0);
    }
  } catch (err) {
    log(`Ready endpoint error: ${err.message}`, false);
  }
}

async function testSecurityHeaders() {
  log('Testing security headers...');
  try {
    const res = await fetch('/');
    const headers = res.headers;
    
    log(`Has Content-Security-Policy`, headers.has('content-security-policy'));
    log(`Has X-Frame-Options`, headers.has('x-frame-options'));
    log(`Has X-Content-Type-Options`, headers.has('x-content-type-options'));
    
    const csp = headers.get('content-security-policy');
    if (csp) {
      log(`CSP includes nominatim`, csp.includes('nominatim.openstreetmap.org'));
      log(`CSP includes CDNs`, csp.includes('cdn.jsdelivr.net') && csp.includes('unpkg.com'));
    }
  } catch (err) {
    log(`Security headers error: ${err.message}`, false);
  }
}

async function testInputValidation() {
  log('Testing input validation...');
  try {
    // Test with invalid data (empty summary)
    const res = await fetch('/api/events/all-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: '' })
    });
    
    const data = await res.json().catch(() => ({}));
    
    // Accept either 400 (validation) or 403 (auth required)
    const isExpectedStatus = res.status === 400 || res.status === 403;
    log(`API responds (status ${res.status})`, isExpectedStatus);
    
    if (res.status === 400 && data.error === 'Validation failed') {
      log(`Returns validation error`, true);
      log(`Returns details array`, Array.isArray(data.details));
      
      if (Array.isArray(data.details)) {
        log(`Has field validation`, data.details.length > 0);
        const hasCalendarUrl = data.details.some(d => d.field === 'calendarUrl');
        const hasSummary = data.details.some(d => d.field === 'summary');
        log(`Validates calendarUrl`, hasCalendarUrl);
        log(`Validates summary`, hasSummary);
      }
    } else if (res.status === 403) {
      log(`Auth required (validation not testable without login)`, true);
    } else {
      log(`Unexpected response: ${res.status}`, false);
    }
  } catch (err) {
    log(`Validation test error: ${err.message}`, false);
  }
}

async function testRateLimitHeaders() {
  log('Testing rate limit headers...');
  try {
    const res = await fetch('/api/calendars');
    const headers = res.headers;
    
    // Rate limit headers are added by express-rate-limit
    const hasRateLimit = headers.has('ratelimit-limit') || headers.has('x-ratelimit-limit');
    log(`Has rate limit headers`, hasRateLimit);
    
    if (hasRateLimit) {
      const limit = headers.get('ratelimit-limit') || headers.get('x-ratelimit-limit');
      const remaining = headers.get('ratelimit-remaining') || headers.get('x-ratelimit-remaining');
      log(`Limit: ${limit}`, parseInt(limit) > 0);
      log(`Remaining: ${remaining}`, parseInt(remaining) >= 0);
    }
  } catch (err) {
    log(`Rate limit test error: ${err.message}`, false);
  }
}

async function runAllTests() {
  try {
    resultsEl.innerHTML = '';
    results.length = 0;
    
    await testHealthEndpoint();
    await testReadyEndpoint();
    await testSecurityHeaders();
    await testInputValidation();
    await testRateLimitHeaders();
    
    const passed = results.filter(r => r.pass === true).length;
    const failed = results.filter(r => r.pass === false).length;
    const total = passed + failed;
    
    summaryEl.textContent = `Passed ${passed}/${total} security tests`;
    summaryEl.className = failed === 0 ? 'pass' : 'fail';
  } catch (err) {
    summaryEl.textContent = `Error running tests: ${err.message}`;
    summaryEl.className = 'fail';
    console.error('Test error:', err);
  }
}

const btn = document.getElementById('runSecurityTests');
if (btn) {
  btn.addEventListener('click', runAllTests);
} else {
  console.error('runSecurityTests button not found');
}
