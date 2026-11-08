import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyToGradle, applyToPbxproj, parseBuildNumber, parseVersion } from './sync-version.mjs';

test('parseVersion akzeptiert x.y.z und lehnt Rest ab', () => {
  assert.equal(parseVersion('1.2.3'), '1.2.3');
  assert.throws(() => parseVersion('1.2'));
  assert.throws(() => parseVersion('1.2.3-beta'));
});

test('parseBuildNumber: leer ist undefined, ungueltig wirft', () => {
  assert.equal(parseBuildNumber(undefined), undefined);
  assert.equal(parseBuildNumber(''), undefined);
  assert.equal(parseBuildNumber('42'), '42');
  assert.throws(() => parseBuildNumber('0'));
  assert.throws(() => parseBuildNumber('abc'));
});

test('applyToPbxproj ersetzt alle Vorkommen und laesst Build ohne Nummer', () => {
  const src = 'MARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 1.0;';
  assert.equal(
    applyToPbxproj(src, '2.0.1', undefined),
    'MARKETING_VERSION = 2.0.1;\nCURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 2.0.1;',
  );
  assert.match(applyToPbxproj(src, '2.0.1', '7'), /CURRENT_PROJECT_VERSION = 7;/);
});

test('applyToGradle setzt versionName und optional versionCode', () => {
  const src = '        versionCode 1\n        versionName "1.0"\n';
  assert.equal(applyToGradle(src, '2.0.1', undefined), '        versionCode 1\n        versionName "2.0.1"\n');
  assert.equal(applyToGradle(src, '2.0.1', '9'), '        versionCode 9\n        versionName "2.0.1"\n');
});

test('fehlendes Muster wirft', () => {
  assert.throws(() => applyToGradle('nix', '1.0.0', undefined));
});
