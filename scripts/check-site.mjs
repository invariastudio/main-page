import { access, readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function publicPath(fromFile, rawTarget) {
  const target = rawTarget.split('#', 1)[0].split('?', 1)[0];
  if (!target) return null;
  if (/^(?:https?:|mailto:|tel:)/i.test(target)) return null;

  let resolved;
  if (target.startsWith('/main-page/')) {
    resolved = join(root, target.slice('/main-page/'.length));
  } else if (target === '/main-page') {
    resolved = root;
  } else if (target.startsWith('/')) {
    errors.push(`${relative(root, fromFile)} uses unsupported root URL ${target}`);
    return null;
  } else {
    resolved = resolve(dirname(fromFile), target);
  }

  return normalize(target.endsWith('/') ? join(resolved, 'index.html') : resolved);
}

const files = await walk(root);
const htmlFiles = files.filter((file) => extname(file) === '.html');

for (const file of htmlFiles) {
  const name = relative(root, file);
  const normalizedName = name.replaceAll('\\', '/');
  const html = await readFile(file, 'utf8');

  if (!/<html\s+lang="[^"]+"/i.test(html)) errors.push(`${name} has no page language`);
  if (!/<meta\s+name="viewport"/i.test(html)) errors.push(`${name} has no viewport metadata`);
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${name} has no title`);
  if (/<form\b/i.test(html)) errors.push(`${name} contains a form`);
  if (/<script\b/i.test(html)) errors.push(`${name} contains script code`);
  if (/(google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|segment\.com|mixpanel)/i.test(html)) {
    errors.push(`${name} contains a tracking reference`);
  }

  if (normalizedName !== '404.html') {
    const primaryNav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/i)?.[0];
    if (!primaryNav) {
      errors.push(`${name} has no primary navigation`);
    } else {
      const links = [...primaryNav.matchAll(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)];
      const labels = links.map((match) => match[2].trim()).join(',');
      if (labels !== 'Studio,Saldara,Principles,Contact') {
        errors.push(`${name} has inconsistent primary navigation: ${labels}`);
      }
      for (const [, href, label] of links) {
        if (/^(?:#|mailto:)/i.test(href)) errors.push(`${name} primary item ${label.trim()} does not open a page`);
      }
    }
  }

  if (normalizedName.startsWith('saldara/')) {
    const productNav = html.match(/<nav class="product-nav"[\s\S]*?<\/nav>/i)?.[0];
    if (!productNav) {
      errors.push(`${name} has no Saldara product navigation`);
    } else {
      const labels = [...productNav.matchAll(/<a\s+href="[^"]+"[^>]*>([^<]+)<\/a>/gi)]
        .map((match) => match[1].trim()).join(',');
      if (labels !== 'Overview,Privacy policy,Support') {
        errors.push(`${name} has inconsistent Saldara navigation: ${labels}`);
      }
      if (!/<main\s+id="content">\s*<nav class="product-nav"/i.test(html)) {
        errors.push(`${name} must keep Saldara navigation inside the page content`);
      }
    }
  }

  const attributes = html.matchAll(/(?:href|src)="([^"]+)"/gi);
  for (const match of attributes) {
    const target = publicPath(file, match[1]);
    if (!target) continue;
    try {
      await access(target);
      const targetStat = await stat(target);
      if (!targetStat.isFile()) errors.push(`${name} points to a non-file target: ${match[1]}`);
    } catch {
      errors.push(`${name} has a missing target: ${match[1]}`);
    }
  }
}

const policy = await readFile(join(root, 'saldara', 'privacy', 'index.html'), 'utf8');
for (const required of [
  'Privacy policy',
  'Invaria Studio',
  'invariastudio@gmail.com',
  'Collection, sharing, advertising',
  'Retention and deletion',
  'Backups, imports, exports, and security',
  'Política de privacidade',
]) {
  if (!policy.includes(required)) errors.push(`Saldara privacy policy is missing: ${required}`);
}

const checkerPath = fileURLToPath(import.meta.url);
const publicText = await Promise.all(
  files.filter((file) => file !== checkerPath && ['.html', '.md', '.txt', '.xml', '.css', '.mjs', '.json'].includes(extname(file)))
    .map((file) => readFile(file, 'utf8')),
);
const joined = publicText.join('\n');
for (const forbidden of [
  /com\.example\.personal_finance_app/i,
  /[A-Za-z]:\\Users\\[^\\\s]+/i,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
  /purchaseToken\s*[:=]\s*["'][^"']+/i,
  /password\s*[:=]\s*["'][^"']+/i,
]) {
  if (forbidden.test(joined)) errors.push(`Public repository content matched forbidden pattern: ${forbidden}`);
}

if (errors.length) {
  console.error(`Site validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Site validation passed: ${htmlFiles.length} HTML pages and ${files.length} public files checked.`);
}
