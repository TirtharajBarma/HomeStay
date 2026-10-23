import app from '../src/app.js';

interface RouteInfo {
  path: string;
  methods: string[];
}

const routes: RouteInfo[] = [];

function getPathFromRegex(regexp: any): string {
  if (!regexp) return '';
  const str = regexp.toString();
  const match = str
    .replace('^\\/', '')
    .replace('\\/?(?=\\/|$)', '')
    .replace('(?=\\/|$)', '')
    .match(/^\/\^\\?\/?(.*?)\\?\/?\$\//);
  if (match) {
    return '/' + match[1].replace(/\\\//g, '/').replace(/\\/g, '');
  }
  return str;
}

function processStack(stack: any[], prefix = '') {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
      const fullPath = (prefix + layer.route.path).replace(/\/+/g, '/');
      routes.push({ path: fullPath, methods });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      let routerPrefix = '';
      if (layer.regexp) {
        // Express router regexp parsing
        const parsed = layer.regexp.source
          ? layer.regexp.source
              .replace('^\\/', '/')
              .replace('\\/?(?=\\/|$)', '')
              .replace('(?=\\/|$)', '')
              .replace(/\\\//g, '/')
              .replace(/^\^/, '')
              .replace(/\$$/, '')
          : '';
        routerPrefix = parsed.startsWith('/') ? parsed : '/' + parsed;
        // Clean regex artifacts
        routerPrefix = routerPrefix.replace(/\/\?$/, '').replace(/\/\?$/, '');
      }
      processStack(layer.handle.stack, prefix + routerPrefix);
    }
  }
}

if ((app as any)._router?.stack) {
  processStack((app as any)._router.stack);
}

// Group and clean
const cleanRoutes: { method: string; path: string }[] = [];
for (const r of routes) {
  for (const m of r.methods) {
    cleanRoutes.push({ method: m, path: r.path });
  }
}

cleanRoutes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

console.log(`TOTAL REGISTERED ENDPOINTS: ${cleanRoutes.length}`);
cleanRoutes.forEach((r, i) => {
  console.log(`${i + 1}. [${r.method}] ${r.path}`);
});
