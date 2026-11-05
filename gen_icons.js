/**
 * gen_icons.js - 生成扩展图标（icons/icon16|32|48|128.png）
 *
 * 设计：蓝紫渐变圆角底 + 白色锁体 + 镂空锁孔（锁孔透出背景渐变）
 * 画质：SS 倍超采样后降采样，边缘带完整抗锯齿；透明边缘按预乘 alpha 处理，不发黑
 *
 * 用法：node gen_icons.js
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUT_DIR = path.join(__dirname, 'icons');
const SIZES = [16, 32, 48, 128];
/** 超采样倍数：4 倍在小尺寸下已足够平滑，128px 渲染成本仍很低 */
const SS = 4;

/* ---------- 调色板（与项目 brand-500 #0061ff 同色系）---------- */
const GRAD_TOP = [0x1e, 0x7b, 0xff];
const GRAD_BOTTOM = [0x5b, 0x2e, 0xd9];

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
};

const encodePng = (width, height, rgba) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const scanline = width * 4 + 1;
  const raw = Buffer.alloc(scanline * height);
  for (let y = 0; y < height; y++) {
    raw[y * scanline] = 0; // filter: none
    rgba.copy(raw, y * scanline + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

/* ---------- 几何判定（归一化坐标 0~1）---------- */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mixRgb = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

/** 圆角矩形（x0,y0)-(x1,y1)，圆角半径 r */
const inRoundRect = (u, v, x0, y0, x1, y1, r) => {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = u < x0 + r ? x0 + r : u > x1 - r ? x1 - r : u;
  const cy = v < y0 + r ? y0 + r : v > y1 - r ? y1 - r : v;
  const dx = u - cx;
  const dy = v - cy;
  return dx * dx + dy * dy <= r * r;
};

/** 图标底板：圆角约 22.5%，接近系统图标观感 */
const inBackdrop = (u, v) => inRoundRect(u, v, 0.02, 0.02, 0.98, 0.98, 0.225);

/** 锁梁：上半环 + 两条竖腿，向下延伸进锁体 */
const inShackle = (u, v) => {
  if (v > 0.468) return false;
  const dx = u - 0.5;
  const dy = v - 0.418;
  const d2 = dx * dx + dy * dy;
  return d2 <= 0.155 * 0.155 && d2 >= 0.085 * 0.085;
};

/** 锁体 */
const inBody = (u, v) => inRoundRect(u, v, 0.275, 0.462, 0.725, 0.795, 0.08);

/** 锁孔：上圆 + 下竖槽（镂空，透出背景渐变） */
const inKeyhole = (u, v) => {
  const dx = u - 0.5;
  const dy = v - 0.585;
  if (dx * dx + dy * dy <= 0.048 * 0.048) return true;
  return inRoundRect(u, v, 0.477, 0.585, 0.523, 0.675, 0.023);
};

/** 背景渐变 + 顶部柔光，模拟左上打光 */
const backdropColor = (u, v) => {
  const t = clamp01(u * 0.35 + v * 0.65);
  let c = mixRgb(GRAD_TOP, GRAD_BOTTOM, t);
  if (v < 0.55) c = mixRgb(c, [255, 255, 255], (1 - v / 0.55) * 0.14);
  return c;
};

/**
 * 采样单点：返回 [r,g,b] 或 null（透明）
 * 绘制顺序：底板 → 锁梁/锁体（白）→ 锁孔（背景色，形成镂空）
 */
const sample = (u, v) => {
  if (!inBackdrop(u, v)) return null;
  if (inKeyhole(u, v)) return backdropColor(u, v);
  if (inShackle(u, v) || inBody(u, v)) return [255, 255, 255];
  return backdropColor(u, v);
};

/* ---------- 渲染：超采样 + 预乘 alpha 降采样 ---------- */
const renderIcon = (size) => {
  const S = size * SS;
  const sumR = new Float64Array(size * size);
  const sumG = new Float64Array(size * size);
  const sumB = new Float64Array(size * size);
  const sumA = new Float64Array(size * size);

  for (let y = 0; y < S; y++) {
    const v = (y + 0.5) / S;
    for (let x = 0; x < S; x++) {
      const c = sample((x + 0.5) / S, v);
      const idx = Math.floor(y / SS) * size + Math.floor(x / SS);
      if (c) {
        sumR[idx] += c[0];
        sumG[idx] += c[1];
        sumB[idx] += c[2];
        sumA[idx] += 1;
      }
    }
  }

  const total = SS * SS;
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = sumA[i];
    if (a === 0) continue; // 保持全透明
    // 预乘累加 → 反预乘，避免透明边缘出现黑边
    out[i * 4] = Math.round(sumR[i] / a);
    out[i * 4 + 1] = Math.round(sumG[i] / a);
    out[i * 4 + 2] = Math.round(sumB[i] / a);
    out[i * 4 + 3] = Math.round((a / total) * 255);
  }
  return out;
};

/* ---------- 执行 ---------- */
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, encodePng(size, size, renderIcon(size)));
  console.log(`✅ icon${size}.png`);
}

console.log('图标生成完成。');
