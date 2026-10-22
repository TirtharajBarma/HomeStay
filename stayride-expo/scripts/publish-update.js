#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rawArgs = process.argv.slice(2);
const appJsonPath = path.join(__dirname, '..', 'app.json');
const pkgPath = path.join(__dirname, '..', 'package.json');

// 0. Parse --branch <name> / --channel <name> (also --branch=<name>)
let branch = null;
const msgParts = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  const m = a.match(/^--(?:branch|channel)(?:=(.*))?$/);
  if (m) {
    branch = (m[1] !== undefined ? m[1] : rawArgs[++i] || '').trim();
  } else {
    msgParts.push(a);
  }
}
const messageArg = msgParts.join(' ').trim();

if (!messageArg) {
  console.error('\x1b[31m[Error] Please provide a release message.\x1b[0m');
  console.log('\x1b[33mUsage:\x1b[0m npm run update -- --branch production "v1.0.1: Fix navigation glitch; Improve performance"');
  process.exit(1);
}

// Validate branch against the channels configured in eas.json build profiles
let knownChannels = [];
try {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf-8'));
  knownChannels = Object.values(eas.build || {}).map((b) => b && b.channel).filter(Boolean);
} catch (e) {
  console.warn('Warning: Could not read eas.json channels', e.message);
}
if (!branch) {
  branch = 'preview';
  console.warn(
    '\x1b[33m[Warning] No --branch given; publishing to "preview". Production builds use the "production" channel and will NOT receive this update.\n' +
      '          Pass --branch production to ship to production users.\x1b[0m'
  );
}
if (knownChannels.length > 0 && !knownChannels.includes(branch)) {
  console.error(`\x1b[31m[Error] Unknown branch "${branch}". Channels in eas.json: ${knownChannels.join(', ')}\x1b[0m`);
  process.exit(1);
}

// 1. Extract version tag (e.g., "v1.0.1"). No version in the message → keep the
//    current version and leave all version files untouched (never roll back to v1.0.0).
const versionMatch = messageArg.match(/(?:^|[\s:(\[-])(?:version|ver|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
const originalAppJson = fs.readFileSync(appJsonPath, 'utf-8');
const currentExpo = JSON.parse(originalAppJson).expo || {};
const currentVersion = (currentExpo.extra && currentExpo.extra.updateVersion) || `v${currentExpo.version}`;
const extractedVersion = versionMatch ? `v${versionMatch[1]}` : currentVersion;
const shouldRewrite = Boolean(versionMatch);

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
//    (written before `eas update` because they are bundled into the update;
//    originals are restored if the publish fails)
const targetVersionFiles = [
  path.join(__dirname, '..', 'src', 'constants', 'version.ts'),
  path.join(__dirname, '..', 'constants', 'version.ts'),
].filter(p => fs.existsSync(p));

const originals = new Map();
for (const f of [...targetVersionFiles, pkgPath, appJsonPath]) {
  originals.set(f, fs.readFileSync(f, 'utf-8'));
}
const restoreOriginals = () => {
  for (const [f, c] of originals) fs.writeFileSync(f, c, 'utf-8');
};

for (const vPath of shouldRewrite ? targetVersionFiles : []) {
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
        /^export const RELEASE_DESCRIPTION = .*;[ \t]*$/m,
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

// 5. Synchronize app.json extra metadata and version.
if (shouldRewrite) try {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  if (appJson.expo) {
    appJson.expo.version = extractedVersion.replace(/^v/i, '');
    if (!appJson.expo.extra) appJson.expo.extra = {};
    appJson.expo.extra.updateVersion = extractedVersion;
    appJson.expo.extra.updateDescription = description;
    appJson.expo.extra.updateNotes = notesArray;
    appJson.expo.extra.easUpdateMessage = messageArg;
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf-8');
} catch (e) {
  console.warn('Warning: Could not sync version metadata in app.json', e);
}

if (shouldRewrite) {
  console.log(`\x1b[32m✔ Release metadata set to ${extractedVersion} in version.ts and app.json\x1b[0m`);
} else {
  console.log(`\x1b[33mNo version in message; keeping current ${extractedVersion} (no files changed)\x1b[0m`);
}
console.log(`\x1b[36m🚀 Publishing EAS Update to branch ${branch}...\x1b[0m\n`);

// 6. Run eas update via spawnSync to avoid shell quoting issues
const result = spawnSync(
  'npx',
  ['eas', 'update', '--branch', branch, '--environment', branch, '--non-interactive', '--message', messageArg],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

if (result.status !== 0) {
  if (shouldRewrite) {
    restoreOriginals();
    console.error('\x1b[31m[Error] eas update failed; version files restored.\x1b[0m');
  }
  process.exit(result.status || 1);
}

// Keep package.json in step only once the publish has succeeded (not bundled into the update).
if (shouldRewrite) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.version = extractedVersion.replace(/^v/i, '');
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  } catch (e) {
    console.warn('Warning: Could not sync version in package.json', e);
  }
}

console.log(`\n\x1b[32m✔ Update ${extractedVersion} published successfully!\x1b[0m`);
