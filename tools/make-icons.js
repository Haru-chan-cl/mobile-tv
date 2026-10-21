// Herramienta manual (no forma parte de la app): genera los íconos de icons/ como PNG.
// Uso: node tools/make-icons.js
// Diseño propio: fondo oscuro y las cuatro franjas de design/tokens.css, siempre en este orden:
// naranja, rojo, magenta, violeta. Esquinas cuadradas, sin degradados ni sombras. Sin imágenes de terceros.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(root, 'design', 'tokens.css'), 'utf8');

// Lee un color de tokens.css, por ejemplo "--stripe-orange:#fc6c18".
function token(name) {
  const match = tokens.match(new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})\\b`));
  if (!match) throw new Error(`No encontré ${name} en design/tokens.css`);
  const hex = match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

const BACKGROUND = token('--surface');
const STRIPES = ['--stripe-orange', '--stripe-red', '--stripe-magenta', '--stripe-violet'].map(token);

// El dibujo ocupa un cuadrado centrado: de `margin` a `1 - margin`, en coordenadas de 0 a 1.
// Los íconos "maskable" necesitan más margen porque el sistema los recorta (zona segura).
function colorAt(x, y, margin) {
  const size = 1 - 2 * margin;
  const gap = size * 0.06;
  const bar = (size - 3 * gap) / 4;
  const u = x - margin;
  const v = y - margin;
  if (u < 0 || u >= size || v < 0 || v >= size) return BACKGROUND;
  for (let i = 0; i < 4; i++) {
    const top = i * (bar + gap);
    if (v >= top && v < top + bar) return STRIPES[i];
  }
  return BACKGROUND;
}

function render(pixels, margin) {
  const SAMPLES = 4; // 4x4 muestras por píxel para suavizar los bordes
  const raw = Buffer.alloc(pixels * (pixels * 3 + 1));
  let offset = 0;
  for (let py = 0; py < pixels; py++) {
    raw[offset++] = 0; // sin filtro en esta fila
    for (let px = 0; px < pixels; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colorAt((px + (sx + 0.5) / SAMPLES) / pixels, (py + (sy + 0.5) / SAMPLES) / pixels, margin);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SAMPLES * SAMPLES;
      raw[offset++] = Math.round(r / n);
      raw[offset++] = Math.round(g / n);
      raw[offset++] = Math.round(b / n);
    }
  }
  return raw;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(pixels, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(pixels, 0);
  header.writeUInt32BE(pixels, 4);
  header[8] = 8; // 8 bits por canal
  header[9] = 2; // color real RGB, sin transparencia
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS = [
  { file: 'icon-192.png', pixels: 192, margin: 0.12 },
  { file: 'icon-512.png', pixels: 512, margin: 0.12 },
  { file: 'icon-maskable-512.png', pixels: 512, margin: 0.2 },
];

const outDir = path.join(root, 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const { file, pixels, margin } of ICONS) {
  fs.writeFileSync(path.join(outDir, file), encodePng(pixels, render(pixels, margin)));
  console.log(`icons/${file} (${pixels}x${pixels})`);
}
