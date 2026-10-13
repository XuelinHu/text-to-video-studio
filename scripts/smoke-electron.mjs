import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'output');
await mkdir(outputDirectory, { recursive: true });
let outputPath = '';
const profilePath = await mkdtemp(path.join(tmpdir(), 'whiteboard-electron-smoke-'));
const workspacePath = path.join(outputDirectory, 'psychology-functional-projects');
await mkdir(workspacePath, { recursive: true });
await writeFile(path.join(profilePath, 'settings.json'), JSON.stringify({
  workspaceDirectory: workspacePath,
  ttsMode: 'edge-tts',
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsRate: 1.1,
  includeAudio: true,
  exportResolution: '1280x720',
}, null, 2), 'utf8');
const electronBinary = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const samplePath = process.env.STUDIO_SMOKE_SCRIPT || path.join(projectRoot, 'samples', 'psychology-smoke-script.txt');
const sample = (await readFile(path.resolve(projectRoot, samplePath), 'utf8')).trim();
const sampleCharacterCount = Array.from(sample).length;
if (process.env.STUDIO_SMOKE_SCRIPT && (sampleCharacterCount < 140 || sampleCharacterCount > 260)) {
  throw new Error(`Expected a short psychology smoke script; received ${sampleCharacterCount} characters.`);
}
const electron = spawn(electronBinary, ['--remote-debugging-port=9223', '--autoplay-policy=no-user-gesture-required', '.'], {
  cwd: projectRoot,
  windowsHide: true,
  stdio: 'ignore',
  env: { ...process.env, STUDIO_USER_DATA: profilePath, STUDIO_SMOKE_OUTPUT: '', STUDIO_SKIP_EXPORT_DIALOG: '1' },
});

let socket;
let sequence = 0;
const pending = new Map();

function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Browser evaluation failed.');
  return response.result?.value;
}

async function waitFor(description, condition, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(condition)) return;
    if (electron.exitCode !== null && electron.exitCode !== undefined) throw new Error(`Electron exited early while ${description}.`);
    await delay(400);
  }
  throw new Error(`Timed out while ${description}.`);
}

async function waitForExport(timeoutMs = 240000) {
  const started = Date.now();
  let lastStatus = '';
  while (Date.now() - started < timeoutMs) {
    const status = await evaluate("document.querySelector('.status-text')?.innerText || ''");
    if (status !== lastStatus) {
      lastStatus = status;
      console.log(`Export: ${status}`);
    }
    if (/导出失败|FFmpeg|录制失败|无法启动/u.test(status)) throw new Error(status);
    if (status.startsWith('视频已保存：')) return status;
    await delay(500);
  }
  throw new Error('The Electron export did not report completion.');
}

async function waitForSpeech(timeoutMs = 120000) {
  const started = Date.now();
  let lastStatus = '';
  while (Date.now() - started < timeoutMs) {
    const state = await evaluate("JSON.stringify({ ready: document.querySelectorAll('.segment-tools .audio-ready').length, total: document.querySelectorAll('.segment-item').length, status: document.querySelector('.status-text')?.innerText || '' })");
    const progress = JSON.parse(state);
    if (progress.status !== lastStatus) {
      lastStatus = progress.status;
      console.log(`Speech: ${progress.ready}/${progress.total} ready; ${progress.status}`);
    }
    if (/失败|无法|请先填写|错误/u.test(progress.status)) throw new Error(progress.status);
    if (progress.total > 0 && progress.ready === progress.total) return;
    await delay(400);
  }
  throw new Error('Timed out while generating all Chinese voice clips.');
}

try {
  let target;
  const started = Date.now();
  while (!target && Date.now() - started < 30000) {
    try {
      const targets = await fetch('http://127.0.0.1:9223/json/list').then((response) => response.json());
      target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
    } catch { await delay(300); }
  }
  if (!target) throw new Error('Electron did not expose its local smoke-test page. Check that npm start is running.');
  console.log(`Electron smoke target: ${target.title || ''} ${target.url || ''}`);

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  console.log(`Renderer status: ${await evaluate("JSON.stringify({ ready: document.readyState, title: document.title, body: document.body?.innerText?.slice(0, 160) })")}`);
  await waitFor('loading the editor', "document.querySelector('.script-input') !== null");
  const setScript = `(() => { const input = document.querySelector('.script-input'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(sample)}); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`;
  await evaluate(setScript);
  await evaluate("Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('按标点拆分')).click()");
  const count = await evaluate("document.querySelectorAll('.segment-item').length");
  if (count < 5) throw new Error(`Expected multiple script segments but received ${count}.`);
  const sceneLengths = JSON.parse(await evaluate("JSON.stringify(Array.from(document.querySelectorAll('.segment-item textarea'), (item) => Array.from(item.value).length))"));
  if (sceneLengths.some((length) => length > 34)) throw new Error(`A scene exceeded the two-line limit: ${JSON.stringify(sceneLengths)}`);
  const presetCount = await evaluate("document.querySelectorAll('.image-preset').length");
  if (presetCount !== 5) throw new Error(`Expected 5 bundled image presets but received ${presetCount}.`);
  await evaluate("Array.from(document.querySelectorAll('.image-preset')).find((button) => button.innerText.includes('书与笔')).click()");
  await waitFor('selecting the book and pen preset', "document.querySelector('.image-picker strong')?.innerText === '书与笔'");
  const imageScale = await evaluate("document.querySelector('.visual-range-control input[type=range]:first-of-type')?.value");
  if (imageScale !== '1') throw new Error(`Expected the default image scale to be 1.0 but received ${imageScale}.`);
  const defaultCaptionSize = await evaluate("document.querySelector('input[aria-label=\"题词字号\"]')?.value");
  if (defaultCaptionSize !== '56') throw new Error(`Expected the default caption size to be 56px but received ${defaultCaptionSize}.`);
  await evaluate("(() => { const range = document.querySelector('.visual-range-control input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(range, '1.25'); range.dispatchEvent(new Event('input', { bubbles: true })); range.dispatchEvent(new Event('change', { bubbles: true })); range.blur(); const caption = document.querySelector('input[aria-label=\"题词字号\"]'); set.call(caption, '60'); caption.dispatchEvent(new Event('input', { bubbles: true })); caption.dispatchEvent(new Event('change', { bubbles: true })); caption.blur(); return true; })()");
  await waitFor('updating the image scale and caption size', "document.querySelector('.visual-range-control input[type=range]')?.value === '1.25' && document.querySelector('input[aria-label=\"题词字号\"]')?.value === '60'");
  const selectedImageScale = await evaluate("document.querySelector('.visual-range-control input[type=range]').value");
  const selectedCaptionSize = await evaluate("document.querySelector('input[aria-label=\"题词字号\"]').value");

  await evaluate("Array.from(document.querySelectorAll('.topbar button')).find((button) => button.innerText.includes('AI / 语音设置')).click()");
  await evaluate("(() => { const selects = Array.from(document.querySelectorAll('.settings-section select')); const mode = selects.find((select) => Array.from(select.options).some((option) => option.value === 'edge-tts')); if (mode) { mode.value = 'edge-tts'; mode.dispatchEvent(new Event('change', { bubbles: true })); } return true; })()");
  await waitFor('loading Microsoft Edge Chinese voices', "Array.from(document.querySelectorAll('.settings-section option')).some((option) => option.value === 'zh-CN-XiaoxiaoNeural')");
  await evaluate("(() => { const voice = Array.from(document.querySelectorAll('.settings-section select')).find((select) => Array.from(select.options).some((option) => option.value === 'zh-CN-XiaoxiaoNeural')); if (!voice) throw new Error('Microsoft Xiaoxiao voice is missing'); voice.value = 'zh-CN-XiaoxiaoNeural'; voice.dispatchEvent(new Event('change', { bubbles: true })); return true; })()");
  await evaluate("Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('保存设置')).click()");
  const voiceSettings = JSON.parse(await evaluate("JSON.stringify({ voice: Array.from(document.querySelectorAll('.settings-section select')).find((select) => Array.from(select.options).some((option) => option.value === 'zh-CN-XiaoxiaoNeural'))?.value || 'zh-CN-XiaoxiaoNeural', speed: Array.from(document.querySelectorAll('.settings-section input[type=range]')).at(-1)?.value || '1.1' })"));
  await evaluate("Array.from(document.querySelectorAll('.topbar button')).find((button) => button.innerText.includes('返回工作区')).click()");
  await waitFor('returning to the editor', "document.querySelector('.segment-list .segment-item') !== null");
  await evaluate("document.querySelector('.generate-all-audio').click()");
  await waitFor('checking existing speech clips', "document.querySelector('[role=dialog]') !== null");
  const speechAudit = JSON.parse(await evaluate("JSON.stringify({ summary: document.querySelector('.speech-summary')?.innerText, generated: document.querySelectorAll('.speech-lists > div')[0]?.innerText, missing: document.querySelectorAll('.speech-lists > div')[1]?.innerText })"));
  if (!speechAudit.summary.includes(`未生成 ${count} 段`) || !speechAudit.missing.includes('心理学是研究')) throw new Error(`Unexpected speech audit: ${JSON.stringify(speechAudit)}`);
  await evaluate("Array.from(document.querySelectorAll('.speech-dialog-actions button')).find((button) => button.innerText.includes('只生成缺失')).click()");
  await waitForSpeech();
  await evaluate("document.querySelector('.generate-all-audio').click()");
  await waitFor('rechecking the generated speech clips', "document.querySelector('[role=dialog]') !== null");
  const completeSpeechAudit = await evaluate("document.querySelector('.speech-summary')?.innerText || ''");
  if (!completeSpeechAudit.includes(`已生成 ${count} 段`) || !completeSpeechAudit.includes('未生成 0 段')) throw new Error(`Unexpected completed speech audit: ${completeSpeechAudit}`);
  await evaluate("Array.from(document.querySelectorAll('.speech-dialog-actions button')).find((button) => button.innerText.includes('全部重新生成')).click()");
  await waitForSpeech();
  await evaluate("Array.from(document.querySelectorAll('.topbar button')).find((button) => button.innerText.includes('导出 MP4')).click()");
  const exportStatus = await waitForExport();
  outputPath = exportStatus.replace(/^视频已保存：/u, '').trim();
  const probe = spawnSync(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,duration', '-of', 'json', outputPath], { encoding: 'utf8', windowsHide: true });
  if (probe.error) throw new Error(`Could not start ffprobe: ${probe.error.message}`);
  if (probe.status !== 0) throw new Error(`ffprobe rejected the exported MP4: ${probe.stderr}`);
  const media = JSON.parse(probe.stdout);
  const video = media.streams?.find((stream) => stream.codec_type === 'video');
  const audio = media.streams?.find((stream) => stream.codec_type === 'audio');
  const videoDuration = Number(video?.duration || 0);
  const audioTrackDuration = Number(audio?.duration || 0);
  if (!video || !audio || video.width !== 1280 || video.height !== 720 || videoDuration < 10 || Math.abs(videoDuration - audioTrackDuration) > 1.25) {
    throw new Error(`Unexpected smoke-test output: ${probe.stdout}`);
  }
  const projectPath = path.dirname(outputPath);
  const folderName = path.basename(projectPath);
  const projectMeta = JSON.parse(await readFile(path.join(projectPath, 'project.json'), 'utf8'));
  const projectFiles = await readdir(projectPath, { withFileTypes: true });
  const audioFiles = await readdir(path.join(projectPath, 'audio'));
  if (!/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/u.test(folderName) || /[<>:"/\\|?*]/u.test(folderName)) throw new Error(`Invalid generated project folder name: ${folderName}`);
  if (projectMeta.script !== sample || projectMeta.segments.length !== count || !projectFiles.some((entry) => entry.name === 'template.json') || audioFiles.length !== count) throw new Error('Project archive is missing script, template, or generated audio assets.');

  await evaluate("Array.from(document.querySelectorAll('.topbar button')).find((button) => button.innerText.includes('新建')).click()");
  await waitFor('saving the current project and clearing the editor', "document.querySelector('.script-input')?.value === '' && document.querySelectorAll('.segment-item').length === 0");
  await evaluate("Array.from(document.querySelectorAll('.topbar button')).find((button) => button.innerText.includes('管理台')).click()");
  await waitFor('listing the saved video and draft', "document.querySelectorAll('.project-row').length >= 2");
  const projectKinds = await evaluate("JSON.stringify(Array.from(document.querySelectorAll('.project-thumb'), (item) => item.innerText))");
  if (!JSON.parse(projectKinds).includes('MP4') || !JSON.parse(projectKinds).includes('JSON')) throw new Error(`Expected both exported video and saved draft: ${projectKinds}`);
  console.log(JSON.stringify({ outputPath, projectPath, scriptCharacters: sampleCharacterCount, segmentCount: count, maxSceneChars: Math.max(...sceneLengths), presetCount, selectedImage: '书与笔', imageScale: Number(selectedImageScale), headerFontPx: 39, contentFontPx: Number(selectedCaptionSize), ttsVoice: voiceSettings.voice, speechRate: Number(voiceSettings.speed), speechAudit: speechAudit.summary, completeSpeechAudit, projectKinds: JSON.parse(projectKinds), audioFileCount: audioFiles.length, bytes: (await stat(outputPath)).size, durationSeconds: Number(media.format.duration), videoDuration, audioTrackDuration, syncDifferenceSeconds: Math.abs(videoDuration - audioTrackDuration), videoCodec: video.codec_name, audioCodec: audio.codec_name, width: video.width, height: video.height }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (electron.exitCode === null || electron.exitCode === undefined) {
    electron.kill();
    await new Promise((resolve) => electron.once('exit', resolve));
  }
  await delay(1500);
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }); } catch {}
}
