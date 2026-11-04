import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { Agent, request } from 'node:http';
import { Buffer } from 'node:buffer';
import { URLSearchParams } from 'node:url';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import axios from 'axios';
import { requireAuth } from '../src/middleware/auth.js';
import githubRoutes from '../src/routes/github.js';

// No production credentials, database, or external OAuth calls are used here.
// Use node:http so host-level fetch proxy settings cannot intercept loopback tests.
function localRequest(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers, agent: new Agent() }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: { get: name => {
          const value = res.headers[name.toLowerCase()];
          return Array.isArray(value) ? value[0] : value;
        } },
        json: () => JSON.parse(Buffer.concat(chunks).toString()),
      }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('Express proxy trust uses the nearest forwarded hop and supports IPv4-mapped peers', async t => {
  const app = express();
  app.set('trust proxy', 1);
  app.get('/ip', (req, res) => res.json({ ip: req.ip, ips: req.ips }));
  const base = await serve(t, app);
  const response = await localRequest(`${base}/ip`, {
    headers: { 'X-Forwarded-For': '198.51.100.1, ::ffff:192.0.2.42' },
  });
  assert.deepEqual(await response.json(), { ip: '::ffff:192.0.2.42', ips: ['::ffff:192.0.2.42'] });
});

test('JSON parser preserves layout payloads and rejects malformed or oversized bodies', async t => {
  const app = express();
  app.use(express.json());
  app.post('/layouts/:id', (req, res) => res.json({ id: req.params.id, body: req.body }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ error: error.type });
  });
  const base = await serve(t, app);
  const payload = { name: 'Regression', data: [[{ c: '#ffffff' }, 'Esc']] };
  const post = body => localRequest(`${base}/layouts/layout-123`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const good = await post(JSON.stringify(payload));
  assert.equal(good.status, 200);
  assert.deepEqual(await good.json(), { id: 'layout-123', body: payload });
  assert.equal((await post('{bad')).status, 400);
  assert.equal((await post(JSON.stringify({ data: 'x'.repeat(110000) }))).status, 413);
});

test('session cookies retain authentication across protected routes and logout', async t => {
  const app = express();
  app.use(session({ secret: 'local-regression-only', resave: false, saveUninitialized: false, name: 'kle.sid' }));
  app.post('/login', (req, res) => { req.session.userId = 'local-user'; res.json({ ok: true }); });
  app.get('/protected', requireAuth, (req, res) => res.json({ id: req.session.userId }));
  app.post('/logout', (req, res) => req.session.destroy(error => res.sendStatus(error ? 500 : 204)));
  app.use('/api/github', githubRoutes);
  const base = await serve(t, app);
  assert.equal((await localRequest(`${base}/protected`)).status, 401);
  assert.equal((await localRequest(`${base}/api/github/gists`)).status, 401);
  const login = await localRequest(`${base}/login`, { method: 'POST' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const headers = { Cookie: cookie };
  assert.deepEqual(await (await localRequest(`${base}/protected`, { headers })).json(), { id: 'local-user' });
  const gist = await localRequest(`${base}/api/github/gists`, { headers });
  assert.equal(gist.status, 401);
  assert.deepEqual(await gist.json(), { error: 'GitHub authentication required' });
  assert.equal((await localRequest(`${base}/logout`, { method: 'POST', headers })).status, 204);
  assert.equal((await localRequest(`${base}/protected`, { headers })).status, 401);
});

test('credentialed CORS preflight preserves the configured frontend contract', async t => {
  const app = express();
  app.use(cors({ origin: 'http://localhost:5173', credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  const base = await serve(t, app);
  const response = await localRequest(base, { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('access-control-allow-methods'), /POST/);
});

test('Axios OAuth-style form requests, JSON responses, and response-size enforcement work', async t => {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.post('/token', (req, res) => res.json({ code: req.body.code, grant_type: req.body.grant_type }));
  app.get('/large', (req, res) => res.send('x'.repeat(2048)));
  app.get('/redirect', (req, res) => res.redirect('/large'));
  const base = await serve(t, app);
  const response = await axios.post(`${base}/token`, new URLSearchParams({ code: 'local-code', grant_type: 'authorization_code' }), { proxy: false });
  assert.equal(response.status, 200);
  assert.deepEqual(response.data, { code: 'local-code', grant_type: 'authorization_code' });
  await assert.rejects(axios.get(`${base}/large`, { proxy: false, maxContentLength: 128 }), /maxContentLength/);
  await assert.rejects(axios.get(`${base}/redirect`, { proxy: false, maxRedirects: 0 }), error => error.response?.status === 302);
});
