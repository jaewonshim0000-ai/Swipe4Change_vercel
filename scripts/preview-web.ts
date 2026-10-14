// Builds the web app exactly as Vercel does (single-page output, VERCEL=1) and serves dist/ the
// way vercel.json does: real files first, every other path falls back to index.html.
// Usage: npm run preview:web  (then open http://localhost:4173)
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

const build = spawnSync('npx expo export --platform web', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VERCEL: '1' },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const root = join(process.cwd(), 'dist');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};
const port = Number(process.env.PORT ?? 4173);

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  // normalize() plus the prefix check keeps "../" out of the served folder.
  const file = normalize(join(root, path));
  const body = file.startsWith(root + sep) ? await readFile(file).catch(() => null) : null;
  if (body) {
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } else {
    res.writeHead(200, { 'Content-Type': types['.html'] });
    res.end(await readFile(join(root, 'index.html')));
  }
}).listen(port, () => console.log(`Vercel-identical build at http://localhost:${port}`));
