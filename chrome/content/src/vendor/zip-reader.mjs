const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10,
  11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115,
  131, 163, 195, 227, 258
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4,
  5, 5, 5, 5, 0
];
const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13,
  17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073,
  4097, 6145, 8193, 12289, 16385, 24577
];
const DISTANCE_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2,
  3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10,
  11, 11, 12, 12, 13, 13
];
const CODE_LENGTH_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6,
  10, 5, 11, 4, 12, 3, 13, 2,
  14, 1, 15
];

let fixedLiteralTree = null;
let fixedDistanceTree = null;

export class ZipReader {
  constructor(bytes) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    this.entries = null;
  }

  async readText(name) {
    const bytes = await this.read(name);
    if (!bytes) {
      return null;
    }
    return new TextDecoder("utf-8").decode(bytes);
  }

  async read(name) {
    const entry = this.getEntries().get(name);
    if (!entry) {
      return null;
    }
    return this.readEntry(entry);
  }

  listNames() {
    return [...this.getEntries().keys()];
  }

  getEntries() {
    if (this.entries) {
      return this.entries;
    }

    const eocdOffset = this.findEndOfCentralDirectory();
    const count = this.view.getUint16(eocdOffset + 10, true);
    const centralOffset = this.view.getUint32(eocdOffset + 16, true);
    const entries = new Map();
    let offset = centralOffset;

    for (let index = 0; index < count; index += 1) {
      if (this.view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
        throw new Error("无效的 docx 压缩目录。");
      }

      const flags = this.view.getUint16(offset + 8, true);
      const method = this.view.getUint16(offset + 10, true);
      const compressedSize = this.view.getUint32(offset + 20, true);
      const uncompressedSize = this.view.getUint32(offset + 24, true);
      const nameLength = this.view.getUint16(offset + 28, true);
      const extraLength = this.view.getUint16(offset + 30, true);
      const commentLength = this.view.getUint16(offset + 32, true);
      const localHeaderOffset = this.view.getUint32(offset + 42, true);
      const nameBytes = this.bytes.slice(offset + 46, offset + 46 + nameLength);
      const name = decodeZipName(nameBytes, flags);

      entries.set(name, {
        name,
        method,
        compressedSize,
        uncompressedSize,
        localHeaderOffset
      });

      offset += 46 + nameLength + extraLength + commentLength;
    }

    this.entries = entries;
    return entries;
  }

  async readEntry(entry) {
    const offset = entry.localHeaderOffset;
    if (this.view.getUint32(offset, true) !== LOCAL_SIGNATURE) {
      throw new Error(`docx 条目 ${entry.name} 的本地头无效。`);
    }

    const nameLength = this.view.getUint16(offset + 26, true);
    const extraLength = this.view.getUint16(offset + 28, true);
    const dataStart = offset + 30 + nameLength + extraLength;
    const compressed = this.bytes.slice(dataStart, dataStart + entry.compressedSize);
    let output;

    try {
      if (entry.method === 0) {
        output = compressed;
      }
      else if (entry.method === 8) {
        output = inflateRaw(compressed);
      }
      else {
        throw new Error(`暂不支持的压缩方式：${entry.method}`);
      }
    }
    catch (error) {
      throw new Error(`无法解析 docx 条目 ${entry.name} 的压缩内容：${error.message || error}`);
    }

    if (output.byteLength !== entry.uncompressedSize) {
      throw new Error(
        `docx 条目 ${entry.name} 解压长度不符：期望 ${entry.uncompressedSize}，实际 ${output.byteLength}。`
      );
    }
    return output;
  }

  findEndOfCentralDirectory() {
    const minOffset = Math.max(0, this.bytes.length - 0xffff - 22);
    for (let offset = this.bytes.length - 22; offset >= minOffset; offset -= 1) {
      if (this.view.getUint32(offset, true) === EOCD_SIGNATURE) {
        return offset;
      }
    }
    throw new Error("无法读取 docx：未找到 ZIP 中央目录。");
  }
}

export function inflateRaw(bytes) {
  const reader = new BitReader(bytes);
  const output = [];
  let isFinal = false;

  while (!isFinal) {
    isFinal = reader.readBits(1) === 1;
    const blockType = reader.readBits(2);

    if (blockType === 0) {
      readStoredBlock(reader, output);
    }
    else if (blockType === 1) {
      const [literalTree, distanceTree] = getFixedTrees();
      readCompressedBlock(reader, output, literalTree, distanceTree);
    }
    else if (blockType === 2) {
      const [literalTree, distanceTree] = readDynamicTrees(reader);
      readCompressedBlock(reader, output, literalTree, distanceTree);
    }
    else {
      throw new Error("DEFLATE block type 3 is reserved.");
    }
  }

  return new Uint8Array(output);
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.byteOffset = 0;
    this.bitBuffer = 0;
    this.bitCount = 0;
  }

  readBits(count) {
    while (this.bitCount < count) {
      if (this.byteOffset >= this.bytes.length) {
        throw new Error("压缩数据意外结束。");
      }
      this.bitBuffer |= this.bytes[this.byteOffset] << this.bitCount;
      this.byteOffset += 1;
      this.bitCount += 8;
    }

    const value = this.bitBuffer & ((1 << count) - 1);
    this.bitBuffer >>>= count;
    this.bitCount -= count;
    return value;
  }

  alignByte() {
    this.bitBuffer = 0;
    this.bitCount = 0;
  }

  readByte() {
    if (this.byteOffset >= this.bytes.length) {
      throw new Error("压缩数据意外结束。");
    }
    return this.bytes[this.byteOffset++];
  }
}

function readStoredBlock(reader, output) {
  reader.alignByte();
  const len = reader.readByte() | (reader.readByte() << 8);
  const nlen = reader.readByte() | (reader.readByte() << 8);
  if (((len ^ 0xffff) & 0xffff) !== nlen) {
    throw new Error("stored block length check failed.");
  }
  for (let index = 0; index < len; index += 1) {
    output.push(reader.readByte());
  }
}

function readCompressedBlock(reader, output, literalTree, distanceTree) {
  while (true) {
    const symbol = literalTree.decode(reader);
    if (symbol < 256) {
      output.push(symbol);
      continue;
    }
    if (symbol === 256) {
      return;
    }
    if (symbol < 257 || symbol > 285) {
      throw new Error(`invalid literal/length symbol ${symbol}.`);
    }

    const lengthIndex = symbol - 257;
    let length = LENGTH_BASE[lengthIndex];
    const lengthExtra = LENGTH_EXTRA[lengthIndex];
    if (lengthExtra) {
      length += reader.readBits(lengthExtra);
    }

    const distanceSymbol = distanceTree.decode(reader);
    if (distanceSymbol < 0 || distanceSymbol >= DISTANCE_BASE.length) {
      throw new Error(`invalid distance symbol ${distanceSymbol}.`);
    }
    let distance = DISTANCE_BASE[distanceSymbol];
    const distanceExtra = DISTANCE_EXTRA[distanceSymbol];
    if (distanceExtra) {
      distance += reader.readBits(distanceExtra);
    }
    if (distance <= 0 || distance > output.length) {
      throw new Error(`invalid back-reference distance ${distance}.`);
    }

    for (let index = 0; index < length; index += 1) {
      output.push(output[output.length - distance]);
    }
  }
}

function readDynamicTrees(reader) {
  const literalCount = reader.readBits(5) + 257;
  const distanceCount = reader.readBits(5) + 1;
  const codeLengthCount = reader.readBits(4) + 4;
  const codeLengthLengths = Array(19).fill(0);

  for (let index = 0; index < codeLengthCount; index += 1) {
    codeLengthLengths[CODE_LENGTH_ORDER[index]] = reader.readBits(3);
  }

  const codeLengthTree = new HuffmanTree(codeLengthLengths);
  const lengths = [];
  const total = literalCount + distanceCount;

  while (lengths.length < total) {
    const symbol = codeLengthTree.decode(reader);
    if (symbol <= 15) {
      lengths.push(symbol);
    }
    else if (symbol === 16) {
      if (!lengths.length) {
        throw new Error("repeat code 16 has no previous code length.");
      }
      const repeat = reader.readBits(2) + 3;
      pushRepeated(lengths, lengths[lengths.length - 1], repeat, total);
    }
    else if (symbol === 17) {
      const repeat = reader.readBits(3) + 3;
      pushRepeated(lengths, 0, repeat, total);
    }
    else if (symbol === 18) {
      const repeat = reader.readBits(7) + 11;
      pushRepeated(lengths, 0, repeat, total);
    }
    else {
      throw new Error(`invalid code length symbol ${symbol}.`);
    }
  }

  const literalLengths = lengths.slice(0, literalCount);
  const distanceLengths = lengths.slice(literalCount);
  return [
    new HuffmanTree(literalLengths),
    distanceLengths.some((length) => length > 0)
      ? new HuffmanTree(distanceLengths)
      : new EmptyHuffmanTree("distance")
  ];
}

function pushRepeated(target, value, repeat, maxLength) {
  for (let index = 0; index < repeat; index += 1) {
    if (target.length >= maxLength) {
      throw new Error("code length repeat exceeds declared table size.");
    }
    target.push(value);
  }
}

class HuffmanTree {
  constructor(lengths) {
    this.table = new Map();
    this.maxBits = 0;
    this.build(lengths);
  }

  build(lengths) {
    const maxBits = Math.max(0, ...lengths);
    if (maxBits === 0) {
      throw new Error("empty Huffman tree.");
    }
    this.maxBits = maxBits;

    const counts = Array(maxBits + 1).fill(0);
    for (const length of lengths) {
      if (length > 0) {
        counts[length] += 1;
      }
    }

    const nextCode = Array(maxBits + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxBits; bits += 1) {
      code = (code + counts[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    for (let symbol = 0; symbol < lengths.length; symbol += 1) {
      const length = lengths[symbol];
      if (length === 0) {
        continue;
      }
      const canonical = nextCode[length];
      nextCode[length] += 1;
      const reversed = reverseBits(canonical, length);
      this.table.set(`${length}:${reversed}`, symbol);
    }
  }

  decode(reader) {
    let code = 0;
    for (let length = 1; length <= this.maxBits; length += 1) {
      code |= reader.readBits(1) << (length - 1);
      const symbol = this.table.get(`${length}:${code}`);
      if (symbol !== undefined) {
        return symbol;
      }
    }
    throw new Error("invalid Huffman code.");
  }
}

class EmptyHuffmanTree {
  constructor(name) {
    this.name = name;
  }

  decode() {
    throw new Error(`empty ${this.name} Huffman tree was used.`);
  }
}

function getFixedTrees() {
  if (fixedLiteralTree && fixedDistanceTree) {
    return [fixedLiteralTree, fixedDistanceTree];
  }

  const literalLengths = Array(288).fill(0);
  for (let index = 0; index <= 143; index += 1) {
    literalLengths[index] = 8;
  }
  for (let index = 144; index <= 255; index += 1) {
    literalLengths[index] = 9;
  }
  for (let index = 256; index <= 279; index += 1) {
    literalLengths[index] = 7;
  }
  for (let index = 280; index <= 287; index += 1) {
    literalLengths[index] = 8;
  }

  fixedLiteralTree = new HuffmanTree(literalLengths);
  fixedDistanceTree = new HuffmanTree(Array(32).fill(5));
  return [fixedLiteralTree, fixedDistanceTree];
}

function reverseBits(value, length) {
  let reversed = 0;
  for (let index = 0; index < length; index += 1) {
    reversed = (reversed << 1) | (value & 1);
    value >>>= 1;
  }
  return reversed;
}

function decodeZipName(bytes, flags) {
  if ((flags & 0x0800) !== 0) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  return [...bytes].map((byte) => String.fromCharCode(byte)).join("");
}
