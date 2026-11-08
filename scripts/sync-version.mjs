#!/usr/bin/env node
// Synchronisiert die App-Version (Quelle: package.json) in die nativen Projekte.
//   iOS:     MARKETING_VERSION (+ CURRENT_PROJECT_VERSION bei Build-Nummer)
//   Android: versionName       (+ versionCode bei Build-Nummer)
// Build-Nummer: Argument --build=N oder Umgebungsvariable BUILD_NUMBER
// (Codemagic: PROJECT_BUILD_NUMBER, GitHub Actions: GITHUB_RUN_NUMBER).
// Aufruf:  node scripts/sync-version.mjs [--build=N] [--check]
// --check schreibt nichts und beendet mit Code 1, falls etwas abweicht.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SEMVER = /^\d+\.\d+\.\d+$/;
const BUILD = /^[1-9]\d{0,8}$/;

export function parseVersion(raw) {
  if (!SEMVER.test(raw ?? '')) {
    throw new Error(`package.json version muss x.y.z sein, ist aber: ${JSON.stringify(raw)}`);
  }
  return raw;
}

export function parseBuildNumber(raw) {
  if (raw === undefined || raw === '') return undefined;
  if (!BUILD.test(String(raw))) {
    throw new Error(`Build-Nummer muss eine positive ganze Zahl sein, ist aber: ${JSON.stringify(raw)}`);
  }
  return String(raw);
}

function replaceAll(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`${label}: Muster nicht gefunden`);
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement);
}

export function applyToPbxproj(text, version, build) {
  const withVersion = replaceAll(text, /MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`, 'pbxproj MARKETING_VERSION');
  return build === undefined
    ? withVersion
    : replaceAll(withVersion, /CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`, 'pbxproj CURRENT_PROJECT_VERSION');
}

export function applyToGradle(text, version, build) {
  const withName = replaceAll(text, /versionName\s+"[^"]*"/, `versionName "${version}"`, 'gradle versionName');
  return build === undefined
    ? withName
    : replaceAll(withName, /versionCode\s+\d+/, `versionCode ${build}`, 'gradle versionCode');
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const buildArg = args.find((a) => a.startsWith('--build='))?.slice('--build='.length);

  const version = parseVersion(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version);
  const build = parseBuildNumber(buildArg ?? process.env.BUILD_NUMBER);

  const targets = [
    { file: 'ios/App/App.xcodeproj/project.pbxproj', apply: applyToPbxproj },
    { file: 'android/app/build.gradle', apply: applyToGradle },
  ];

  let drift = false;
  for (const { file, apply } of targets) {
    const path = resolve(root, file);
    const before = readFileSync(path, 'utf8');
    const after = apply(before, version, build);
    if (after === before) {
      console.log(`ok      ${file}`);
      continue;
    }
    drift = true;
    if (check) {
      console.log(`DRIFT   ${file}`);
    } else {
      writeFileSync(path, after);
      console.log(`updated ${file}`);
    }
  }
  console.log(`Version ${version}${build ? ` (Build ${build})` : ''}`);
  if (check && drift) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`sync-version: ${err.message}`);
    process.exit(1);
  }
}
