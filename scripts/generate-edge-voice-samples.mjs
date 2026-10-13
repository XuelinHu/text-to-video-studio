import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EdgeTTS } from 'node-edge-tts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'output', 'voice-samples');
const sampleText = '你好，这是一段微软 Edge 中文神经语音试听。心理学研究发现，给情绪命名，能帮助我们更清楚地理解自己。';
const voices = [
  ['晓晓-女声-普通话', 'zh-CN-XiaoxiaoNeural'],
  ['晓伊-女声-普通话', 'zh-CN-XiaoyiNeural'],
  ['晓臻-女声-台湾国语', 'zh-TW-HsiaoChenNeural'],
  ['晓雨-女声-台湾国语', 'zh-TW-HsiaoYuNeural'],
  ['晓北-女声-辽宁口音', 'zh-CN-liaoning-XiaobeiNeural'],
  ['晓妮-女声-陕西口音', 'zh-CN-shaanxi-XiaoniNeural'],
  ['云健-男声-普通话', 'zh-CN-YunjianNeural'],
  ['云希-男声-普通话', 'zh-CN-YunxiNeural'],
  ['云扬-男声-普通话', 'zh-CN-YunyangNeural'],
];

await mkdir(outputDirectory, { recursive: true });
const results = [];
for (const [label, voice] of voices) {
  const outputPath = path.join(outputDirectory, `${label}.mp3`);
  try {
    const tts = new EdgeTTS({ voice, lang: voice.slice(0, 5), rate: '+10%', timeout: 30000 });
    await tts.ttsPromise(sampleText, outputPath);
    results.push({ label, voice, outputPath, ok: true });
  } catch (error) {
    results.push({ label, voice, ok: false, error: error.message });
  }
}
await writeFile(path.join(outputDirectory, '试听说明.txt'), `${sampleText}\n\n语速：+10%\n${results.map((item) => `${item.ok ? '成功' : '失败'}  ${item.label}${item.ok ? `  ${path.basename(item.outputPath)}` : `  ${item.error}`}`).join('\n')}\n`, 'utf8');
for (const item of results) console.log(item.ok ? `完成：${item.outputPath}` : `失败：${item.label}：${item.error}`);
if (results.every((item) => !item.ok)) process.exitCode = 1;
