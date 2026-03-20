const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
})();

const crc32 = (buffer) => {
    let c = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) {
        c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
};

const makePng = (width, height, rgba) => {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const scanlineLen = width * 4 + 1;
    const raw = Buffer.alloc(scanlineLen * height);
    for (let y = 0; y < height; y++) {
        raw[y * scanlineLen] = 0;
        rgba.copy(raw, y * scanlineLen + 1, y * width * 4, (y + 1) * width * 4);
    }
    const compressed = zlib.deflateSync(raw, { level: 9 });

    const chunks = [
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', compressed),
        pngChunk('IEND', Buffer.alloc(0))
    ];

    return Buffer.concat([signature, ...chunks]);
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const drawRoundedRect = (buf, w, h, x, y, rw, rh, r, color) => {
    const x0 = x;
    const y0 = y;
    const x1 = x + rw - 1;
    const y1 = y + rh - 1;
    const rr = Math.max(0, r);
    const rr2 = rr * rr;

    const set = (px, py) => {
        if (px < 0 || py < 0 || px >= w || py >= h) return;
        const i = (py * w + px) * 4;
        buf[i] = color[0];
        buf[i + 1] = color[1];
        buf[i + 2] = color[2];
        buf[i + 3] = color[3];
    };

    for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
            const inCore = (px >= x0 + rr && px <= x1 - rr) || (py >= y0 + rr && py <= y1 - rr);
            if (inCore) {
                set(px, py);
                continue;
            }

            const cx = (px < x0 + rr) ? (x0 + rr) : (x1 - rr);
            const cy = (py < y0 + rr) ? (y0 + rr) : (y1 - rr);
            const dx = px - cx;
            const dy = py - cy;
            if (dx * dx + dy * dy <= rr2) {
                set(px, py);
            }
        }
    }
};

const drawCircle = (buf, w, h, cx, cy, r, color) => {
    const rr = r * r;
    const set = (px, py) => {
        if (px < 0 || py < 0 || px >= w || py >= h) return;
        const i = (py * w + px) * 4;
        buf[i] = color[0];
        buf[i + 1] = color[1];
        buf[i + 2] = color[2];
        buf[i + 3] = color[3];
    };

    const x0 = Math.floor(cx - r);
    const x1 = Math.ceil(cx + r);
    const y0 = Math.floor(cy - r);
    const y1 = Math.ceil(cy + r);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if (dx * dx + dy * dy <= rr) set(x, y);
        }
    }
};

const fillBackground = (buf, w, h) => {
    for (let y = 0; y < h; y++) {
        const t = clamp01(y / (h - 1));
        const r = Math.round(0x00 * (1 - t) + 0x00 * t);
        const g = Math.round(0x61 * (1 - t) + 0x52 * t);
        const b = Math.round(0xff * (1 - t) + 0xcc * t);
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            buf[i] = r;
            buf[i + 1] = g;
            buf[i + 2] = b;
            buf[i + 3] = 255;
        }
    }
};

const drawLock = (buf, w, h) => {
    const white = [255, 255, 255, 255];
    const keyhole = [0x00, 0x52, 0xcc, 255];

    const bodyW = Math.round(w * 0.58);
    const bodyH = Math.round(h * 0.45);
    const bodyX = Math.round((w - bodyW) / 2);
    const bodyY = Math.round(h * 0.46);
    const bodyR = Math.max(2, Math.round(w * 0.10));
    drawRoundedRect(buf, w, h, bodyX, bodyY, bodyW, bodyH, bodyR, white);

    const shackleCx = w / 2;
    const shackleCy = h * 0.40;
    const outerR = w * 0.26;
    const innerR = w * 0.18;
    const bottomY = bodyY + Math.round(bodyH * 0.12);
    const thickness = outerR - innerR;

    for (let y = Math.floor(shackleCy - outerR); y <= bottomY; y++) {
        for (let x = 0; x < w; x++) {
            const dx = x - shackleCx;
            const dy = y - shackleCy;
            const d2 = dx * dx + dy * dy;
            if (d2 <= outerR * outerR && d2 >= innerR * innerR && y <= bottomY) {
                const i = (y * w + x) * 4;
                if (y >= 0 && y < h) {
                    buf[i] = white[0];
                    buf[i + 1] = white[1];
                    buf[i + 2] = white[2];
                    buf[i + 3] = white[3];
                }
            }
        }
    }

    const khR = Math.max(2, Math.round(w * 0.06));
    const khCx = w / 2;
    const khCy = bodyY + Math.round(bodyH * 0.48);
    drawCircle(buf, w, h, khCx, khCy, khR, keyhole);
    drawRoundedRect(
        buf,
        w,
        h,
        Math.round(khCx - khR * 0.45),
        Math.round(khCy),
        Math.round(khR * 0.9),
        Math.round(khR * 1.6),
        Math.max(1, Math.round(khR * 0.25)),
        keyhole
    );
};

const generateIcon = (size) => {
    const buf = Buffer.alloc(size * size * 4);
    fillBackground(buf, size, size);
    drawLock(buf, size, size);
    return makePng(size, size, buf);
};

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
    const file = path.join(dir, `icon${size}.png`);
    fs.writeFileSync(file, generateIcon(size));
}

console.log('Icons generated.');
