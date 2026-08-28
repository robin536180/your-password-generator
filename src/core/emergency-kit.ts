/**
 * core/emergency-kit.ts - 紧急工具包导出（PNG格式）
 *
 * 目标：注册流程强制用户保存一张「紧急工具包」图片，包含：
 *   ① 用户邮箱
 *   ② Secret Key 明文（34字符完整格式，用于设备丢失时恢复）
 *   ③ 二维码（内容为 `1p://ek?email=xxx&sk=xxx`  URI 格式，可扫码手机端打开恢复）
 *   ④ 恢复指南（中文）
 *
 * 技术选型：HTML5 Canvas 2D 绘制，然后转 PNG dataURL → 强制下载
 * 不引入第三方 PDF 库（减少依赖攻击面），纯 PNG 足够打印 + 长期保存
 */
import QRCode from 'qrcode';
import { Log } from '@/core/logger';
import { calcEntropyBits } from '@/lib/utils';

export interface EmergencyKitPayload {
  accountEmail: string;
  secretKey: string;
  createdAt: number;
  vaultCreatedAt?: number;
}

export interface EmergencyKitOutput {
  dataUrl: string;           // PNG 图片的 dataURL (data:image/png;base64,...)
  blob: Blob;                // PNG Blob（用于下载）
  width: number;
  height: number;
}

/**
 * 生成紧急工具包图片
 * 尺寸：1240 × 1754 px ≈ A4 比例 (300 DPI)
 */
export const generateEmergencyKitPng = async (p: EmergencyKitPayload): Promise<EmergencyKitOutput> => {
  const t0 = performance.now();
  const W = 1240;
  const H = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  if (!ctx) throw new Error('紧急工具包生成失败：浏览器不支持Canvas2D');

  // 1) 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f0f4ff');
  bg.addColorStop(1, '#ffffff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2) 蓝色顶栏
  ctx.fillStyle = '#0061ff';
  ctx.fillRect(0, 0, W, 210);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 68px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔐 紧急工具包 (Emergency Kit)', 70, 110);
  ctx.font = '30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.globalAlpha = 0.92;
  ctx.fillText('1Password Clone · 零知识密码管理器', 70, 170);
  ctx.globalAlpha = 1;

  // 3) 主卡片（白色圆角）
  const cardX = 60;
  const cardY = 280;
  const cardW = W - 120;
  const cardH = 990;   // 原 860 → +130px，完全包住 340 高 QR + 6 行右侧 50px 文字
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e3e8f5';
  ctx.stroke();

  // 3-a 标题区
  ctx.fillStyle = '#202a51';
  ctx.font = 'bold 44px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('请打印或截图妥善保存这张图片', 100, cardY + 80);
  ctx.fillStyle = '#5a6a99';
  ctx.font = '26px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('丢失主密码 + 丢失 Secret Key = 永久无法恢复您的保管库', 100, cardY + 135);

  // 分隔线
  ctx.strokeStyle = '#e8edfa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, cardY + 175);
  ctx.lineTo(W - 100, cardY + 175);
  ctx.stroke();

  // 3-b 邮箱
  drawLabel(ctx, '📧 账号邮箱', 100, cardY + 230);
  ctx.fillStyle = '#0d1226';
  ctx.font = 'bold 40px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  ctx.fillText(p.accountEmail || '(未设置邮箱)', 100, cardY + 280);

  // 3-c Secret Key
  drawLabel(ctx, '🔑 Secret Key（最重要，切勿泄露）', 100, cardY + 360);
  const skBoxX = 100;
  const skBoxY = cardY + 400;
  const skBoxW = cardW - 80;
  const skBoxH = 90;
  roundRect(ctx, skBoxX, skBoxY, skBoxW, skBoxH, 16);
  ctx.fillStyle = '#fff8e1';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffb300';
  ctx.stroke();
  ctx.fillStyle = '#b26a00';
  ctx.font = 'bold 52px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(p.secretKey, skBoxX + skBoxW / 2, skBoxY + skBoxH / 2 + 4);
  ctx.textAlign = 'start';

  // 3-d 二维码
  drawLabel(ctx, '📱 手机端扫码备份信息（不跳转网页，请手动保存）', 100, cardY + 545);
  const ekTs = new Date(p.createdAt).toISOString();
  const qrPayload = [
    `SECRET_KEY: ${p.secretKey}`,
    `EMAIL: ${p.accountEmail || '(未设置)'}`,
    `VERSION: 1 (1Pass Clone M1)`,
    `CREATED_AT: ${ekTs}`,
    '--- 换设备恢复：输入 主密码 + 完整 Secret Key（不要漏 A3- 前缀）',
  ].join('\n');
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'Q',
    width: 340,
    margin: 2,
    color: { dark: '#202a51', light: '#ffffff' },
  });
  const qrImg = await loadDataUrlImage(qrDataUrl);
  ctx.drawImage(qrImg, 100, cardY + 590, 340, 340);
  // 二维码右侧文字
  ctx.fillStyle = '#202a51';
  ctx.font = '28px -apple-system, "PingFang SC", sans-serif';
  const lines = [
    '① 将这张图片打印到纸上，锁进保险柜',
    '② 或截图保存到离线加密U盘',
    '③ 不要传到任何网盘/邮箱/云存储',
    '④ 换设备时用：主密码 + Secret Key 恢复',
    `⑤ 生成时间：${new Date(p.createdAt).toLocaleString('zh-CN')}`,
    '⑥ 扫码结果：显示 邮箱 + SK 文本（不跳转网页）',
  ];
  lines.forEach((l, i) => {
    ctx.fillText(l, 480, cardY + 670 + i * 50);
  });

  // 4) 底部警告
  const warnX = 60;
  const warnY = cardY + cardH + 60;
  const warnH = 520;
  roundRect(ctx, warnX, warnY, cardW, warnH, 28);
  ctx.fillStyle = '#fff5f5';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fecaca';
  ctx.stroke();
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 44px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('⚠️  以下行为将导致保管库永久无法恢复：', 100, warnY + 80);
  const warns = [
    '✗ 忘记主密码，且没有紧急工具包',
    '✗ 紧急工具包里的 Secret Key 丢失或拍照泄漏',
    '✗ 设备硬盘物理损坏，且未备份扩展 storage 数据',
    '✗ 随意卸载本扩展（会删除 chrome.storage.local 所有数据！）',
  ];
  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 32px -apple-system, "PingFang SC", sans-serif';
  warns.forEach((w, i) => {
    ctx.fillText(w, 110, warnY + 160 + i * 60);
  });
  const adviceY = warnY + 160 + warns.length * 60 + 40;
  ctx.fillStyle = '#166534';
  ctx.font = 'bold 32px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText('✓ 建议：打印 + 离线加密U盘双重备份，每年检查一次可读性', 110, adviceY);

  // 5) 水印 + 版本号
  const watermarkY = warnY + warnH + 40;
  ctx.fillStyle = 'rgba(32,42,81,0.15)';
  ctx.font = '20px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    `1Pass Clone M1 Security Base · vaultCreatedAt=${new Date(p.vaultCreatedAt ?? p.createdAt).toISOString().slice(0, 10)} · sk-entropy≈${calcEntropyBits(p.secretKey)}bits`,
    W - 60,
    watermarkY,
  );
  ctx.textAlign = 'start';

  // 6) 输出 dataURL + blob
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await (fetch(dataUrl).then((r) => r.blob()));
  const dur = Math.round(performance.now() - t0);
  Log.info('EKIT:GENERATE', `紧急工具包生成成功 ${W}x${H} png, 耗时 ${dur}ms, 二维码内容=1p://ek?email=...`);
  return { dataUrl, blob, width: W, height: H };
};

/** 触发浏览器下载（强制用户确认保存） */
export const downloadEmergencyKit = (blob: Blob, email: string): string => {
  const safeEmail = (email || 'no-email').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `1PassClone_EmergencyKit_${safeEmail}_${Date.now()}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
  Log.info('EKIT:DOWNLOAD', `触发下载 ${filename}`);
  return filename;
};

/* ========== 工具函数 ========== */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.fillStyle = '#5a6a99';
  ctx.font = '26px -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(text, x, y);
}

const loadDataUrlImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('二维码图片加载失败: ' + String(e)));
    img.src = dataUrl;
  });
