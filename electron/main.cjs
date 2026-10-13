const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { EdgeTTS } = require('node-edge-tts');

const edgeVoices = [
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 · 女声 · 普通话' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊 · 女声 · 普通话' },
  { id: 'zh-TW-HsiaoChenNeural', label: '晓臻 · 女声 · 台湾国语' },
  { id: 'zh-TW-HsiaoYuNeural', label: '晓雨 · 女声 · 台湾国语' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', label: '晓北 · 女声 · 辽宁口音' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', label: '晓妮 · 女声 · 陕西口音' },
  { id: 'zh-CN-YunjianNeural', label: '云健 · 男声 · 普通话' },
  { id: 'zh-CN-YunxiNeural', label: '云希 · 男声 · 普通话' },
  { id: 'zh-CN-YunyangNeural', label: '云扬 · 男声 · 普通话' },
];

if (process.env.STUDIO_USER_DATA) app.setPath('userData', process.env.STUDIO_USER_DATA);

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

async function readSettings() {
  try {
    const data = JSON.parse(await fs.readFile(settingsPath(), 'utf8'));
    if (data.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
      data.apiKey = safeStorage.decryptString(Buffer.from(data.encryptedApiKey, 'base64'));
    }
    data.aiProfiles = (data.aiProfiles || []).map((profile) => ({
      ...profile,
      apiKey: profile.encryptedApiKey && safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(profile.encryptedApiKey, 'base64'))
        : profile.apiKey || '',
    })).map(({ encryptedApiKey, ...profile }) => profile);
    delete data.encryptedApiKey;
    data.workspaceDirectory ||= path.join(app.getPath('documents'), '视频工作室管理数据');
    return data;
  } catch {
    return { workspaceDirectory: path.join(app.getPath('documents'), '视频工作室管理数据') };
  }
}

async function saveSettings(settings) {
  const data = { ...settings };
  const apiKey = data.apiKey || '';
  delete data.apiKey;
  if (Array.isArray(data.aiProfiles)) {
    data.aiProfiles = data.aiProfiles.map((profile) => {
      const next = { ...profile };
      const profileKey = next.apiKey || '';
      delete next.apiKey;
      if (profileKey && safeStorage.isEncryptionAvailable()) next.encryptedApiKey = safeStorage.encryptString(profileKey).toString('base64');
      else delete next.encryptedApiKey;
      return next;
    });
  }
  if (apiKey) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('当前系统无法安全保存 API 密钥。');
    }
    data.encryptedApiKey = safeStorage.encryptString(apiKey).toString('base64');
  }
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(data, null, 2), 'utf8');
}

function workspacePath(settings) {
  return path.resolve(settings.workspaceDirectory || path.join(app.getPath('documents'), '视频工作室管理数据'));
}

function safeName(value) {
  let name = String(value || '未命名视频').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/[. ]+$/g, '').trim().slice(0, 100);
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name)) name = `_${name}`;
  return name || '未命名视频';
}

function shortTitle(value) {
  return Array.from(String(value || '').trim()).slice(0, 5).join('') || '新视频';
}

function formatStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function projectName(script) {
  const firstSentence = String(script || '').trim().split(/(?<=[。！？!?])/u, 1)[0] || String(script || '').trim();
  return safeName(`${formatStamp()}_${Array.from(firstSentence).slice(0, 48).join('')}`);
}

async function createProjectFolder(root, name) {
  await fs.mkdir(root, { recursive: true });
  for (let suffix = 1; ; suffix += 1) {
    const folderName = suffix === 1 ? name : `${name}_${String(suffix).padStart(2, '0')}`;
    const folderPath = path.join(root, folderName);
    try {
      await fs.mkdir(folderPath);
      return { folderName, folderPath };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

async function writeProjectBundle(projectPath, settings, project, videoFile = '') {
  const imageMatch = /^data:(image\/[^;]+);base64,(.+)$/s.exec(settings?.image?.dataUrl || '');
  let imageFile = '';
  if (imageMatch) {
    const extension = imageMatch[1] === 'image/jpeg' ? 'jpg' : imageMatch[1].split('/')[1].replace('svg+xml', 'svg');
    imageFile = `center-image.${extension}`;
    await fs.writeFile(path.join(projectPath, imageFile), Buffer.from(imageMatch[2], 'base64'));
  }
  await fs.mkdir(path.join(projectPath, 'audio'), { recursive: true });
  const segments = [];
  for (let index = 0; index < (project?.segments || []).length; index += 1) {
    const segment = project.segments[index];
    const audioFile = segment.audio?.data ? `audio/segment-${String(index + 1).padStart(3, '0')}.${segment.audio.mimeType === 'audio/wav' ? 'wav' : 'mp3'}` : '';
    if (audioFile) await fs.writeFile(path.join(projectPath, audioFile), Buffer.from(segment.audio.data, 'base64'));
    const { audio, ...metadata } = segment;
    segments.push({ ...metadata, audioFile, audioMimeType: audio?.mimeType || '' });
  }
  const template = {
    headerLeft: settings?.headerLeft || '', headerRight: settings?.headerRight || '', author: settings?.author || '',
    imageName: settings?.image?.name || '', imageFile, imageScale: settings?.imageScale, captionFontSize: settings?.captionFontSize,
    ttsMode: settings?.ttsMode, ttsVoice: settings?.ttsVoice, ttsRate: settings?.ttsRate,
    includeAudio: project?.includeAudio !== false, exportResolution: project?.resolution || '1280x720',
  };
  const meta = {
    title: project?.title || projectName(project?.script), createdAt: new Date().toISOString(),
    script: project?.script || '', segments, settings: template, templateFile: 'template.json', videoFile,
  };
  await fs.writeFile(path.join(projectPath, 'script.json'), JSON.stringify({ script: meta.script, segments }, null, 2), 'utf8');
  await fs.writeFile(path.join(projectPath, 'project.json'), JSON.stringify(meta, null, 2), 'utf8');
  await fs.writeFile(path.join(projectPath, 'template.json'), JSON.stringify(template, null, 2), 'utf8');
  return meta;
}

ipcMain.handle('workspace:choose', async (_event, currentPath) => {
  const result = await dialog.showOpenDialog({
    defaultPath: currentPath || path.join(app.getPath('documents'), '视频工作室管理数据'),
    properties: ['openDirectory', 'createDirectory'],
    title: '选择视频工作目录',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('projects:list', async (_event, { directory, page = 1, pageSize = 8 }) => {
  const root = path.resolve(directory || path.join(app.getPath('documents'), '视频工作室管理数据'));
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(root, entry.name);
    try {
      const [metaRaw, files] = await Promise.all([
        fs.readFile(path.join(folder, 'project.json'), 'utf8'),
        fs.readdir(folder),
      ]);
      const meta = JSON.parse(metaRaw);
      projects.push({ ...meta, folder: entry.name, mp4: files.find((file) => file.endsWith('.mp4')) || '', hasVideo: files.some((file) => file.endsWith('.mp4')) });
    } catch { /* Ignore folders without a valid project description. */ }
  }
  projects.sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  const size = Math.max(1, Math.min(50, Number(pageSize) || 8));
  const currentPage = Math.max(1, Number(page) || 1);
  return { projects: projects.slice((currentPage - 1) * size, currentPage * size), total: projects.length, page: currentPage, pageSize: size };
});

ipcMain.handle('projects:open', async (_event, { directory, folder, file }) => {
  const base = path.resolve(directory);
  const target = path.resolve(base, folder, file || '');
  if (!target.startsWith(`${base}${path.sep}`)) throw new Error('项目路径无效。');
  const { shell } = require('electron');
  const error = await shell.openPath(target);
  if (error) throw new Error(error);
  return true;
});

ipcMain.handle('projects:save-draft', async (_event, { settings, project }) => {
  const root = workspacePath(settings || {});
  const { folderName, folderPath } = await createProjectFolder(root, projectName(project?.script));
  await writeProjectBundle(folderPath, settings, { ...project, title: folderName });
  return { folder: folderName, title: folderName, path: folderPath };
});

function endpoint(baseUrl, route) {
  return `${String(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/${route}`;
}

async function requestJson(url, apiKey, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`服务请求失败 (${response.status}): ${message.slice(0, 400)}`);
  }
  return response.json();
}

ipcMain.handle('settings:load', readSettings);
ipcMain.handle('settings:save', async (_event, settings) => {
  await saveSettings(settings);
  return true;
});

ipcMain.handle('tts:list-voices', async () => {
  if (process.platform !== 'win32') return [];
  const script = "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $v=@($s.GetInstalledVoices() | ForEach-Object { [PSCustomObject]@{ name=$_.VoiceInfo.Name; culture=$_.VoiceInfo.Culture.Name; gender=$_.VoiceInfo.Gender.ToString() } }); $s.Dispose(); [Console]::Write(($v | ConvertTo-Json -Compress))";
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-1000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `读取 Windows 音色失败 (${code})`));
      try { const voices = JSON.parse(stdout || '[]'); resolve(Array.isArray(voices) ? voices : [voices]); }
      catch { reject(new Error('Windows 音色列表解析失败。')); }
    });
  });
});

ipcMain.handle('tts:list-edge-voices', async () => edgeVoices);

ipcMain.handle('ai:split-script', async (_event, { settings, script }) => {
  if (!settings.apiKey) throw new Error('请先填写 AI API 密钥。');
  const result = await requestJson(endpoint(settings.aiBaseUrl, 'chat/completions'), settings.apiKey, {
    model: settings.aiModel || 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是短视频旁白编辑。将用户文稿拆分成适合逐句朗读和逐屏显示的中文题词。保留原意、句子完整性和顺序，不添加事实；不要按固定字数截断。短句按完整句子拆分，长句仅在逗号、分号等自然停顿处分段；每段尽量控制在约34个汉字内，允许因完整句意略超出。仅输出 JSON 对象：{"segments":["句子1","句子2"]}。适合 16:9 白底黑字视频居中展示，题词通常显示为最多两行。' },
      { role: 'user', content: script },
    ],
  });
  const content = result.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content || '{}');
  if (!Array.isArray(parsed.segments) || !parsed.segments.length) throw new Error('AI 没有返回有效的句子列表。');
  return parsed.segments.map((text) => ({ text: String(text).trim(), audio: null, duration: 0 })).filter((item) => item.text);
});

ipcMain.handle('tts:generate', async (_event, { settings, text }) => {
  if (settings.ttsMode === 'edge-tts') {
    const selectedVoice = edgeVoices.some((voice) => voice.id === settings.ttsVoice)
      ? settings.ttsVoice
      : edgeVoices[0].id;
    const rate = Math.round((Number(settings.ttsRate || 1.1) - 1) * 100);
    const audioPath = path.join(app.getPath('temp'), `video-studio-edge-${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`);
    try {
      const tts = new EdgeTTS({ voice: selectedVoice, lang: selectedVoice.slice(0, 5), rate: `${rate >= 0 ? '+' : ''}${rate}%`, timeout: 30000 });
      await tts.ttsPromise(text, audioPath);
      return { data: (await fs.readFile(audioPath)).toString('base64'), mimeType: 'audio/mpeg' };
    } catch (error) {
      throw new Error(`微软 Edge 在线语音生成失败：${error.message}`);
    } finally {
      await fs.rm(audioPath, { force: true });
    }
  }
  if (settings.ttsMode === 'windows-offline') {
    if (process.platform !== 'win32') throw new Error('Windows 离线语音仅在 Windows 桌面版可用。');
    const id = `video-studio-tts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const textPath = path.join(app.getPath('temp'), `${id}.txt`);
    const audioPath = path.join(app.getPath('temp'), `${id}.wav`);
    const script = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Speech; $text=[System.IO.File]::ReadAllText($env:STUDIO_TEXT_PATH,[System.Text.Encoding]::UTF8); $synth=New-Object System.Speech.Synthesis.SpeechSynthesizer; $available=$synth.GetInstalledVoices(); $chosen=$available | Where-Object { $_.VoiceInfo.Name -eq $env:STUDIO_VOICE } | Select-Object -First 1; if (-not $chosen) { $chosen=$available | Where-Object { $_.VoiceInfo.Culture.Name -eq 'zh-CN' -and $_.VoiceInfo.Gender.ToString() -eq 'Female' } | Select-Object -First 1 }; if (-not $chosen) { $chosen=$available | Where-Object { $_.VoiceInfo.Culture.Name -eq 'zh-CN' } | Select-Object -First 1 }; if (-not $chosen) { throw 'Install a Chinese Windows speech voice or select a matching voice name.' }; $synth.SelectVoice($chosen.VoiceInfo.Name); $rate=[int][Math]::Round(([double]$env:STUDIO_RATE-1)*10); $synth.Rate=[Math]::Max(-10,[Math]::Min(10,$rate)); $synth.SetOutputToWaveFile($env:STUDIO_WAV_PATH); $synth.Speak($text); $synth.Dispose()";
    await fs.writeFile(textPath, text, 'utf8');
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
          windowsHide: true,
          env: { ...process.env, STUDIO_TEXT_PATH: textPath, STUDIO_WAV_PATH: audioPath, STUDIO_VOICE: settings.ttsVoice || '', STUDIO_RATE: String(settings.ttsRate || 1.1) },
        });
        let errorText = '';
        child.stderr.on('data', (chunk) => { errorText = `${errorText}${chunk}`.slice(-2000); });
        child.on('error', (error) => reject(new Error(`无法启动 Windows 离线语音：${error.message}`)));
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Windows 离线语音失败：${errorText || `退出码 ${code}`}`)));
      });
      return { data: (await fs.readFile(audioPath)).toString('base64'), mimeType: 'audio/wav' };
    } finally {
      await Promise.all([fs.rm(textPath, { force: true }), fs.rm(audioPath, { force: true })]);
    }
  }
  if (!settings.apiKey) throw new Error('请先填写 TTS API 密钥。');
  const response = await fetch(endpoint(settings.ttsBaseUrl || settings.aiBaseUrl, 'audio/speech'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.ttsModel || 'gpt-4o-mini-tts',
      voice: settings.ttsVoice || 'alloy',
      speed: Number(settings.ttsRate || 1.1),
      input: text,
      response_format: 'mp3',
    }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`语音生成失败 (${response.status}): ${message.slice(0, 400)}`);
  }
  return { data: Buffer.from(await response.arrayBuffer()).toString('base64'), mimeType: 'audio/mpeg' };
});

ipcMain.handle('image:choose', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : `image/${extension.slice(1)}`;
  return { name: path.basename(filePath), dataUrl: `data:${mime};base64,${data.toString('base64')}` };
});

ipcMain.handle('video:export', async (event, { bytes, settings, project }) => {
  const root = workspacePath(settings || {});
  const projectTitle = projectName(project?.script);
  const { folderPath: projectPath } = await createProjectFolder(root, projectTitle);
  let outputPath = path.join(projectPath, `${projectTitle}.mp4`);
  await writeProjectBundle(projectPath, settings, { ...project, title: projectTitle }, path.basename(outputPath));
  if (!app.isPackaged && process.env.STUDIO_SMOKE_OUTPUT) {
    const smokeOutput = path.resolve(process.env.STUDIO_SMOKE_OUTPUT);
    await fs.mkdir(path.dirname(smokeOutput), { recursive: true });
    outputPath = smokeOutput;
  } else {
    // Projects are saved into the selected workspace so their metadata stays beside the video.
  }

  const tempPath = path.join(app.getPath('temp'), `video-studio-${Date.now()}.webm`);
  await fs.writeFile(tempPath, Buffer.from(bytes));
  const bundledFfmpeg = path.join(process.resourcesPath, 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  const ffmpeg = process.env.FFMPEG_PATH || (app.isPackaged ? bundledFfmpeg : 'ffmpeg');
  const dimensions = { '854x480': [854, 480], '1280x720': [1280, 720], '1920x1080': [1920, 1080] }[project?.resolution] || [1280, 720];
  const ffmpegArgs = ['-y', '-i', tempPath, '-progress', 'pipe:1', '-nostats', '-vf', `scale=${dimensions[0]}:${dimensions[1]}:flags=lanczos`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p'];
  if (project?.includeAudio !== false) ffmpegArgs.push('-c:a', 'aac');
  ffmpegArgs.push('-movflags', '+faststart', outputPath);
  await new Promise((resolve, reject) => {
    const duration = Math.max(1, Number(project?.duration) || 60);
    const child = spawn(ffmpeg, ffmpegArgs, { windowsHide: true });
    let errorText = '';
    let progressLine = '';
    child.stdout.on('data', (chunk) => {
      progressLine += chunk.toString('utf8');
      const lines = progressLine.split(/\r?\n/);
      progressLine = lines.pop() || '';
      const timeLine = lines.findLast((line) => line.startsWith('out_time_ms='));
      if (timeLine) {
        const ratio = Math.min(0.99, Math.max(0, Number(timeLine.slice(12)) / (duration * 1000000)));
        event.sender.send('video:progress', { phase: 'convert', percent: 72 + ratio * 27 });
      }
    });
    child.stderr.on('data', (chunk) => { errorText = `${errorText}${chunk}`.slice(-3000); });
    child.on('error', (error) => reject(new Error(`无法启动 FFmpeg：${error.message}`)));
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`MP4 导出失败。${errorText.slice(-1000)}`)));
  }).finally(() => fs.rm(tempPath, { force: true }));
  if (!process.env.STUDIO_SKIP_EXPORT_DIALOG) {
    const result = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
      type: 'info',
      title: '视频导出完成',
      message: 'MP4 已成功导出',
      detail: `视频和本次模板配置已保存到：\n${projectPath}`,
      buttons: ['打开视频', '打开项目文件夹', '完成'],
      defaultId: 2,
      cancelId: 2,
    });
    if (result.response === 0) await shell.openPath(outputPath);
    if (result.response === 1) await shell.openPath(projectPath);
  }
  return { canceled: false, filePath: outputPath, projectPath };
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#f5f6f8',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (!app.isPackaged) window.loadURL('http://127.0.0.1:5173');
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
