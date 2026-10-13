import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets', 'android', 'app-icon.png');
const resourceRoot = path.join(root, 'android', 'app', 'src', 'main', 'res');
const sourceImage = sharp(source);

for (const [folder, size] of [['mipmap-mdpi', 48], ['mipmap-hdpi', 72], ['mipmap-xhdpi', 96], ['mipmap-xxhdpi', 144], ['mipmap-xxxhdpi', 192]]) {
  const directory = path.join(resourceRoot, folder);
  await mkdir(directory, { recursive: true });
  const artwork = await sourceImage.clone().resize(Math.round(size * 0.72), Math.round(size * 0.72), { fit: 'inside' }).png().toBuffer();
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
    const raster = await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
      .composite([{ input: artwork, gravity: 'centre' }])
      .png()
      .toBuffer();
    await writeFile(path.join(directory, name), raster);
  }
}

for (const [folder, size] of [['mipmap-mdpi', 108], ['mipmap-hdpi', 162], ['mipmap-xhdpi', 216], ['mipmap-xxhdpi', 324], ['mipmap-xxxhdpi', 432]]) {
  const directory = path.join(resourceRoot, folder);
  await mkdir(directory, { recursive: true });
  const artworkSize = Math.round(size * 0.68);
  const artwork = await sourceImage.clone().resize(artworkSize, artworkSize, { fit: 'inside' }).png().toBuffer();
  const foreground = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite([{ input: artwork, gravity: 'centre' }])
    .png()
    .toBuffer();
  await writeFile(path.join(directory, 'ic_launcher_foreground.png'), foreground);
}

console.log('Generated Android launcher icons from assets/android/app-icon.png');
