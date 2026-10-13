import { useCallback, useEffect, useRef, useState } from 'react';
import bambooImage from '../assets/presets/bamboo-slips.png?inline';
import openBookImage from '../assets/presets/open-book.png?inline';
import bookCoverImage from '../assets/presets/book-cover.png?inline';
import bookPenImage from '../assets/presets/book-and-pen.png?inline';
import knowledgeImage from '../assets/presets/knowledge-desk.png?inline';
import sampleXiaoxiao from '../assets/voices/zh-CN-XiaoxiaoNeural.mp3?url';
import sampleXiaoyi from '../assets/voices/zh-CN-XiaoyiNeural.mp3?url';
import sampleHsiaoChen from '../assets/voices/zh-TW-HsiaoChenNeural.mp3?url';
import sampleHsiaoYu from '../assets/voices/zh-TW-HsiaoYuNeural.mp3?url';
import sampleXiaobei from '../assets/voices/zh-CN-liaoning-XiaobeiNeural.mp3?url';
import sampleXiaoni from '../assets/voices/zh-CN-shaanxi-XiaoniNeural.mp3?url';
import sampleYunjian from '../assets/voices/zh-CN-YunjianNeural.mp3?url';
import sampleYunxi from '../assets/voices/zh-CN-YunxiNeural.mp3?url';
import sampleYunyang from '../assets/voices/zh-CN-YunyangNeural.mp3?url';

const MAX_LINE_CHARS = 17;
const SOFT_SEGMENT_CHARS = 34;
const voiceSamples = {
  'zh-CN-XiaoxiaoNeural': sampleXiaoxiao,
  'zh-CN-XiaoyiNeural': sampleXiaoyi,
  'zh-TW-HsiaoChenNeural': sampleHsiaoChen,
  'zh-TW-HsiaoYuNeural': sampleHsiaoYu,
  'zh-CN-liaoning-XiaobeiNeural': sampleXiaobei,
  'zh-CN-shaanxi-XiaoniNeural': sampleXiaoni,
  'zh-CN-YunjianNeural': sampleYunjian,
  'zh-CN-YunxiNeural': sampleYunxi,
  'zh-CN-YunyangNeural': sampleYunyang,
};
const defaultEdgeVoices = [
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
const imagePresets = [
  { name: '竹简', dataUrl: bambooImage },
  { name: '打开的书', dataUrl: openBookImage },
  { name: '书籍封面', dataUrl: bookCoverImage },
  { name: '书与笔', dataUrl: bookPenImage },
  { name: '知识桌面', dataUrl: knowledgeImage },
];

const defaults = {
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini',
  apiKey: '',
  aiProfiles: [
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' },
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: '' },
  ],
  selectedAiProfile: 'openai',
  ttsMode: 'edge-tts',
  ttsBaseUrl: '',
  ttsModel: 'gpt-4o-mini-tts',
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsRate: 1.1,
  includeAudio: true,
  exportResolution: '1280x720',
  workspaceDirectory: '',
  imageScale: 1,
  captionFontSize: 56,
  headerLeft: '认知提升 · 自我觉醒',
  headerRight: '个人观点 · 禁止搬运',
  author: '@你的作者名',
  image: { name: '书与笔', dataUrl: bookPenImage },
};

const desktop = window.studio;
const bridge = desktop || {
  loadSettings: async () => {
    try { return JSON.parse(localStorage.getItem('whiteboard-video-settings') || '{}'); }
    catch { return {}; }
  },
  saveSettings: async (settings) => {
    const { apiKey, ...safeSettings } = settings;
    localStorage.setItem('whiteboard-video-settings', JSON.stringify(safeSettings));
  },
  splitScript: async () => { throw new Error('AI 拆句请在 Electron 桌面版中使用。'); },
  generateSpeech: async () => { throw new Error('语音生成请在 Electron 桌面版中使用。'); },
  chooseImage: async () => { throw new Error('图片选择请在 Electron 桌面版中使用。'); },
  exportVideo: async () => { throw new Error('视频导出请在 Electron 桌面版中使用。'); },
  saveDraft: async ({ settings, project }) => {
    const drafts = JSON.parse(localStorage.getItem('whiteboard-video-drafts') || '[]');
    const folder = `${new Date().toLocaleString()}_${project.script.slice(0, 24)}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
    localStorage.setItem('whiteboard-video-drafts', JSON.stringify([{ folder, script: project.script, segments: project.segments.map(({ audio, ...segment }) => segment), settings: { headerLeft: settings.headerLeft, headerRight: settings.headerRight, author: settings.author } }, ...drafts]));
    return { folder };
  },
  chooseWorkspace: async () => null,
  listProjects: async () => ({ projects: [], total: 0, page: 1, pageSize: 8 }),
  openProjectFile: async () => {},
};

const toBlob = (audio) => {
  const binary = atob(audio.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: audio.mimeType || 'audio/mpeg' });
};

function splitPlainText(script) {
  return script
    .split(/\n+/u)
    .flatMap((line) => line.split(/(?<=[。！？!?])\s*/u))
    .map((text) => text.trim())
    .filter(Boolean)
    .flatMap(splitWithinLimit)
    .map((text) => ({ text, audio: null, duration: 0 }));
}

function splitWithinLimit(text) {
  const chars = Array.from(text);
  const parts = [];
  let start = 0;
  while (chars.length - start > SOFT_SEGMENT_CHARS) {
    let boundary = -1;
    const preferredStart = start + Math.floor(SOFT_SEGMENT_CHARS * 0.55);
    const preferredEnd = Math.min(chars.length - 1, start + SOFT_SEGMENT_CHARS - 1);
    for (let index = preferredEnd; index >= preferredStart; index -= 1) {
      if (/[，、；：,;:]/u.test(chars[index])) { boundary = index + 1; break; }
    }
    if (boundary < 0) {
      const nextPause = chars.findIndex((char, index) => index >= start + SOFT_SEGMENT_CHARS && /[，、；：,;:。！？!?]/u.test(char));
      if (nextPause >= 0) boundary = nextPause + 1;
    }
    if (boundary < 0) break;
    parts.push(chars.slice(start, boundary).join(''));
    start = boundary;
  }
  if (start < chars.length) parts.push(chars.slice(start).join(''));
  return parts;
}

function clampCharacters(text) {
  return Array.from(text).slice(0, MAX_LINE_CHARS).join('');
}

function clockTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function audioDuration(audio) {
  return new Promise((resolve) => {
    const element = new Audio(URL.createObjectURL(toBlob(audio)));
    element.onloadedmetadata = () => { URL.revokeObjectURL(element.src); resolve(Number.isFinite(element.duration) ? element.duration : 0); };
    element.onerror = () => { URL.revokeObjectURL(element.src); resolve(0); };
  });
}

async function makeBlackWhite(dataUrl) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 512, 512);
  const scale = Math.min(480 / image.width, 480 / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (512 - width) / 2, (512 - height) / 2, width, height);
  const pixels = context.getImageData(0, 0, 512, 512);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance = 0.2126 * pixels.data[index] + 0.7152 * pixels.data[index + 1] + 0.0722 * pixels.data[index + 2];
    const value = luminance < 205 ? 0 : 255;
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}

function drawText(ctx, text, x, y, maxWidth, lineHeight) {
  const originalFont = ctx.font;
  let fontSize = Number.parseFloat(originalFont.match(/([\d.]+)px/)?.[1]) || 56;
  const wrap = () => {
    const lines = [];
    let line = '';
    for (const char of Array.from(text || '')) {
      if (line && ctx.measureText(`${line}${char}`).width > maxWidth) {
        if (/\p{P}/u.test(char)) { line += char; lines.push(line); line = ''; }
        else { lines.push(line); line = char; }
      }
      else if (!line && lines.length && /\p{P}/u.test(char)) lines[lines.length - 1] += char;
      else line += char;
    }
    if (line) lines.push(line);
    return lines;
  };
  let lines = wrap();
  while (lines.length > 2 && fontSize > 20) {
    fontSize = Math.max(20, fontSize - 2);
    ctx.font = originalFont.replace(/[\d.]+px/, `${fontSize}px`);
    lines = wrap();
  }
  const adjustedLineHeight = Math.min(lineHeight, Math.max(28, fontSize * 1.25));
  const offset = ((lines.length - 1) * adjustedLineHeight) / 2;
  lines.forEach((value, index) => ctx.fillText(value, x, y - offset + index * adjustedLineHeight));
  ctx.font = originalFont;
}

function paintFrame(canvas, segment, settings, image) {
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 1280, 720);
  context.fillStyle = '#171717';
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.font = '600 39px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  context.fillText(settings.headerLeft || '', 62, 62, 590);
  context.textAlign = 'right';
  context.fillText(settings.headerRight || '', 1218, 62, 520);

  if (image) {
    const imageSize = 205 * Math.min(1.5, Math.max(0.6, Number(settings.imageScale) || 1));
    context.drawImage(image, (1280 - imageSize) / 2, 166 + (205 - imageSize) / 2, imageSize, imageSize);
  }

  context.fillStyle = '#050505';
  const captionFontSize = Math.min(72, Math.max(38, Number(settings.captionFontSize) || defaults.captionFontSize));
  context.font = `700 ${captionFontSize}px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`;
  context.textAlign = 'center';
  drawText(context, segment?.text || '题词将在这里显示', 640, 530, 1080, 72);
  context.font = '600 34px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  context.fillText(settings.author || '', 640, 654, 900);
}

function loadImage(dataUrl) {
  if (!dataUrl) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('中心图片无法读取。'));
    image.src = dataUrl;
  });
}

export default function App() {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [settings, setSettings] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const [script, setScript] = useState('它只关乎一个最朴素的事实。\n用意志力压制本能。');
  const [segments, setSegments] = useState(splitPlainText('它只关乎一个最朴素的事实。\n用意志力压制本能。'));
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [ttsVoices, setTtsVoices] = useState([]);
  const [edgeVoices, setEdgeVoices] = useState(defaultEdgeVoices);
  const [showManager, setShowManager] = useState(false);
  const [projectPage, setProjectPage] = useState(1);
  const [projectData, setProjectData] = useState({ projects: [], total: 0, page: 1, pageSize: 8 });
  const [exportProgress, setExportProgress] = useState(0);
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
  const voicePreviewRef = useRef(null);
  const segmentPreviewRef = useRef(null);
  const [segmentPreviewIndex, setSegmentPreviewIndex] = useState(null);
  const [segmentPreviewPaused, setSegmentPreviewPaused] = useState(false);
  const [speechPlan, setSpeechPlan] = useState(null);

  useEffect(() => {
    bridge.loadSettings().then((saved) => setSettings({
      ...defaults,
      ...saved,
      ttsMode: saved.ttsMode === 'windows-offline' ? 'edge-tts' : (saved.ttsMode || defaults.ttsMode),
      ttsVoice: saved.ttsMode === 'windows-offline' || !saved.ttsVoice ? defaults.ttsVoice : saved.ttsVoice,
      aiProfiles: Array.isArray(saved.aiProfiles) ? saved.aiProfiles : defaults.aiProfiles.map((profile) => profile.id === 'openai' ? { ...profile, baseUrl: saved.aiBaseUrl || profile.baseUrl, model: saved.aiModel || profile.model, apiKey: saved.apiKey || '' } : profile),
      selectedAiProfile: saved.selectedAiProfile || 'openai',
      headerLeft: clampCharacters(saved.headerLeft ?? defaults.headerLeft),
      headerRight: clampCharacters(saved.headerRight ?? defaults.headerRight),
      imageScale: Math.min(1.5, Math.max(0.6, Number(saved.imageScale ?? defaults.imageScale) || defaults.imageScale)),
      captionFontSize: Math.min(72, Math.max(38, Number(saved.captionFontSize ?? defaults.captionFontSize) || defaults.captionFontSize)),
      image: saved.image?.dataUrl ? saved.image : defaults.image,
    })).catch(() => {}).finally(() => setLoaded(true));
    (bridge.listSpeechVoices ? bridge.listSpeechVoices() : Promise.resolve([])).then((voices) => setTtsVoices(Array.isArray(voices) ? voices : [])).catch(() => {});
    (bridge.listEdgeVoices ? bridge.listEdgeVoices() : Promise.resolve(defaultEdgeVoices)).then((voices) => setEdgeVoices(Array.isArray(voices) && voices.length ? voices : defaultEdgeVoices)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!desktop || !showManager) return;
    bridge.listProjects({ directory: settings.workspaceDirectory, page: projectPage, pageSize: 8 }).then(setProjectData).catch((error) => setMessage(error.message));
  }, [showManager, projectPage, settings.workspaceDirectory]);

  useEffect(() => {
    if (!desktop) return undefined;
    const onProgress = (event) => setExportProgress(Math.round(event.detail.percent || 0));
    window.addEventListener('studio-video-progress', onProgress);
    return () => window.removeEventListener('studio-video-progress', onProgress);
  }, []);

  useEffect(() => {
    let canceled = false;
    loadImage(settings.image?.dataUrl).then((image) => {
      if (canceled) return;
      imageRef.current = image;
      if (canvasRef.current) paintFrame(canvasRef.current, segments[activeIndex], settings, image);
    }).catch((error) => setMessage(error.message));
    return () => { canceled = true; };
  }, [settings, segments, activeIndex]);

  const persistSettings = async (next = settings) => {
    try {
      await bridge.saveSettings(next);
      setMessage('设置已保存');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateSetting = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const activeAiProfile = settings.aiProfiles?.find((profile) => profile.id === settings.selectedAiProfile) || settings.aiProfiles?.[0];
  const selectAiProfile = (id) => {
    const profile = settings.aiProfiles?.find((item) => item.id === id);
    if (!profile) return;
    setSettings((current) => ({ ...current, selectedAiProfile: id, aiBaseUrl: profile.baseUrl, aiModel: profile.model, apiKey: profile.apiKey || '' }));
  };
  const updateAiProfile = (key, value) => setSettings((current) => {
    const profiles = (current.aiProfiles || []).map((profile) => profile.id === current.selectedAiProfile ? { ...profile, [key]: value } : profile);
    const selected = profiles.find((profile) => profile.id === current.selectedAiProfile);
    return { ...current, aiProfiles: profiles, aiBaseUrl: selected?.baseUrl || '', aiModel: selected?.model || '', apiKey: selected?.apiKey || '' };
  });
  const addAiProfile = async () => {
    const id = `custom-${Date.now()}`;
    const profile = { id, name: `自定义服务 ${(settings.aiProfiles || []).filter((item) => item.id.startsWith('custom-')).length + 1}`, baseUrl: '', model: '', apiKey: '' };
    const next = { ...settings, aiProfiles: [...(settings.aiProfiles || []), profile], selectedAiProfile: id, aiBaseUrl: '', aiModel: '', apiKey: '' };
    setSettings(next);
    await persistSettings(next);
  };
  const playVoiceSample = async () => {
    const source = voiceSamples[settings.ttsVoice];
    if (!source) return setMessage('当前音色没有内置试听样本。');
    const current = voicePreviewRef.current;
    const sourceUrl = new URL(source, window.location.href).href;
    if (current?.src === sourceUrl) {
      if (current.paused) {
        await current.play();
        setVoicePreviewPlaying(true);
      } else {
        current.pause();
        setVoicePreviewPlaying(false);
      }
      return;
    }
    try {
      current?.pause();
      const audio = new Audio(source);
      voicePreviewRef.current = audio;
      audio.onended = () => setVoicePreviewPlaying(false);
      audio.onerror = () => setVoicePreviewPlaying(false);
      await audio.play();
      setVoicePreviewPlaying(true);
    }
    catch (error) { setMessage(`试听播放失败：${error.message}`); }
  };
  const stopVoiceSample = () => {
    if (!voicePreviewRef.current) return;
    voicePreviewRef.current.pause();
    voicePreviewRef.current.currentTime = 0;
    setVoicePreviewPlaying(false);
  };
  const stopSegmentPreview = () => {
    const audio = segmentPreviewRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      URL.revokeObjectURL(audio.src);
      segmentPreviewRef.current = null;
    }
    setSegmentPreviewIndex(null);
    setSegmentPreviewPaused(false);
  };
  const updateSegment = (index, patch) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const handleAiSplit = async () => {
    if (!script.trim()) return setMessage('先输入文稿再拆分。');
    setBusy('ai');
    setMessage('AI 正在拆分文稿…');
    try {
      const result = await bridge.splitScript({ settings, script });
      setSegments(result.flatMap((item) => splitWithinLimit(String(item.text || '').trim()).map((text) => ({ ...item, text, audio: null, duration: 0 }))));
      setActiveIndex(0);
      setMessage(`已生成 ${result.length} 个题词段落`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  };

  const handleManualSplit = () => {
    const result = splitPlainText(script);
    setSegments(result);
    setActiveIndex(0);
    setMessage(`已按标点拆分为 ${result.length} 段`);
  };

  const chooseImage = async () => {
    const image = await bridge.chooseImage();
    if (!image) return;
    const next = { ...settings, image: { ...image, dataUrl: await makeBlackWhite(image.dataUrl) } };
    setSettings(next);
    await persistSettings(next);
  };

  const selectPreset = async (preset) => {
    const next = { ...settings, image: { name: preset.name, dataUrl: await makeBlackWhite(preset.dataUrl) } };
    setSettings(next);
    await persistSettings(next);
  };

  const generateAudio = () => {
    if (!segments.length) return setMessage('请先添加题词段落。');
    const generated = segments.map((segment, index) => segment.audio ? index : -1).filter((index) => index >= 0);
    const missing = segments.map((segment, index) => segment.audio ? -1 : index).filter((index) => index >= 0);
    setSpeechPlan({ generated, missing });
  };

  const runAudioGeneration = async (mode) => {
    const targets = mode === 'all' ? segments.map((_, index) => index) : speechPlan?.missing || [];
    setSpeechPlan(null);
    if (!targets.length) return setMessage('所有题词都已有语音，无需补生成。');
    if (mode === 'all') setSegments((current) => current.map((segment) => ({ ...segment, audio: null, duration: 0 })));
    stopSegmentPreview();
    setBusy('tts');
    for (let position = 0; position < targets.length; position += 1) {
      const index = targets[position];
      setActiveIndex(index);
      setMessage(`正在生成语音 ${position + 1}/${targets.length}（第 ${index + 1} 段）…`);
      try {
        let audio;
        for (let attempt = 0; attempt < (settings.ttsMode === 'edge-tts' ? 3 : 1); attempt += 1) {
          try {
            audio = await bridge.generateSpeech({ settings, text: segments[index].text });
            break;
          } catch (error) {
            if (attempt >= 2) throw error;
            setMessage(`第 ${index + 1} 段暂时失败，等待后重试（${attempt + 1}/2）…`);
            await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
          }
        }
        const duration = await audioDuration(audio);
        updateSegment(index, { audio, duration });
        if (settings.ttsMode === 'edge-tts' && position < targets.length - 1) await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        setMessage(`第 ${index + 1}/${segments.length} 段语音生成失败：${error.message}`);
        setBusy('');
        return;
      }
    }
    setMessage(mode === 'all' ? '所有题词语音已重新生成' : '缺失的题词语音已补齐');
    setBusy('');
  };

  const createNewProject = async () => {
    if (busy) return;
    setBusy('save');
    setMessage('正在保存当前项目…');
    try {
      const elapsed = segments.reduce((sum, segment) => sum + (segment.duration || 0), 0);
      const result = await bridge.saveDraft({
        settings,
        project: {
          title: script.trim().split(/(?<=[。！？!?])/u, 1)[0] || script.slice(0, 48),
          script,
          includeAudio: settings.includeAudio,
          resolution: settings.exportResolution,
          segments: segments.map((segment, index) => ({
            index: index + 1, text: segment.text, duration: segment.duration || 0, audio: segment.audio,
            startTime: clockTime(segments.slice(0, index).reduce((sum, item) => sum + (item.duration || 0), 0)),
            endTime: clockTime(segments.slice(0, index + 1).reduce((sum, item) => sum + (item.duration || 0), 0)),
          })),
          duration: elapsed,
        },
      });
      setScript('');
      setSegments([]);
      setActiveIndex(0);
      setShowManager(false);
      setShowSettings(false);
      setMessage(`当前项目已保存：${result.folder}，已新建空白项目`);
      if (desktop) setProjectData(await bridge.listProjects({ directory: settings.workspaceDirectory, page: 1, pageSize: 8 }));
    } catch (error) {
      setMessage(`保存当前项目失败：${error.message}`);
    } finally { setBusy(''); }
  };

  const previewAudio = async (segment, index) => {
    if (!segment.audio) return setMessage('这一段还没有语音，请先生成。');
    const current = segmentPreviewRef.current;
    if (segmentPreviewIndex === index && current) {
      if (current.paused) {
        await current.play();
        setSegmentPreviewPaused(false);
      } else {
        current.pause();
        setSegmentPreviewPaused(true);
      }
      return;
    }
    stopSegmentPreview();
    const audio = new Audio(URL.createObjectURL(toBlob(segment.audio)));
    segmentPreviewRef.current = audio;
    setSegmentPreviewIndex(index);
    setSegmentPreviewPaused(false);
    audio.onended = () => {
      URL.revokeObjectURL(audio.src);
      if (segmentPreviewRef.current === audio) {
        segmentPreviewRef.current = null;
        setSegmentPreviewIndex(null);
        setSegmentPreviewPaused(false);
      }
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      if (segmentPreviewRef.current === audio) {
        segmentPreviewRef.current = null;
        setSegmentPreviewIndex(null);
        setSegmentPreviewPaused(false);
      }
      setMessage('这段语音播放失败。');
    };
    try { await audio.play(); }
    catch (error) { stopSegmentPreview(); setMessage(`语音播放失败：${error.message}`); }
  };

  const exportVideo = async () => {
    if (!segments.length) return setMessage('请先添加题词段落。');
    if (settings.includeAudio && segments.some((segment) => !segment.audio)) return setMessage('请先生成全部语音，或取消“包含声音”后导出无声视频。');
    if (!canvasRef.current) return;
    stopSegmentPreview();
    setBusy('export');
    setExportProgress(0);
    setMessage('正在录制画面和语音…');
    const audioContext = settings.includeAudio ? new AudioContext() : null;
    const audioOutput = audioContext?.createMediaStreamDestination() || null;
    if (audioContext?.state === 'suspended') await audioContext.resume();
    const canvasStream = canvasRef.current.captureStream(30);
    const stream = new MediaStream([...canvasStream.getVideoTracks(), ...(audioOutput?.stream.getAudioTracks() || [])]);
    const recorder = new MediaRecorder(stream, { mimeType: settings.includeAudio ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9' });
    const segmentDurations = [];
    let frameTimer = null;
    let frameSegment = segments[activeIndex];
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const completed = new Promise((resolve, reject) => {
      recorder.onerror = () => reject(new Error('浏览器录制失败。'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });
    recorder.start();
    frameTimer = window.setInterval(() => paintFrame(canvasRef.current, frameSegment, settings, imageRef.current), 1000 / 30);
    try {
      for (let index = 0; index < segments.length; index += 1) {
        frameSegment = segments[index];
        setActiveIndex(index);
        await paintFrame(canvasRef.current, segments[index], settings, imageRef.current);
        await new Promise((resolve) => setTimeout(resolve, 50));
        setMessage(`正在录制题词 ${index + 1}/${segments.length}…`);
        setExportProgress(Math.round(((index + 1) / segments.length) * 70));
        if (settings.includeAudio) {
          const audioElement = new Audio(URL.createObjectURL(toBlob(segments[index].audio)));
          const source = audioContext.createMediaElementSource(audioElement);
          source.connect(audioOutput);
          const playbackStartedAt = performance.now();
          await new Promise((resolve, reject) => {
            audioElement.onended = resolve;
            audioElement.onerror = () => reject(new Error(`第 ${index + 1} 段语音无法播放。`));
            audioElement.play().catch(reject);
          });
          segmentDurations[index] = (performance.now() - playbackStartedAt) / 1000;
          source.disconnect();
          URL.revokeObjectURL(audioElement.src);
        } else {
          segmentDurations[index] = Math.max(0.1, segments[index].duration || 2.5);
          await new Promise((resolve) => setTimeout(resolve, segmentDurations[index] * 1000));
        }
      }
      if (frameTimer) window.clearInterval(frameTimer);
      frameTimer = null;
      recorder.stop();
      const blob = await completed;
      setMessage('正在转换 MP4…');
      const totalDuration = segmentDurations.reduce((sum, duration) => sum + (duration || 0), 0);
      if (settings.includeAudio) setSegments((current) => current.map((segment, index) => ({ ...segment, duration: segmentDurations[index] || segment.duration })));
      const result = await bridge.exportVideo({
        bytes: await blob.arrayBuffer(),
        settings: { ...settings, includeAudio: settings.includeAudio, exportResolution: settings.exportResolution },
        project: { script, includeAudio: settings.includeAudio, resolution: settings.exportResolution, segments: segments.map(({ text, audio }, index) => ({ index: index + 1, text, duration: segmentDurations[index], audio, startTime: clockTime(segmentDurations.slice(0, index).reduce((sum, duration) => sum + (duration || 0), 0)), endTime: clockTime(segmentDurations.slice(0, index + 1).reduce((sum, duration) => sum + (duration || 0), 0)) })), duration: totalDuration },
      });
      if (!result.canceled) {
        setExportProgress(100);
        setMessage(`视频已保存：${result.filePath}`);
        setProjectPage(1);
        if (showManager) setProjectData(await bridge.listProjects({ directory: settings.workspaceDirectory, page: 1, pageSize: 8 }));
      }
    } catch (error) {
      if (recorder.state !== 'inactive') recorder.stop();
      setMessage(error.message);
    } finally {
      if (frameTimer) window.clearInterval(frameTimer);
      canvasStream.getTracks().forEach((track) => track.stop());
      audioOutput?.stream.getTracks().forEach((track) => track.stop());
      if (audioContext) await audioContext.close();
      setBusy('');
      setActiveIndex(0);
    }
  };

  const addSegment = (index = segments.length) => {
    setSegments((current) => [...current.slice(0, index), { text: '新题词', audio: null, duration: 0 }, ...current.slice(index)]);
  };

  const changeSegmentOrder = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= segments.length) return;
    setSegments((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setActiveIndex(target);
  };

  const selected = segments[activeIndex];

  return (
    <main className="app-shell">
        <header className="topbar">
        <div className="brand-mark">白</div>
        <div className="brand-copy"><strong>白板视频工作室</strong><span>文字 · 语音 · 视频</span></div>
        <button className="button button-quiet management-nav" onClick={() => { setShowManager(true); setShowSettings(false); setProjectPage(1); }}>管理台</button>
        <button className="button button-quiet new-project-nav" disabled={Boolean(busy)} onClick={createNewProject}>＋ 新建</button>
        <div className="topbar-spacer" />
        <span className="status-text" aria-live="polite">{message || (!desktop ? '浏览器预览 · 桌面端启用完整功能' : loaded ? '本地草稿' : '正在载入…')}</span>
        {showManager ? <button className="button button-quiet" onClick={() => setShowManager(false)}>返回工作台</button> : <button className="button button-quiet" onClick={() => setShowSettings((value) => !value)}>{showSettings ? '返回工作区' : 'AI / 语音设置'}</button>}
        <label className="export-audio-option"><input type="checkbox" checked={settings.includeAudio !== false} onChange={(event) => updateSetting('includeAudio', event.target.checked)} />包含声音</label>
        <label className="export-resolution-option"><span>分辨率</span><select value={settings.exportResolution || '1280x720'} onChange={(event) => updateSetting('exportResolution', event.target.value)}><option value="854x480">480p</option><option value="1280x720">720p</option><option value="1920x1080">1080p</option></select></label>
        <button className="button button-primary" disabled={Boolean(busy)} onClick={exportVideo}>{busy === 'export' ? '正在导出…' : '导出 MP4'}</button>
      </header>

      {busy === 'export' && <div className="export-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={exportProgress}><div style={{ width: `${exportProgress}%` }} /><span>正在导出 {exportProgress}%</span></div>}

      {speechPlan && <div className="speech-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSpeechPlan(null); }}>
        <section className="speech-dialog" role="dialog" aria-modal="true" aria-labelledby="speech-dialog-title">
          <div className="speech-dialog-heading"><div><span className="eyebrow">语音检查</span><h2 id="speech-dialog-title">已有语音检查结果</h2></div><button className="icon-button" aria-label="关闭" onClick={() => setSpeechPlan(null)}>×</button></div>
          <p className="speech-summary">共 {segments.length} 段 · 已生成 {speechPlan.generated.length} 段 · 未生成 {speechPlan.missing.length} 段</p>
          <div className="speech-lists">
            <div><strong>已生成</strong><p>{speechPlan.generated.length ? speechPlan.generated.map((index) => `${String(index + 1).padStart(2, '0')} ${segments[index].text}`).join('\n') : '暂无'}</p></div>
            <div><strong>未生成</strong><p>{speechPlan.missing.length ? speechPlan.missing.map((index) => `${String(index + 1).padStart(2, '0')} ${segments[index].text}`).join('\n') : '暂无'}</p></div>
          </div>
          <div className="speech-dialog-actions"><button className="button button-quiet" onClick={() => setSpeechPlan(null)}>取消</button><button className="button button-quiet" disabled={!speechPlan.missing.length} onClick={() => runAudioGeneration('missing')}>只生成缺失 {speechPlan.missing.length} 段</button><button className="button button-primary" onClick={() => runAudioGeneration('all')}>全部重新生成 {segments.length} 段</button></div>
        </section>
      </div>}

      {showManager ? (
        <section className="manager-page">
          <div className="page-heading"><div><h1>视频管理台</h1><p>视频、脚本和项目描述统一保存在工作目录。</p></div></div>
          <section className="settings-section workspace-setting">
            <h2>当前工作目录</h2>
            <div className="workspace-path"><input readOnly value={settings.workspaceDirectory || '文档\视频工作室管理数据'} /><button className="button button-quiet" onClick={async () => { if (!desktop) { setMessage('请选择 Electron 桌面工作台中的“更改目录”；浏览器预览无法打开本地文件夹选择器。'); return; } try { const directory = await bridge.chooseWorkspace(settings.workspaceDirectory); if (!directory) return; const next = { ...settings, workspaceDirectory: directory }; setSettings(next); await persistSettings(next); setProjectPage(1); } catch (error) { setMessage(`无法打开文件夹选择器：${error.message}`); } }}>更改目录</button></div>
          </section>
          <div className="library-heading"><div><h2>项目库</h2><span>{projectData.total} 个项目</span></div><button className="button button-quiet" onClick={() => bridge.listProjects({ directory: settings.workspaceDirectory, page: projectPage, pageSize: 8 }).then(setProjectData)}>刷新</button></div>
          <div className="project-list">
            {projectData.projects.map((project) => <article className="project-row" key={`${project.folder}-${project.createdAt}`}>
              <div className="project-thumb">{project.hasVideo ? 'MP4' : 'JSON'}</div>
              <div className="project-info"><strong>{project.title || project.folder}</strong><span>{new Date(project.createdAt).toLocaleString()} · {project.segments?.length || 0} 段 · {project.settings?.ttsVoice || '未记录音色'}</span><p>{String(project.script || '').slice(0, 100)}{String(project.script || '').length > 100 ? '…' : ''}</p></div>
              <button className="button button-quiet" disabled={!project.hasVideo} onClick={() => bridge.openProjectFile({ directory: settings.workspaceDirectory, folder: project.folder, file: project.mp4 })}>打开视频</button>
              <button className="button button-quiet" onClick={() => bridge.openProjectFile({ directory: settings.workspaceDirectory, folder: project.folder, file: 'project.json' })}>项目 JSON</button>
            </article>)}
            {!projectData.projects.length && <div className="empty-library">工作目录中还没有项目。新建或导出后会自动归档到这里。</div>}
          </div>
          <div className="library-pagination"><span>第 {projectData.page} / {Math.max(1, Math.ceil(projectData.total / projectData.pageSize))} 页</span><div><button className="button button-quiet" disabled={projectPage <= 1} onClick={() => setProjectPage((page) => Math.max(1, page - 1))}>上一页</button><button className="button button-quiet" disabled={projectPage * projectData.pageSize >= projectData.total} onClick={() => setProjectPage((page) => page + 1)}>下一页</button></div></div>
        </section>
      ) : showSettings ? (
        <section className="settings-page">
          <div className="page-heading"><div><h1>AI 与语音服务</h1><p>使用兼容 OpenAI 格式的服务接口。密钥由 Electron 本地加密保存。</p></div></div>
          <div className="settings-grid">
            <section className="settings-section"><div className="section-title"><h2>AI 文稿拆分</h2><button className="button button-quiet" onClick={addAiProfile}>＋ 新增服务</button></div>
              <label>服务配置<select value={settings.selectedAiProfile || 'openai'} onChange={(event) => selectAiProfile(event.target.value)}>{(settings.aiProfiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <label>配置名称<input value={activeAiProfile?.name || ''} onChange={(event) => updateAiProfile('name', event.target.value)} /></label>
              <label>API 地址<input value={activeAiProfile?.baseUrl ?? settings.aiBaseUrl} onChange={(event) => updateAiProfile('baseUrl', event.target.value)} placeholder="https://api.openai.com/v1" /></label>
              <label>模型名称<input value={activeAiProfile?.model ?? settings.aiModel} onChange={(event) => updateAiProfile('model', event.target.value)} placeholder="例如 gpt-4o-mini / deepseek-chat" /></label>
              <label>API 密钥<input type="password" value={activeAiProfile?.apiKey ?? settings.apiKey} onChange={(event) => updateAiProfile('apiKey', event.target.value)} autoComplete="off" /></label>
            </section>
            <section className="settings-section"><h2>文字转语音</h2>
              <label>语音方式<select value={settings.ttsMode || 'windows-offline'} onChange={(event) => { updateSetting('ttsMode', event.target.value); if (event.target.value === 'windows-offline' && !ttsVoices.some((voice) => voice.name === settings.ttsVoice)) updateSetting('ttsVoice', 'Microsoft Huihui Desktop'); if (event.target.value === 'edge-tts' && !edgeVoices.some((voice) => voice.id === settings.ttsVoice)) updateSetting('ttsVoice', 'zh-CN-XiaoxiaoNeural'); }}><option value="openai-compatible">OpenAI 兼容 API</option><option value="windows-offline">Windows 离线语音</option><option value="edge-tts">微软 Edge 在线语音</option></select></label>
              {settings.ttsMode === 'openai-compatible' && <><label>语音 API 地址<input value={settings.ttsBaseUrl} onChange={(event) => updateSetting('ttsBaseUrl', event.target.value)} placeholder="留空时沿用 AI API 地址" /></label><label>语音模型<input value={settings.ttsModel} onChange={(event) => updateSetting('ttsModel', event.target.value)} /></label></>}
              {settings.ttsMode === 'windows-offline' && ttsVoices.some((voice) => voice.culture === 'zh-CN') ? <label>Windows 音色<select value={ttsVoices.some((voice) => voice.name === settings.ttsVoice) ? settings.ttsVoice : 'Microsoft Huihui Desktop'} onChange={(event) => updateSetting('ttsVoice', event.target.value)}>{ttsVoices.filter((voice) => voice.culture === 'zh-CN').map((voice) => <option key={`${voice.name}-${voice.culture}`} value={voice.name}>{voice.name} · {voice.gender === 'Female' ? '女声' : voice.gender === 'Male' ? '男声' : voice.gender}</option>)}</select></label> : <label>音色<input value={settings.ttsVoice} onChange={(event) => updateSetting('ttsVoice', event.target.value)} /></label>}
              {settings.ttsMode === 'edge-tts' ? <><label>微软中文音色<select value={edgeVoices.some((voice) => voice.id === settings.ttsVoice) ? settings.ttsVoice : 'zh-CN-XiaoxiaoNeural'} onChange={(event) => { stopVoiceSample(); updateSetting('ttsVoice', event.target.value); }}>{edgeVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}</select></label><div className="voice-sample-controls"><button className="button button-quiet" onClick={playVoiceSample}>{voicePreviewPlaying ? 'Ⅱ 暂停试听' : voicePreviewRef.current?.paused && voicePreviewRef.current.currentTime > 0 && voicePreviewRef.current.currentTime < voicePreviewRef.current.duration ? '▶ 继续试听' : '▶ 试听当前音色'}</button><button className="button button-quiet" disabled={!voicePreviewRef.current} onClick={stopVoiceSample}>■ 停止</button></div></> : settings.ttsMode !== 'windows-offline' ? <label>音色<input value={settings.ttsVoice} onChange={(event) => updateSetting('ttsVoice', event.target.value)} /></label> : null}
              <label>语速 <span className="range-value">{Number(settings.ttsRate || 1.1).toFixed(2)} 倍</span><input type="range" min="0.9" max="1.3" step="0.05" value={settings.ttsRate || 1.1} onChange={(event) => updateSetting('ttsRate', Number(event.target.value))} /></label>
            </section>
          </div>
          <div className="settings-footer"><span>AI 拆句需要 API 密钥；Windows 离线语音无需联网；微软 Edge 语音需联网，无需 API 密钥。</span><button className="button button-primary" onClick={() => persistSettings()}>保存设置</button></div>
        </section>
      ) : (
        <div className="workspace">
          <aside className="panel left-panel">
            <div className="panel-heading"><div><span className="eyebrow">PROJECT</span><h2>固定模板</h2></div><span className="template-pill">16:9</span></div>
            <label className="field-label field-with-count">顶部左侧 <span className="char-count">{Array.from(settings.headerLeft || '').length}/{MAX_LINE_CHARS}</span><input value={settings.headerLeft} onChange={(event) => updateSetting('headerLeft', clampCharacters(event.target.value))} onBlur={() => persistSettings()} /></label>
            <label className="field-label field-with-count">顶部右侧 <span className="char-count">{Array.from(settings.headerRight || '').length}/{MAX_LINE_CHARS}</span><input value={settings.headerRight} onChange={(event) => updateSetting('headerRight', clampCharacters(event.target.value))} onBlur={() => persistSettings()} /></label>
          <label className="field-label">作者署名<input value={settings.author} onChange={(event) => updateSetting('author', event.target.value)} onBlur={() => persistSettings()} /></label>
          <div className="field-label image-heading">中心图片 <button className="upload-image" onClick={chooseImage}>本地上传</button></div>
            <div className="image-gallery">
              {imagePresets.map((preset) => <button className={`image-preset ${settings.image?.name === preset.name ? 'selected' : ''}`} key={preset.name} onClick={() => selectPreset(preset)} title={`选择${preset.name}`}><img src={preset.dataUrl} alt={preset.name} /><span>{preset.name}</span></button>)}
            </div>
            <button className="image-picker" onClick={chooseImage}>
              {settings.image?.dataUrl ? <img src={settings.image.dataUrl} alt="中心图片预览" /> : <span className="image-placeholder">＋</span>}
              <span><strong>{settings.image?.name || '选择图片'}</strong><small>PNG · JPG · WebP</small></span>
            </button>
            <label className="visual-range-control">中心图大小 <span>{Math.round((settings.imageScale || 1) * 100)}%</span><input type="range" min="0.6" max="1.5" step="0.05" value={settings.imageScale || 1} onChange={(event) => updateSetting('imageScale', Number(event.target.value))} onBlur={() => persistSettings()} /></label>
            <label className="visual-range-control">题词字号 <span>{settings.captionFontSize || 56}px</span><input aria-label="题词字号" type="range" min="38" max="72" step="1" value={settings.captionFontSize || 56} onChange={(event) => updateSetting('captionFontSize', Number(event.target.value))} onBlur={() => persistSettings()} /></label>
            <p className="field-hint">预设和上传图片均自动转为纯黑白。</p>
            <div className="panel-divider" />
            <div className="section-title"><h3>文稿</h3><span>{script.length} 字符</span></div>
            <textarea className="script-input" value={script} onChange={(event) => setScript(event.target.value)} placeholder="粘贴需要配音的文稿…" />
            <div className="split-actions"><button className="button button-quiet" onClick={handleManualSplit}>按标点拆分</button><button className="button button-accent" disabled={Boolean(busy)} onClick={handleAiSplit}>{busy === 'ai' ? 'AI 处理中…' : 'AI 辅助拆分'}</button></div>
            <div className="panel-divider" />
          </aside>

          <section className="preview-column">
            <div className="preview-toolbar"><div><span className="eyebrow">LIVE PREVIEW</span><strong>画面预览</strong></div><span>1280 × 720</span></div>
            <div className="canvas-wrap"><canvas ref={canvasRef} width="1280" height="720" aria-label="视频画面预览" /></div>
            <div className="preview-footer"><span>场景 {segments.length ? String(activeIndex + 1).padStart(2, '0') : '00'} / {String(segments.length).padStart(2, '0')}</span><div className="scene-nav"><button title="上一场景" disabled={activeIndex <= 0} onClick={() => setActiveIndex((value) => value - 1)}>←</button><button title="下一场景" disabled={activeIndex >= segments.length - 1} onClick={() => setActiveIndex((value) => value + 1)}>→</button></div><span>{selected?.audio ? `${selected.duration ? `${selected.duration.toFixed(1)} 秒` : '已配音'}` : '未配音'}</span></div>
          </section>

          <aside className="panel right-panel">
            <div className="panel-heading"><div><span className="eyebrow">TIMELINE</span><h2>题词段落</h2></div><button className="icon-button" title="添加段落" onClick={() => addSegment()}>＋</button></div>
            <button className="button button-accent generate-all-audio" disabled={Boolean(busy) || segments.length === 0} onClick={generateAudio}>{busy === 'tts' ? '正在生成语音…' : '全部生成语音'}</button>
            <div className="segment-divider" />
            <div className="segment-list">
              {segments.map((segment, index) => (
                <article className={`segment-item ${index === activeIndex ? 'active' : ''}`} key={`${index}-${segment.text.slice(0, 10)}`}>
                  <button className="segment-main" onClick={() => setActiveIndex(index)}><span className="segment-index">{String(index + 1).padStart(2, '0')}</span><span className="segment-text">{segment.text || '空题词'}</span></button>
                  <textarea aria-label={`编辑第 ${index + 1} 段题词`} value={segment.text} onChange={(event) => { if (segmentPreviewIndex === index) stopSegmentPreview(); updateSegment(index, { text: event.target.value, audio: null, duration: 0 }); }} />
                  <div className="segment-count">{Array.from(segment.text).length} 字 · 完整句优先，最多两行</div>
                  <div className="segment-tools"><span className={segment.audio ? 'audio-ready' : ''}>{segment.audio ? `${clockTime(segments.slice(0, index).reduce((sum, item) => sum + (item.duration || 0), 0))}–${clockTime(segments.slice(0, index + 1).reduce((sum, item) => sum + (item.duration || 0), 0))} · ${segment.duration ? `${segment.duration.toFixed(1)}秒` : '时长未知'}` : '待配音'}</span><div><button title={segmentPreviewIndex === index && !segmentPreviewPaused ? '暂停当前段落' : '播放当前段落'} aria-label={segmentPreviewIndex === index && !segmentPreviewPaused ? '暂停当前段落' : '播放当前段落'} disabled={!segment.audio || Boolean(busy)} onClick={() => previewAudio(segment, index)}>{segmentPreviewIndex === index && !segmentPreviewPaused ? 'Ⅱ' : '▶'}</button><button title="上移" disabled={index === 0} onClick={() => changeSegmentOrder(index, -1)}>↑</button><button title="下移" disabled={index === segments.length - 1} onClick={() => changeSegmentOrder(index, 1)}>↓</button><button title="删除段落" onClick={() => { if (segmentPreviewIndex === index) stopSegmentPreview(); setSegments((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}>×</button></div></div>
                </article>
              ))}
              {!segments.length && <div className="empty-state">拆分文稿后，题词会显示在这里。</div>}
            </div>
            <button className="add-segment" onClick={() => addSegment()}>＋ 添加题词</button>
          </aside>
        </div>
      )}
    </main>
  );
}
