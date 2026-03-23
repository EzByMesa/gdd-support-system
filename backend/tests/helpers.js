/**
 * Вспомогательные функции для тестов.
 */

function getBase() {
  return `http://127.0.0.1:${process.env.PORT || 3000}/api`;
}

export async function request(method, path, { body, token, raw } = {}) {
  const opts = {
    method,
    headers: {}
  };

  if (token) opts.headers['Authorization'] = `Bearer ${token}`;

  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }

  const res = await fetch(`${getBase()}${path}`, opts);

  if (raw) return res;

  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

export const get = (path, token) => request('GET', path, { token });
export const post = (path, body, token) => request('POST', path, { body, token });
export const put = (path, body, token) => request('PUT', path, { body, token });
export const del = (path, token) => request('DELETE', path, { token });

// Assertion helpers
let passed = 0;
let failed = 0;

export function suite(name) {
  console.log(`\n\x1b[1m=== ${name} ===\x1b[0m`);
}

export function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m\u2713\x1b[0m ${message}`);
  } else {
    failed++;
    console.log(`  \x1b[31m\u2717 FAIL:\x1b[0m ${message}`);
  }
}

export function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got: ${actual}, expected: ${expected})`);
}

export function summary() {
  console.log(`\n\x1b[1m--- Итого ---\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m`);
  if (failed > 0) console.log(`  \x1b[31m${failed} failed\x1b[0m`);
  else console.log('  \x1b[32mВсе тесты пройдены!\x1b[0m');
  return failed;
}
