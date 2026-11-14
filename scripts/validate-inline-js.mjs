import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc\s*=/.test(match[1]));

if (scripts.length === 0) {
  throw new Error('No inline application script was found in index.html.');
}

for (const [index, match] of scripts.entries()) {
  new vm.Script(match[2], { filename: \`index.html:inline-script-\${index + 1}\` });
}

console.log(\`Validated \${scripts.length} inline script(s): JavaScript syntax is valid.\`);
