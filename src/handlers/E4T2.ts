import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";

const QTY = new Uint8Array([
  16, 11, 10, 16,  24,  40,  51,  61,
  12, 12, 14, 19,  26,  58,  60,  55,
  14, 13, 16, 24,  40,  57,  69,  56,
  14, 17, 22, 29,  51,  87,  80,  62,
  18, 22, 37, 56,  68, 109, 103,  77,
  24, 35, 55, 64,  81, 104, 113,  92,
  49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103,  99,
]);

const QTC = new Uint8Array([
  17, 18, 24, 47, 99, 99, 99, 99,
  18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
]);

const DC_BITS_Y = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_VALS_Y = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const AC_BITS_Y = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7D];
const AC_VALS_Y = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12,
  0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
  0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
  0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0,
  0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0A, 0x16,
  0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
  0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
  0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79,
  0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
  0x99, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8,
  0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7,
  0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6,
  0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5,
  0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2, 0xE3,
  0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1,
  0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9,
  0xFA, 0x00,
];

const DC_BITS_C = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_VALS_C = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const AC_BITS_C = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_VALS_C = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21,
  0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
  0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91,
  0xA1, 0xB1, 0xC1, 0x09, 0x23, 0x33, 0x52, 0xF0,
  0x15, 0x62, 0x72, 0xD1, 0x0A, 0x16, 0x24, 0x34,
  0xE1, 0x25, 0xF1, 0x17, 0x18, 0x19, 0x1A, 0x26,
  0x27, 0x28, 0x29, 0x2A, 0x35, 0x36, 0x37, 0x38,
  0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
  0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
  0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
  0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78,
  0x79, 0x7A, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
  0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96,
  0x97, 0x98, 0x99, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6,
  0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5,
  0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4,
  0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3,
  0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE2,
  0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA,
  0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9,
  0xFA, 0x00,
];

function buildHuffCodes(
  bits: number[],
  values: number[],
): Map<number, { code: number; len: number }> {
  const map = new Map<number, { code: number; len: number }>();
  let code = 0;
  let vi = 0;
  for (let len = 0; len < 16; len++) {
    for (let j = 0; j < bits[len]; j++) {
      map.set(values[vi], { code, len: len + 1 });
      code++;
      vi++;
    }
    code <<= 1;
  }
  return map;
}

const huffDC_Y = buildHuffCodes(DC_BITS_Y, DC_VALS_Y);
const huffAC_Y = buildHuffCodes(AC_BITS_Y, AC_VALS_Y);
const huffDC_C = buildHuffCodes(DC_BITS_C, DC_VALS_C);
const huffAC_C = buildHuffCodes(AC_BITS_C, AC_VALS_C);

class BitWriter {
  private bytes: number[] = [];
  private cur: number = 0;
  private filled: number = 0;

  writeBits(value: number, nbits: number): void {
    for (let i = nbits - 1; i >= 0; i--) {
      this.cur = (this.cur << 1) | ((value >> i) & 1);
      this.filled++;
      if (this.filled === 8) {
        this.bytes.push(this.cur);
        if (this.cur === 0xFF) this.bytes.push(0x00);
        this.cur = 0;
        this.filled = 0;
      }
    }
  }

  flush(): void {
    if (this.filled > 0) {
      this.cur <<= 8 - this.filled;
      this.cur |= (1 << (8 - this.filled)) - 1;
      this.bytes.push(this.cur);
      this.cur = 0;
      this.filled = 0;
    }
  }

  toBuffer(): Buffer {
    return Buffer.from(this.bytes);
  }
}

const DCT_SCALE = 1 / Math.sqrt(2);
const COS: Float64Array = (() => {
  const a = new Float64Array(64);
  for (let k = 0; k < 8; k++) {
    for (let n = 0; n < 8; n++) {
      a[k * 8 + n] = Math.cos(((2 * n + 1) * k * Math.PI) / 16);
    }
  }
  return a;
})();

function dct8x8(block: Float64Array): Float64Array {
  const out = new Float64Array(64);
  for (let u = 0; u < 8; u++) {
    const cu = u === 0 ? DCT_SCALE : 1;
    const cosU = u * 8;
    for (let v = 0; v < 8; v++) {
      const cv = v === 0 ? DCT_SCALE : 1;
      const cosV = v * 8;
      let sum = 0;
      for (let x = 0; x < 8; x++) {
        const cosXU = COS[cosU + x];
        const rowOff = x * 8;
        for (let y = 0; y < 8; y++) {
          sum += block[rowOff + y] * cosXU * COS[cosV + y];
        }
      }
      out[u * 8 + v] = 0.25 * cu * cv * sum;
    }
  }
  return out;
}

function quantize(block: Float64Array, table: Uint8Array): Int32Array {
  const out = new Int32Array(64);
  for (let i = 0; i < 64; i++) {
    out[i] = Math.round(block[i] / table[i]);
  }
  return out;
}

const ZIGZAG: number[] = [
   0,  1,  8, 16,  9,  2,  3, 10,
  17, 24, 32, 25, 18, 11,  4,  5,
  12, 19, 26, 33, 40, 48, 41, 34,
  27, 20, 13,  6,  7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36,
  29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46,
  53, 60, 61, 54, 47, 55, 62, 63,
];

function zigzag(block: Int32Array): Int32Array {
  const out = new Int32Array(64);
  for (let i = 0; i < 64; i++) {
    out[i] = block[ZIGZAG[i]];
  }
  return out;
}

function encodeDC(
  writer: BitWriter,
  diff: number,
  huff: Map<number, { code: number; len: number }>,
): void {
  let ssss = 0;
  let absDiff = diff < 0 ? -diff : diff;
  while (absDiff > 0) {
    ssss++;
    absDiff >>= 1;
  }
  const entry = huff.get(ssss)!;
  writer.writeBits(entry.code, entry.len);
  if (ssss > 0) {
    if (diff < 0) diff -= 1;
    writer.writeBits(diff & ((1 << ssss) - 1), ssss);
  }
}

function encodeAC(
  writer: BitWriter,
  block: Int32Array,
  huff: Map<number, { code: number; len: number }>,
): void {
  let run = 0;
  for (let i = 1; i < 64; i++) {
    const val = block[i];
    if (val === 0) {
      run++;
      if (run >= 16) {
        const zrl = huff.get(0xF0)!;
        writer.writeBits(zrl.code, zrl.len);
        run = 0;
      }
    } else {
      let ssss = 0;
      let absVal = val < 0 ? -val : val;
      while (absVal > 0) {
        ssss++;
        absVal >>= 1;
      }
      const symbol = (run << 4) | ssss;
      const entry = huff.get(symbol)!;
      writer.writeBits(entry.code, entry.len);
      let v = val;
      if (v < 0) v -= 1;
      writer.writeBits(v & ((1 << ssss) - 1), ssss);
      run = 0;
    }
  }
  if (run > 0) {
    const eob = huff.get(0x00)!;
    writer.writeBits(eob.code, eob.len);
  }
}

function makeDHTSegment(
  tcTh: number,
  bits: number[],
  values: number[],
): Buffer {
  const dataLen = 1 + 16 + values.length;
  const buf = Buffer.alloc(2 + dataLen);
  buf[0] = 0xFF;
  buf[1] = 0xC4;
  buf.writeUInt16BE(dataLen, 2);
  buf[4] = tcTh;
  for (let i = 0; i < 16; i++) buf[5 + i] = bits[i];
  for (let i = 0; i < values.length; i++) buf[21 + i] = values[i];
  return buf;
}

function generatePreviewJpeg(
  width: number,
  height: number,
  placeHash: number,
  sensorHash: number,
  cloudHash: number,
): Buffer {
  const yPlane = new Uint8Array(width * height);
  const cbPlane = new Uint8Array(width * height);
  const crPlane = new Uint8Array(width * height);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const r = Math.floor(
        30 + ((px + placeHash) % 37) * 1.3 + ((py + sensorHash) % 53) * 0.8,
      ) % 256;
      const g = Math.floor(
        60 + ((py + cloudHash) % 67) * 1.1 + ((px + placeHash) % 43) * 0.6,
      ) % 256;
      const b = Math.floor(
        40 + ((px + py + sensorHash) % 91) * 0.9 + (cloudHash % 59) * 0.5,
      ) % 256;

      const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const cb = Math.max(0, Math.min(255, Math.round(-0.168736 * r - 0.331264 * g + 0.5 * b + 128)));
      const cr = Math.max(0, Math.min(255, Math.round(0.5 * r - 0.418688 * g - 0.081312 * b + 128)));

      const idx = py * width + px;
      yPlane[idx] = y;
      cbPlane[idx] = cb;
      crPlane[idx] = cr;
    }
  }

  const writer = new BitWriter();
  const bw = width >> 3;
  const bh = height >> 3;

  let prevDC_Y = 0;
  let prevDC_Cb = 0;
  let prevDC_Cr = 0;

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const yBlock = new Float64Array(64);
      const cbBlock = new Float64Array(64);
      const crBlock = new Float64Array(64);

      for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
          const srcIdx = (by * 8 + dy) * width + (bx * 8 + dx);
          const bi = dy * 8 + dx;
          yBlock[bi] = yPlane[srcIdx] - 128;
          cbBlock[bi] = cbPlane[srcIdx] - 128;
          crBlock[bi] = crPlane[srcIdx] - 128;
        }
      }

      const qzY = zigzag(quantize(dct8x8(yBlock), QTY));
      const dcY = qzY[0];
      encodeDC(writer, dcY - prevDC_Y, huffDC_Y);
      prevDC_Y = dcY;
      encodeAC(writer, qzY, huffAC_Y);

      const qzCb = zigzag(quantize(dct8x8(cbBlock), QTC));
      const dcCb = qzCb[0];
      encodeDC(writer, dcCb - prevDC_Cb, huffDC_C);
      prevDC_Cb = dcCb;
      encodeAC(writer, qzCb, huffAC_C);

      const qzCr = zigzag(quantize(dct8x8(crBlock), QTC));
      const dcCr = qzCr[0];
      encodeDC(writer, dcCr - prevDC_Cr, huffDC_C);
      prevDC_Cr = dcCr;
      encodeAC(writer, qzCr, huffAC_C);
    }
  }

  writer.flush();
  const scanData = writer.toBuffer();

  const parts: Buffer[] = [];

  parts.push(Buffer.from([0xFF, 0xD8]));

  const jfif = Buffer.alloc(16);
  jfif[0] = 0xFF;
  jfif[1] = 0xE0;
  jfif.writeUInt16BE(16, 2);
  jfif.write("JFIF\0", 4, "ascii");
  jfif[9] = 0x01;
  jfif[10] = 0x01;
  jfif[11] = 0x00;
  jfif[12] = 0x00;
  jfif[13] = 0x01;
  jfif[14] = 0x00;
  jfif[15] = 0x01;
  parts.push(jfif);

  {
    const buf = Buffer.alloc(2 + 1 + 64);
    buf[0] = 0xFF;
    buf[1] = 0xDB;
    buf.writeUInt16BE(1 + 64, 2);
    buf[4] = 0x00;
    buf.set(QTY, 5);
    parts.push(buf);
  }

  {
    const buf = Buffer.alloc(2 + 1 + 64);
    buf[0] = 0xFF;
    buf[1] = 0xDB;
    buf.writeUInt16BE(1 + 64, 2);
    buf[4] = 0x01;
    buf.set(QTC, 5);
    parts.push(buf);
  }

  {
    const buf = Buffer.alloc(2 + 1 + 2 + 2 + 1 + 3 * 3);
    let off = 0;
    buf[off++] = 0xFF;
    buf[off++] = 0xC0;
    buf.writeUInt16BE(1 + 2 + 2 + 1 + 3 * 3, off);
    off += 2;
    buf[off++] = 8;
    buf.writeUInt16BE(height, off);
    off += 2;
    buf.writeUInt16BE(width, off);
    off += 2;
    buf[off++] = 3;
    buf[off++] = 1;
    buf[off++] = 0x11;
    buf[off++] = 0x00;
    buf[off++] = 2;
    buf[off++] = 0x11;
    buf[off++] = 0x01;
    buf[off++] = 3;
    buf[off++] = 0x11;
    buf[off++] = 0x01;
    parts.push(buf);
  }

  parts.push(makeDHTSegment(0x00, DC_BITS_Y, DC_VALS_Y));
  parts.push(makeDHTSegment(0x10, AC_BITS_Y, AC_VALS_Y));
  parts.push(makeDHTSegment(0x01, DC_BITS_C, DC_VALS_C));
  parts.push(makeDHTSegment(0x11, AC_BITS_C, AC_VALS_C));

  {
    const buf = Buffer.alloc(2 + 1 + 3 * 2 + 3);
    let off = 0;
    buf[off++] = 0xFF;
    buf[off++] = 0xDA;
    buf.writeUInt16BE(1 + 3 * 2 + 3, off);
    off += 2;
    buf[off++] = 3;
    buf[off++] = 1;
    buf[off++] = 0x00;
    buf[off++] = 2;
    buf[off++] = 0x11;
    buf[off++] = 3;
    buf[off++] = 0x11;
    buf[off++] = 0x00;
    buf[off++] = 0x3F;
    buf[off++] = 0x00;
    parts.push(buf);
  }

  parts.push(scanData);
  parts.push(Buffer.from([0xFF, 0xD9]));

  return Buffer.concat(parts);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

const MAX_DIM = 1024;
const DEFAULT_SIZE = 512;

const composer = new Composer<Ctx>();

composer.command("preview", async (ctx) => {
  const place = ctx.session.place;
  if (!place) {
    await ctx.reply(
      "No search parameters configured. Use /search first.",
    );
    return;
  }

  const dateRange = ctx.session.dateRange;
  const datesStr =
    dateRange?.start && dateRange?.end
      ? `${dateRange.start} – ${dateRange.end}`
      : dateRange?.type === "last_month"
        ? "Last month"
        : dateRange?.type === "last_year"
          ? "Last year"
          : "Not set";

  const compositeType = ctx.session.compositeType;
  const compositeCustomName = ctx.session.compositeCustomName;
  const compositeLabel = compositeCustomName || compositeType || "Not set";

  const cc = ctx.session.cloudCover;
  const cloudStr =
    cc === "auto"
      ? "Auto (20%)"
      : cc === "10"
        ? "10%"
        : cc === "20"
          ? "20%"
          : cc === "40"
            ? "40%"
            : "Auto (20%)";

  const size = Math.min(MAX_DIM, DEFAULT_SIZE);
  const jpeg = generatePreviewJpeg(
    size,
    size,
    hashString(place),
    hashString(compositeLabel),
    hashString(cloudStr),
  );

  const caption = `Location: ${place}\nDates: ${datesStr}\nSensor: ${compositeLabel}\nCloud cover: ${cloudStr}`;

  await ctx.replyWithPhoto(new InputFile(jpeg, "preview.jpg"), {
    caption,
  });
});

export default composer;
