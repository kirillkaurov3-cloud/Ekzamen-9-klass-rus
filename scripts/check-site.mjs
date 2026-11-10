// Read-only check: catches publishing Vite sources instead of dist, missing assets,
// incorrect project paths, and missing PWA files. Never publishes or modifies a site.
const target = process.argv[2];
if (!target) throw new Error('Укажите URL: npm run site:check -- https://owner.github.io/repo/');
const base = new URL(target.endsWith('/') ? target : `${target}/`);
async function get(url, type) {
  const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  if (type && !response.headers.get('content-type')?.includes(type)) throw new Error(`Неверный Content-Type: ${url}`);
  return response.text();
}
function asset(value) {
  const url = new URL(value, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error(`Ресурс вне базового пути: ${url}`);
  return url;
}
const html = await get(base, 'text/html');
if (html.includes('%BASE_URL%') || /src=["'][^"']*\/src\//.test(html)) throw new Error('Опубликованы исходники Vite. В Settings → Pages выберите GitHub Actions и публикуйте dist через pages.yml.');
const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)].map(m => m[1]);
const styles = [...html.matchAll(/<link\b[^>]*href=["']([^"']+\.css)["']/g)].map(m => m[1]);
if (!scripts.length || !styles.length) throw new Error('В HTML отсутствуют собранные JS/CSS');
for (const path of scripts) await get(asset(path), 'javascript');
for (const path of styles) await get(asset(path), 'text/css');
const manifest = JSON.parse(await get(asset('manifest.webmanifest')));
for (const key of ['scope', 'start_url']) if (new URL(manifest[key], base).pathname !== base.pathname) throw new Error(`Неверный ${key}`);
for (const icon of manifest.icons) await get(asset(icon.src), 'image/');
await get(asset('sw.js'), 'javascript');
console.log(`✓ ${base}: собранные JS/CSS, базовый путь, manifest, иконки и service worker доступны`);
