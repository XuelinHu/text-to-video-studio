import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
let ffmpegPath;

try {
  ffmpegPath = require('ffmpeg-static');
} catch {
  // Report one actionable message for both missing package and missing binary.
}

if (!ffmpegPath || !existsSync(ffmpegPath) || statSync(ffmpegPath).size < 1024 * 1024) {
  console.error(`Missing the ${process.platform} FFmpeg binary required for MP4 export.`);
  console.error('Download the matching ffmpeg-static release binary into node_modules/ffmpeg-static, then run this build again.');
  process.exit(1);
}
