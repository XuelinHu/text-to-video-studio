import { copyFile, mkdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDirectory = path.join(root, 'android');
const sdkDirectory = process.env.ANDROID_HOME
  || process.env.ANDROID_SDK_ROOT
  || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk') : '');
if (!sdkDirectory || !(await stat(sdkDirectory).catch(() => null))) {
  throw new Error('Android SDK was not found. Set ANDROID_HOME to your Android SDK directory.');
}

const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const installedGradle = process.env.GRADLE_HOME
  ? path.join(process.env.GRADLE_HOME, 'bin', process.platform === 'win32' ? 'gradle.bat' : 'gradle')
  : '';
const useInstalledGradle = installedGradle && await stat(installedGradle).catch(() => null);
const buildCommand = useInstalledGradle ? installedGradle : wrapper;
const result = spawnSync(buildCommand, ['assembleDebug'], {
  cwd: androidDirectory,
  env: { ...process.env, ANDROID_HOME: sdkDirectory, ANDROID_SDK_ROOT: sdkDirectory },
  shell: process.platform === 'win32' && buildCommand.endsWith('.bat'),
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status || 1);

const builtApk = path.join(androidDirectory, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const releaseDirectory = path.join(root, 'release');
const outputApk = path.join(releaseDirectory, 'Whiteboard-Video-Studio-Android.apk');
await mkdir(releaseDirectory, { recursive: true });
await copyFile(builtApk, outputApk);
console.log(`APK created: ${outputApk}`);
