import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appConfig } from './app-config.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = join(projectRoot, 'dist');
loadEnv(join(projectRoot, '.env'));

const port = Number(process.env.PORT || 8787);
const maxBodyBytes = 250_000;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function loadEnv(filename) {
  if (!existsSync(filename)) return;
  for (const line of readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function apiSettings() {
  return {
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
    apiStyle: (process.env.AI_API_STYLE || 'responses').toLowerCase(),
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || 'gpt-5',
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('Input is larger than 250 KB. Shorten it and try again.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function extractText(data, style) {
  if (style === 'chat') return data?.choices?.[0]?.message?.content?.trim() || '';
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  return (data?.output || [])
    .flatMap((item) => item?.content || [])
    .filter((item) => item?.type === 'output_text' && typeof item?.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

async function createAiOutput(payload) {
  const settings = apiSettings();
  if (!settings.apiKey) throw Object.assign(new Error('AI is not configured. Copy .env.example to .env and add AI_API_KEY.'), { status: 503 });
  if (!['responses', 'chat'].includes(settings.apiStyle)) throw Object.assign(new Error('AI_API_STYLE must be responses or chat.'), { status: 500 });

  const userText = `Current workspace data:\n${JSON.stringify(payload, null, 2)}`;
  const url = `${settings.baseUrl}/${settings.apiStyle === 'chat' ? 'chat/completions' : 'responses'}`;
  const body = settings.apiStyle === 'chat'
    ? { model: settings.model, messages: [{ role: 'system', content: appConfig.systemPrompt }, { role: 'user', content: userText }] }
    : { model: settings.model, instructions: appConfig.systemPrompt, input: userText, store: false };

  const providerResponse = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) {
    const providerMessage = data?.error?.message || `Provider returned HTTP ${providerResponse.status}.`;
    throw Object.assign(new Error(providerMessage), { status: 502 });
  }
  const text = extractText(data, settings.apiStyle);
  if (!text) throw Object.assign(new Error('The provider returned no readable text.'), { status: 502 });
  return { text, model: settings.model };
}

function serveStatic(request, response, pathname) {
  if (!existsSync(distRoot)) {
    sendJson(response, 404, { error: 'No production build found. Run npm run build first.' });
    return;
  }
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = resolve(distRoot, normalize(requested));
  const insideDist = candidate === distRoot || candidate.startsWith(`${distRoot}${sep}`);
  const safeFile = insideDist && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(distRoot, 'index.html');
  response.writeHead(200, {
    'Cache-Control': extname(safeFile) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Type': mimeTypes[extname(safeFile).toLowerCase()] || 'application/octet-stream',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(safeFile).pipe(response);
}

const server = createServer(async (request, response) => {
  let url;
  try {
    url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  } catch {
    sendJson(response, 400, { error: 'Invalid request URL.' });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/status') {
    const settings = apiSettings();
    sendJson(response, 200, { configured: Boolean(settings.apiKey), model: settings.model, app: appConfig.slug });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/ai') {
    try {
      const body = await readJson(request);
      if (body.app !== appConfig.slug) throw Object.assign(new Error('This request is for a different app.'), { status: 400 });
      if (!body.payload || typeof body.payload !== 'object') throw Object.assign(new Error('A workspace payload is required.'), { status: 400 });
      sendJson(response, 200, await createAiOutput(body.payload));
    } catch (error) {
      const status = Number(error?.status) || (error instanceof SyntaxError ? 400 : 500);
      sendJson(response, status, { error: error instanceof Error ? error.message : 'Unexpected server error.' });
    }
    return;
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { sendJson(response, 400, { error: 'Invalid URL encoding.' }); return; }
    serveStatic(request, response, pathname);
    return;
  }
  sendJson(response, 405, { error: 'Method not allowed.' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`${appConfig.title} is ready at http://127.0.0.1:${port}`);
  console.log(apiSettings().apiKey ? `AI mode: ready (${apiSettings().model})` : 'AI mode: demo only — add AI_API_KEY to .env');
});
