#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const messageArg = args.join(' ').trim();

if (!messageArg) {
  console.error('\x1b[31m[Error] Please provide a release message.\x1b[0m');
  console.log('\x1b[33mUsage:\x1b[0m npm run update "v1.0.1: Fix navigation glitch and improve performance"');
  process.exit(1);
}

// 1. Extract version tag (e.g., "v1.0.1")
const versionMatch = messageArg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
const extractedVersion = versionMatch ? `v${versionMatch[1]}` : 'v1.0.0';

// 2. Extract description (after ':' or '-')
let description = messageArg;
const colonIdx = messageArg.indexOf(':');
const dashIdx = messageArg.indexOf('-');
if (colonIdx !== -1) {
  description = messageArg.substring(colonIdx + 1).trim();
} else if (dashIdx !== -1) {
  description = messageArg.substring(dashIdx + 1).trim();
}

// 3. Parse individual bullet notes
const noteLines = description
  .split(/[\n•;|]/)
  .map((s) => s.replace(/^[\s•\-\*–—]+\s*/, '').trim())
  .filter((s) => s.length > 0);

const notesArray = noteLines.length > 0 ? noteLines : [description];

// 4. Update src/constants/version.ts and constants/version.ts
const targetVersionFiles = [
  path.join(__dirname, '..', 'src', 'constants', 'version.ts'),
  path.join(__dirname, '..', 'constants', 'version.ts'),
].filter(p => fs.existsSync(p));

for (const vPath of targetVersionFiles) {
  try {
    let content = fs.readFileSync(vPath, 'utf-8');
    if (
      content.includes('export const CURRENT_RELEASE_VERSION') &&
      content.includes('export const INITIAL_RELEASE_HISTORY')
    ) {
      content = content.replace(
        /export const CURRENT_RELEASE_VERSION = ".*?";/,
        `export const CURRENT_RELEASE_VERSION = "${extractedVersion}";`
      );
      content = content.replace(
        /export const RELEASE_DESCRIPTION = .*?;/,
        `export const RELEASE_DESCRIPTION = ${JSON.stringify(description)};`
      );

      // Prepend to INITIAL_RELEASE_HISTORY if not already present
      if (!content.includes(`version: "${extractedVersion}"`)) {
        const todayStr = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const formattedNotes = JSON.stringify(notesArray, null, 6).replace(/\n/g, '\n    ');
        const newItemStr = `  {\n    version: "${extractedVersion}",\n    date: "${todayStr}",\n    title: ${JSON.stringify(description)},\n    notes: ${formattedNotes},\n    type: "ota",\n    isNativeBuild: false,\n  },`;

        content = content.replace(
          /export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem\[\] = \[\n/,
          `export const INITIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [\n${newItemStr}\n`
        );
      }
      fs.writeFileSync(vPath, content, 'utf-8');
    }
  } catch (err) {
    console.warn('Warning: Could not update version in', vPath, err);
  }
}

// 5. Synchronize package.json and app.json
const semverRaw = extractedVersion.replace(/^v/i, '');
try {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = semverRaw;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

  const appJsonPath = path.join(__dirname, '..', 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  if (appJson.expo) {
    appJson.expo.version = semverRaw;
    if (!appJson.expo.extra) appJson.expo.extra = {};
    appJson.expo.extra.updateVersion = extractedVersion;
    appJson.expo.extra.updateDescription = description;
    appJson.expo.extra.updateNotes = notesArray;
    appJson.expo.extra.easUpdateMessage = messageArg;
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');
} catch (e) {
  console.warn('Warning: Could not sync version in package.json/app.json', e);
}

console.log(`\x1b[32m✔ Version synchronized to ${extractedVersion} across version.ts, package.json, and app.json\x1b[0m`);
console.log(`\x1b[36m🚀 Publishing EAS Update to channel preview...\x1b[0m\n`);

// 6. Run eas update via spawnSync to avoid shell quoting issues
const result = spawnSync(
  'npx',
  ['eas', 'update', '--branch', 'preview', '--non-interactive', '--message', messageArg],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`\n\x1b[32m✔ Update ${extractedVersion} published successfully!\x1b[0m`);
