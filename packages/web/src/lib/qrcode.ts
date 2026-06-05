/**
 * 轻量级 QR 码生成器（纯 SVG，零依赖）
 *
 * 仅支持字母数字模式，专为 6 位分享码设计。
 * 生成 Version 2 QR 码（25x25 模块），M 级纠错。
 */

// ── QR Code 常量 ──

const MODULES = 25;
const ALIGNMENT_PATTERN_CENTERS = [6, 18];

/** 掩码模式 2: (row + col) % 3 === 0 */
function isMasked(row: number, col: number): boolean {
  return (row + col) % 3 === 0;
}

// ── 矩阵表示：使用二维 number 数组，0=white, 1=black, -1=unset ──

type QrMatrix = number[][];

/** 安全获取矩阵值 */
function matGet(m: QrMatrix, r: number, c: number): number {
  return m[r]?.[c] ?? -1;
}

/** 安全设置矩阵值 */
function matSet(m: QrMatrix, r: number, c: number, v: number): void {
  const row = m[r];
  if (row) row[c] = v;
}

function createMatrix(): QrMatrix {
  const matrix: QrMatrix = Array.from({ length: MODULES }, () =>
    Array.from({ length: MODULES }, () => -1),
  );

  addFinderPattern(matrix, 0, 0);
  addFinderPattern(matrix, 0, MODULES - 7);
  addFinderPattern(matrix, MODULES - 7, 0);

  for (const row of ALIGNMENT_PATTERN_CENTERS) {
    for (const col of ALIGNMENT_PATTERN_CENTERS) {
      if (
        (row === 6 && col === 6) ||
        (row === 6 && col === MODULES - 7) ||
        (row === MODULES - 7 && col === 6)
      ) {
        continue;
      }
      addAlignmentPattern(matrix, row, col);
    }
  }

  for (let i = 8; i < MODULES - 8; i++) {
    matSet(matrix, 6, i, i % 2 === 0 ? 1 : 0);
    matSet(matrix, i, 6, i % 2 === 0 ? 1 : 0);
  }

  matSet(matrix, MODULES - 8, 8, 1);

  return matrix;
}

function addFinderPattern(m: QrMatrix, startRow: number, startCol: number): void {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const black =
        r === 0 || r === 6 || c === 0 || c === 6 ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      matSet(m, startRow + r, startCol + c, black ? 1 : 0);
    }
  }
}

function addAlignmentPattern(m: QrMatrix, cRow: number, cCol: number): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const black = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
      matSet(m, cRow + r, cCol + c, black ? 1 : 0);
    }
  }
}

// ── 字母数字编码 ──

const ALPHA_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const ALPHA_MAP = new Map<string, number>();
for (let i = 0; i < ALPHA_CHARS.length; i++) {
  ALPHA_MAP.set(ALPHA_CHARS.charAt(i), i);
}

function encodeAlphanumeric(text: string, dataBits: number): number[] {
  const bits: number[] = [];

  // Mode: 0010 (alphanumeric)
  bits.push(0, 0, 1, 0);

  // Count (9 bits for Version 2)
  for (let i = 8; i >= 0; i--) {
    bits.push((text.length >> i) & 1);
  }

  for (let i = 0; i < text.length; i += 2) {
    if (i + 1 < text.length) {
      const v1 = ALPHA_MAP.get(text.charAt(i)) ?? 0;
      const v2 = ALPHA_MAP.get(text.charAt(i + 1)) ?? 0;
      const val = v1 * 45 + v2;
      for (let j = 10; j >= 0; j--) {
        bits.push((val >> j) & 1);
      }
    } else {
      const v1 = ALPHA_MAP.get(text.charAt(i)) ?? 0;
      for (let j = 5; j >= 0; j--) {
        bits.push((v1 >> j) & 1);
      }
    }
  }

  // Terminator
  const terminatorBits = Math.min(4, dataBits - bits.length);
  for (let i = 0; i < terminatorBits; i++) {
    bits.push(0);
  }

  // Padding
  while (bits.length < dataBits) {
    const padByte = (bits.length / 8) % 2 === 0 ? 0xec : 0x11;
    const remaining = dataBits - bits.length;
    const padBits = Math.min(8, remaining);
    for (let i = padBits - 1; i >= 0; i--) {
      bits.push((padByte >> i) & 1);
    }
  }

  return bits;
}

// ── 模块排列 ──

/** 安全获取 dataBits，越界返回 0 */
function bitAt(bits: number[], index: number): number {
  return index < bits.length ? (bits[index] ?? 0) : 0;
}

function placeDataBits(matrix: QrMatrix, dataBits: number[]): void {
  let bitIndex = 0;
  let goingUp = true;
  let col = MODULES - 1;

  while (col > 0) {
    if (col === 6) col--;
    const colRight = col;
    const colLeft = col - 1;

    if (goingUp) {
      for (let row = MODULES - 1; row >= 0; row--) {
        if (colRight < MODULES && matGet(matrix, row, colRight) === -1 && bitIndex < dataBits.length) {
          matSet(matrix, row, colRight, bitAt(dataBits, bitIndex));
        }
        if (colLeft >= 0 && matGet(matrix, row, colLeft) === -1 && bitIndex + 1 < dataBits.length) {
          matSet(matrix, row, colLeft, bitAt(dataBits, bitIndex + 1));
        }
        bitIndex += 2;
      }
    } else {
      for (let row = 0; row < MODULES; row++) {
        if (colRight < MODULES && matGet(matrix, row, colRight) === -1 && bitIndex < dataBits.length) {
          matSet(matrix, row, colRight, bitAt(dataBits, bitIndex));
        }
        if (colLeft >= 0 && matGet(matrix, row, colLeft) === -1 && bitIndex + 1 < dataBits.length) {
          matSet(matrix, row, colLeft, bitAt(dataBits, bitIndex + 1));
        }
        bitIndex += 2;
      }
    }

    goingUp = !goingUp;
    col -= 2;
  }
}

// ── 掩码 ──

function isReserved(row: number, col: number): boolean {
  if (row <= 8 && col <= 8) return true;
  if (row <= 8 && col >= MODULES - 8) return true;
  if (row >= MODULES - 8 && col <= 8) return true;
  if (row === 6 || col === 6) return true;
  return false;
}

function applyMask(matrix: QrMatrix): void {
  for (let r = 0; r < MODULES; r++) {
    for (let c = 0; c < MODULES; c++) {
      const val = matGet(matrix, r, c);
      if (val !== -1 && !isReserved(r, c)) {
        if (isMasked(r, c)) {
          matSet(matrix, r, c, val === 1 ? 0 : 1);
        }
      }
    }
  }
}

// ── 格式信息（M 级纠错 + 掩码模式 2） ──

const FORMAT_INFO = 0b10111_010_010010;

function placeFormatInfo(matrix: QrMatrix): void {
  for (let i = 0; i < 6; i++) {
    matSet(matrix, i, 8, (FORMAT_INFO >> i) & 1);
    matSet(matrix, 8, i, (FORMAT_INFO >> (14 - i)) & 1);
  }
  matSet(matrix, 8, 8, (FORMAT_INFO >> 6) & 1);
  matSet(matrix, 8, 7, (FORMAT_INFO >> 7) & 1);
  matSet(matrix, 7, 8, (FORMAT_INFO >> 8) & 1);
  for (let i = 0; i < 7; i++) {
    matSet(matrix, i < 8 ? i : i + 1, MODULES - 1, (FORMAT_INFO >> i) & 1);
    matSet(matrix, MODULES - 1, i < 8 ? i : i + 1, (FORMAT_INFO >> (14 - i)) & 1);
  }
}

// ── 公共 API ──

export function generateQRCodeSVG(text: string, size = 200, margin = 2): string {
  const matrix = createMatrix();
  const bits = encodeAlphanumeric(text, 224);
  placeDataBits(matrix, bits);
  applyMask(matrix);
  placeFormatInfo(matrix);

  const totalModules = MODULES + margin * 2;
  const moduleSize = size / totalModules;

  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  for (let r = 0; r < MODULES; r++) {
    for (let c = 0; c < MODULES; c++) {
      if (matGet(matrix, r, c) === 1) {
        const x = (c + margin) * moduleSize;
        const y = (r + margin) * moduleSize;
        svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${moduleSize.toFixed(1)}" height="${moduleSize.toFixed(1)}" fill="black"/>`;
      }
    }
  }

  svg += "</svg>";
  return svg;
}

export function generateQRCodeDataURI(text: string, size = 200, margin = 2): string {
  const svg = generateQRCodeSVG(text, size, margin);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
