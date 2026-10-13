import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDirectory = path.join(root, 'assets');
const publicDirectory = path.join(root, 'public');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="220" fill="#fff"/>
  <rect x="88" y="88" width="848" height="848" rx="172" fill="#f6f6f3" stroke="#171717" stroke-width="32"/>
  <path d="M512 368c-92-74-199-96-306-72v328c108-22 215 3 306 76 91-73 198-98 306-76V296c-107-24-214-2-306 72Z" fill="#fff" stroke="#171717" stroke-width="34" stroke-linejoin="round"/>
  <path d="M512 370v326M255 402c59-7 112 3 163 30M256 471c60-5 110 7 163 35M769 402c-59-7-112 3-163 30M768 471c-60-5-110 7-163 35" fill="none" stroke="#171717" stroke-width="27" stroke-linecap="round"/>
  <path d="M252 762h520" fill="none" stroke="#171717" stroke-width="30" stroke-linecap="round"/>
  <circle cx="512" cy="810" r="23" fill="#171717"/>
</svg>`;

await mkdir(assetsDirectory, { recursive: true });
await mkdir(publicDirectory, { recursive: true });
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await writeFile(path.join(assetsDirectory, 'icon.png'), png);
const ico = await pngToIco(png);
await writeFile(path.join(assetsDirectory, 'icon.ico'), ico);
await copyFile(path.join(assetsDirectory, 'icon.png'), path.join(publicDirectory, 'icon.png'));
await copyFile(path.join(assetsDirectory, 'icon.ico'), path.join(publicDirectory, 'favicon.ico'));

const iconsetPath = path.join(assetsDirectory, 'icon.iconset');
await mkdir(iconsetPath, { recursive: true });
for (const size of [16, 32, 64, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const pixelSize = size * scale;
    if (pixelSize > 1024) continue;
    const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
    const resized = await sharp(png).resize(pixelSize, pixelSize).png().toBuffer();
    await writeFile(path.join(iconsetPath, name), resized);
  }
}

if (process.platform === 'darwin') {
  execFileSync('iconutil', ['-c', 'icns', iconsetPath, '-o', path.join(assetsDirectory, 'icon.icns')]);
}
