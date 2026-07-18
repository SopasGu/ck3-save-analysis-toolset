import fs from 'node:fs';
import zlib from 'node:zlib';

export const DISCOVERY_VERSION = 1;

const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function appendKey(pointer, key) {
  if (key === '') return pointer + "['']";
  if (SAFE_KEY_RE.test(key)) return pointer + '.' + key;
  const escaped = String(key).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return pointer + "['" + escaped + "']";
}

function appendIndex(pointer, index) {
  return pointer + '[' + index + ']';
}

export class ParseError extends Error {
  constructor(message, position) {
    super(message + (position != null ? ` (at byte ${position})` : ''));
    this.name = 'ParseError';
    this.position = position;
  }
}

export class StreamingJsonParser {
  constructor(handlers) {
    if (!handlers || typeof handlers.observe !== 'function') {
      throw new Error('StreamingJsonParser requires handlers.observe');
    }
    this.observe = handlers.observe;
    this.onError = handlers.onError;

    this.buffer = '';
    this.pos = 0;
    this.stack = [];
    this.currentKey = null;
    this.expectKey = false;
    this.expectValue = false;
    this.ended = false;
    this._stringState = null;
    this._numberState = null;
    this._literalState = null;
    this._literalProgress = 0;
    this.fatal = false;
  }

  feed(chunk) {
    if (this.ended) throw new Error('feed() called after end()');
    this.buffer += chunk;
    this._parse();
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    if (this.fatal) return;
    this._skipWs();
    if (this._stringState) {
      this._fail('Unterminated string at end of input');
      return;
    }
    if (this._numberState) {
      const start = this._numberState.start;
      const pos = this._numberState.pos;
      if (pos > start) {
        this.pos = pos;
        const completed = this._finalizeNumber(start);
        if (completed !== null) {
          this._emitPrimitive('number', completed);
        }
      } else {
        this._fail('Unterminated number at end of input');
      }
      return;
    }
    if (this._literalState) {
      this._fail(`Unterminated literal at end of input`);
      return;
    }
    if (this.pos < this.buffer.length) {
      this._fail('Trailing content after JSON value');
      return;
    }
    if (this.stack.length > 0) {
      this._fail('Unclosed containers at end of input');
    }
  }

  _fail(msg) {
    const err = new ParseError(msg, this.pos);
    this.fatal = true;
    if (this.onError) this.onError(err);
    else throw err;
  }

  _parse() {
    while (this.pos < this.buffer.length) {
      if (this.fatal) return;
      if (this._stringState) {
        const completed = this._continueString();
        if (!completed) return;
        if (this.expectKey) {
          this.currentKey = completed;
          this.expectKey = false;
          continue;
        }
        this._emitPrimitive('string', completed);
        continue;
      }
      if (this._numberState) {
        const completed = this._continueNumber();
        if (completed === null) return;
        this._emitPrimitive('number', completed);
        continue;
      }
      if (this._literalState) {
        this._continueLiteral();
        if (this.fatal) return;
        continue;
      }
      const startPos = this.pos;
      this._skipWs();
      if (this.pos >= this.buffer.length) break;
      const c = this.buffer[this.pos];

      if (this.expectKey && c !== '"' && c !== '}') {
        this._fail(`Expected string key or '}' but got ${JSON.stringify(c)}`);
        return;
      }

      if (c === '{') {
        this._openObject();
      } else if (c === '}') {
        this._closeObject();
      } else if (c === '[') {
        this._openArray();
      } else if (c === ']') {
        this._closeArray();
      } else if (c === ',') {
        this._comma();
      } else if (c === ':') {
        this._colon();
      } else if (c === '"') {
        this._readStringValue();
      } else if (c === 't') {
        this._readBool();
      } else if (c === 'f') {
        this._readFalse();
      } else if (c === 'n') {
        this._readNull();
      } else if (c === '-' || (c >= '0' && c <= '9')) {
        this._readNumber();
      } else {
        this._fail(`Unexpected character ${JSON.stringify(c)}`);
        return;
      }

      if (
        this.pos === startPos &&
        !this._stringState &&
        !this._numberState &&
        !this._literalState
      ) {
        this._fail('Parser made no progress');
        return;
      }
    }
    if (
      this.pos > 65536 &&
      !this._stringState &&
      !this._numberState &&
      !this._literalState
    ) {
      this.buffer = this.buffer.slice(this.pos);
      this.pos = 0;
    }
  }

  _skipWs() {
    while (this.pos < this.buffer.length) {
      const c = this.buffer[this.pos];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') this.pos++;
      else break;
    }
  }

  _currentPointer() {
    let p = '$';
    for (let i = 1; i < this.stack.length; i++) {
      const frame = this.stack[i];
      if (typeof frame.address === 'number') p = appendIndex(p, frame.address);
      else if (frame.address != null) p = appendKey(p, frame.address);
    }
    return p;
  }

  _pointerAtValue() {
    let p = this._currentPointer();
    const top = this.stack[this.stack.length - 1];
    if (!top) return p;
    if (top.type === 'object') {
      if (this.currentKey != null) p = appendKey(p, this.currentKey);
    } else {
      p = appendIndex(p, top.index);
    }
    return p;
  }

  _nextAddress() {
    const top = this.stack[this.stack.length - 1];
    if (!top) return null;
    if (top.type === 'object') return this.currentKey;
    const idx = top.index;
    top.index++;
    return idx;
  }

  _parentType() {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1].type;
  }

  _openObject() {
    const parentFrame = this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    if (parentFrame && !this.expectValue) {
      const closer = parentFrame.type === 'object' ? '}' : ']';
      this._fail(`Expected ',' or '${closer}' before '{'`);
      return;
    }
    const parentPointer = parentFrame ? this._currentPointer() : null;
    const address = this._nextAddress();
    this.pos++;
    this.stack.push({ type: 'object', address, childCount: 0 });
    this.observe({
      pointer: this._currentPointer(),
      parentPointer,
      depth: this.stack.length,
      parentType: parentFrame ? parentFrame.type : null,
      key: typeof address === 'string' ? address : null,
      index: typeof address === 'number' ? address : null,
      valueType: 'object',
      value: null,
    });
    this.currentKey = null;
    this.expectKey = true;
    this.expectValue = false;
  }

  _closeObject() {
    const top = this.stack[this.stack.length - 1];
    if (!top || top.type !== 'object') {
      this._fail("Unexpected '}'");
      return;
    }
    this.pos++;
    this.stack.pop();
    this.expectKey = false;
    this.expectValue = false;
    this.currentKey = null;
  }

  _openArray() {
    const parentFrame = this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    if (parentFrame && !this.expectValue) {
      const closer = parentFrame.type === 'object' ? '}' : ']';
      this._fail(`Expected ',' or '${closer}' before '['`);
      return;
    }
    const parentPointer = parentFrame ? this._currentPointer() : null;
    const address = this._nextAddress();
    this.pos++;
    this.stack.push({ type: 'array', address, index: 0 });
    this.observe({
      pointer: this._currentPointer(),
      parentPointer,
      depth: this.stack.length,
      parentType: parentFrame ? parentFrame.type : null,
      key: typeof address === 'string' ? address : null,
      index: typeof address === 'number' ? address : null,
      valueType: 'array',
      value: null,
    });
    this.currentKey = null;
    this.expectKey = false;
    this.expectValue = true;
  }

  _closeArray() {
    const top = this.stack[this.stack.length - 1];
    if (!top || top.type !== 'array') {
      this._fail("Unexpected ']'");
      return;
    }
    this.pos++;
    this.stack.pop();
    this.expectKey = false;
    this.expectValue = false;
    this.currentKey = null;
  }

  _comma() {
    const top = this.stack[this.stack.length - 1];
    if (!top) {
      this._fail("Unexpected ','");
      return;
    }
    this.pos++;
    if (top.type === 'object') {
      this.expectKey = true;
      this.expectValue = false;
    } else {
      this.expectValue = true;
    }
    this.currentKey = null;
  }

  _colon() {
    const top = this.stack[this.stack.length - 1];
    if (!top || top.type !== 'object' || this.expectKey) {
      this._fail("Unexpected ':'");
      return;
    }
    this.pos++;
    this.expectKey = false;
    this.expectValue = true;
  }

  _readStringValue() {
    if (this.expectKey) {
      const completed = this._readStringContent();
      if (completed === null) return;
      this.currentKey = completed;
      this.expectKey = false;
      return;
    }
    if (!this.expectValue && this.stack.length > 0) {
      this._fail('String value not expected here');
      return;
    }
    const completed = this._readStringContent();
    if (completed === null) return;
    this._emitPrimitive('string', completed);
  }

  _readStringContent() {
    this.pos++;
    let str = '';
    while (this.pos < this.buffer.length) {
      const c = this.buffer[this.pos];
      if (c === '"') {
        this.pos++;
        this._stringState = null;
        return str;
      }
      if (c === '\\') {
        if (this.pos + 1 >= this.buffer.length) {
          this._stringState = { str, pos: this.pos };
          return null;
        }
        const esc = this.buffer[this.pos + 1];
        switch (esc) {
          case '"': str += '"'; this.pos += 2; break;
          case '\\': str += '\\'; this.pos += 2; break;
          case '/': str += '/'; this.pos += 2; break;
          case 'b': str += '\b'; this.pos += 2; break;
          case 'f': str += '\f'; this.pos += 2; break;
          case 'n': str += '\n'; this.pos += 2; break;
          case 'r': str += '\r'; this.pos += 2; break;
          case 't': str += '\t'; this.pos += 2; break;
          case 'u': {
            if (this.pos + 6 > this.buffer.length) {
              this._stringState = { str, pos: this.pos };
              return null;
            }
            const hex = this.buffer.slice(this.pos + 2, this.pos + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              this._fail(`Invalid unicode escape \\u${hex}`);
              return str;
            }
            str += String.fromCharCode(parseInt(hex, 16));
            this.pos += 6;
            break;
          }
          default:
            this._fail(`Invalid escape \\${esc}`);
            return str;
        }
        continue;
      }
      const code = c.charCodeAt(0);
      if (code < 0x20) {
        this._fail(`Unescaped control char in string (0x${code.toString(16)})`);
        return str;
      }
      str += c;
      this.pos++;
    }
    this._stringState = { str, pos: this.pos };
    return null;
  }

  _continueString() {
    if (!this._stringState) return null;
    let { str, pos } = this._stringState;
    this.pos = pos;
    while (this.pos < this.buffer.length) {
      const c = this.buffer[this.pos];
      if (c === '"') {
        this.pos++;
        this._stringState = null;
        return str;
      }
      if (c === '\\') {
        if (this.pos + 1 >= this.buffer.length) {
          this._stringState = { str, pos: this.pos };
          return null;
        }
        const esc = this.buffer[this.pos + 1];
        switch (esc) {
          case '"': str += '"'; this.pos += 2; break;
          case '\\': str += '\\'; this.pos += 2; break;
          case '/': str += '/'; this.pos += 2; break;
          case 'b': str += '\b'; this.pos += 2; break;
          case 'f': str += '\f'; this.pos += 2; break;
          case 'n': str += '\n'; this.pos += 2; break;
          case 'r': str += '\r'; this.pos += 2; break;
          case 't': str += '\t'; this.pos += 2; break;
          case 'u': {
            if (this.pos + 6 > this.buffer.length) {
              this._stringState = { str, pos: this.pos };
              return null;
            }
            const hex = this.buffer.slice(this.pos + 2, this.pos + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              this._fail(`Invalid unicode escape \\u${hex}`);
              return str;
            }
            str += String.fromCharCode(parseInt(hex, 16));
            this.pos += 6;
            break;
          }
          default:
            this._fail(`Invalid escape \\${esc}`);
            return str;
        }
        continue;
      }
      const code = c.charCodeAt(0);
      if (code < 0x20) {
        this._fail(`Unescaped control char in string (0x${code.toString(16)})`);
        return str;
      }
      str += c;
      this.pos++;
    }
    this._stringState = { str, pos: this.pos };
    return null;
  }

  _readBool() {
    if (!this.expectValue && this.stack.length > 0) {
      this._fail('Boolean value not expected here');
      return;
    }
    this._literalState = { kind: 'bool', value: true };
    this._continueLiteral();
  }

  _readFalse() {
    if (!this.expectValue && this.stack.length > 0) {
      this._fail('Boolean value not expected here');
      return;
    }
    this._literalState = { kind: 'bool', value: false };
    this._continueLiteral();
  }

  _readNull() {
    if (!this.expectValue && this.stack.length > 0) {
      this._fail('null value not expected here');
      return;
    }
    this._literalState = { kind: 'null', value: null };
    this._continueLiteral();
  }

  _continueLiteral() {
    const state = this._literalState;
    if (!state) return;
    const target = state.kind === 'bool'
      ? (state.value ? 'true' : 'false')
      : 'null';
    let i = this._literalProgress || 0;
    while (i < target.length && this.pos < this.buffer.length) {
      if (this.buffer[this.pos] !== target[i]) {
        this._fail(`Invalid literal (expected ${target})`);
        return;
      }
      this.pos++;
      i++;
    }
    if (i < target.length) {
      this._literalProgress = i;
      return;
    }
    if (state.kind === 'bool') {
      this._emitPrimitive('boolean', state.value);
    } else {
      this._emitPrimitive('null', state.value);
    }
    this._literalState = null;
    this._literalProgress = 0;
  }

  _readNumber() {
    if (!this.expectValue && this.stack.length > 0) {
      this._fail('Number value not expected here');
      return;
    }
    const start = this.pos;
    this._numberState = { start, stage: 'int', pos: start };
    const completed = this._continueNumber();
    if (completed === null) return;
    this._emitPrimitive('number', completed);
  }


  _continueNumber() {
    if (!this._numberState) return null;
    const state = this._numberState;
    this.pos = state.pos;
    if (state.stage === 'int') {
      if (this.buffer[this.pos] === '-') this.pos++;
      while (this.pos < this.buffer.length && this.buffer[this.pos] >= '0' && this.buffer[this.pos] <= '9') this.pos++;
      if (this.pos >= this.buffer.length) {
        state.pos = this.pos;
        return null;
      }
      if (this.buffer[this.pos] === '.') {
        this.pos++;
        state.stage = 'frac';
      } else if (this.buffer[this.pos] === 'e' || this.buffer[this.pos] === 'E') {
        this.pos++;
        state.stage = 'exp_sign';
      } else {
        return this._finalizeNumber(state.start);
      }
    }
    if (state.stage === 'frac') {
      while (this.pos < this.buffer.length && this.buffer[this.pos] >= '0' && this.buffer[this.pos] <= '9') this.pos++;
      if (this.pos >= this.buffer.length) {
        state.pos = this.pos;
        return null;
      }
      if (this.buffer[this.pos] === 'e' || this.buffer[this.pos] === 'E') {
        this.pos++;
        state.stage = 'exp_sign';
      } else {
        return this._finalizeNumber(state.start);
      }
    }
    if (state.stage === 'exp_sign') {
      if (this.buffer[this.pos] === '+' || this.buffer[this.pos] === '-') this.pos++;
      state.stage = 'exp';
    }
    if (state.stage === 'exp') {
      while (this.pos < this.buffer.length && this.buffer[this.pos] >= '0' && this.buffer[this.pos] <= '9') this.pos++;
      if (this.pos >= this.buffer.length) {
        state.pos = this.pos;
        return null;
      }
    }
    return this._finalizeNumber(state.start);
  }

  _validateNumberText(text) {
    let i = 0;
    if (text[i] === '-') i++;
    if (i >= text.length || text[i] < '0' || text[i] > '9') {
      return 'no digits in integer part';
    }
    const intStart = i;
    while (i < text.length && text[i] >= '0' && text[i] <= '9') i++;
    const intDigits = i - intStart;
    if (intDigits > 1 && text[intStart] === '0') {
      return 'leading zeros are not allowed';
    }
    if (i < text.length && text[i] === '.') {
      i++;
      const fracStart = i;
      while (i < text.length && text[i] >= '0' && text[i] <= '9') i++;
      if (i === fracStart) {
        return 'no digits after decimal point';
      }
    }
    if (i < text.length && (text[i] === 'e' || text[i] === 'E')) {
      i++;
      if (i < text.length && (text[i] === '+' || text[i] === '-')) i++;
      const expStart = i;
      while (i < text.length && text[i] >= '0' && text[i] <= '9') i++;
      if (i === expStart) {
        return 'no digits in exponent';
      }
    }
    if (i !== text.length) {
      return 'unexpected trailing characters';
    }
    return null;
  }

  _finalizeNumber(start) {
    const text = this.buffer.slice(start, this.pos);
    const validationError = this._validateNumberText(text);
    this._numberState = null;
    if (validationError) {
      this._fail(`Invalid number "${text}": ${validationError}`);
      return null;
    }
    const num = Number(text);
    if (!Number.isFinite(num)) {
      this._fail(`Invalid number: ${text}`);
      return null;
    }
    return num;
  }

  _emitPrimitive(valueType, value) {
    const top = this.stack[this.stack.length - 1];
    let address = null;
    if (top) {
      if (top.type === 'object') {
        address = this.currentKey;
      } else {
        address = top.index;
      }
    }
    const pointer = this._buildPointer(top, address);
    const parentPointer = top ? this._currentPointer() : null;
    if (top && top.type === 'array') top.index++;
    this.observe({
      pointer,
      parentPointer,
      depth: this.stack.length + 1,
      parentType: this._parentType(),
      key: typeof address === 'string' ? address : null,
      index: typeof address === 'number' ? address : null,
      valueType,
      value,
    });
    this.currentKey = null;
    this.expectKey = false;
    this.expectValue = false;
  }

  _buildPointer(top, address) {
    let p = this._currentPointer();
    if (!top) return p;
    if (top.type === 'object') {
      if (address != null) p = appendKey(p, address);
    } else {
      if (typeof address === 'number') p = appendIndex(p, address);
    }
    return p;
  }
}

export class AggregateCollector {
  constructor({ catalogLimit = 10000 } = {}) {
    this.catalogLimit = catalogLimit;
    this.counts = {
      objects: 0,
      arrays: 0,
      primitives: 0,
      nulls: 0,
      strings: 0,
      numbers: 0,
      booleans: 0,
    };
    this.maxDepth = 0;
    this.catalog = new Map();
    this.overflowCount = 0;
    this.distinctPointers = 0;
  }

  observe({ pointer, depth, parentType, key, index, valueType }) {
    if (depth > this.maxDepth) this.maxDepth = depth;
    if (valueType === 'object') this.counts.objects++;
    else if (valueType === 'array') this.counts.arrays++;
    else {
      this.counts.primitives++;
      if (valueType === 'null') this.counts.nulls++;
      else if (valueType === 'string') this.counts.strings++;
      else if (valueType === 'number') this.counts.numbers++;
      else if (valueType === 'boolean') this.counts.booleans++;
    }
    if (!this.catalog.has(pointer)) {
      if (this.catalog.size >= this.catalogLimit) {
        this.overflowCount++;
        return;
      }
      this.catalog.set(pointer, {
        depth,
        parentType,
        key,
        index,
        valueType,
        occurrenceCount: 1,
      });
      this.distinctPointers++;
    } else {
      const entry = this.catalog.get(pointer);
      entry.occurrenceCount++;
    }
  }

  result() {
    const pointerCatalog = Array.from(this.catalog.entries())
      .map(([pointer, info]) => ({ pointer, ...info }))
      .sort((a, b) => (a.pointer < b.pointer ? -1 : a.pointer > b.pointer ? 1 : 0));
    return {
      summary: {
        ...this.counts,
        maxDepth: this.maxDepth,
        catalogSize: this.catalog.size,
        catalogLimit: this.catalogLimit,
        overflowObservations: this.overflowCount,
      },
      pointerCatalog,
    };
  }
}

export class NdjsonCollector {
  constructor(outStream) {
    this.out = outStream;
    this.counts = {
      objects: 0,
      arrays: 0,
      primitives: 0,
      nulls: 0,
      strings: 0,
      numbers: 0,
      booleans: 0,
    };
    this.maxDepth = 0;
    this.linesWritten = 0;
  }

  observe({ pointer, depth, parentType, key, index, valueType, value }) {
    if (depth > this.maxDepth) this.maxDepth = depth;
    if (valueType === 'object') this.counts.objects++;
    else if (valueType === 'array') this.counts.arrays++;
    else {
      this.counts.primitives++;
      if (valueType === 'null') this.counts.nulls++;
      else if (valueType === 'string') this.counts.strings++;
      else if (valueType === 'number') this.counts.numbers++;
      else if (valueType === 'boolean') this.counts.booleans++;
    }
    const line =
      JSON.stringify({
        pointer,
        depth,
        parentType,
        key,
        index,
        valueType,
        value,
      }) + '\n';
    this.out.write(line);
    this.linesWritten++;
  }

  result() {
    return {
      summary: { ...this.counts, maxDepth: this.maxDepth },
      linesWritten: this.linesWritten,
    };
  }
}

export async function discoverStructure({
  source,
  collector,
  onProgress,
  progressIntervalBytes = 1024 * 1024,
}) {
  if (!collector) throw new Error('discoverStructure requires a collector');
  const isGz = source.endsWith('.gz');
  const fileStream = fs.createReadStream(source);
  const stream = isGz ? fileStream.pipe(zlib.createGunzip()) : fileStream;

  let bytesProcessed = 0;
  let nextProgressAt = progressIntervalBytes;
  const startTime = Date.now();
  const peakRss = { value: 0 };

  let parserError = null;
  const parser = new StreamingJsonParser({
    observe: (obs) => collector.observe(obs),
    onError: (err) => {
      parserError = err;
    },
  });

  return await new Promise((resolve, reject) => {
    let settled = false;
    const settleReject = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const settleResolve = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    stream.on('data', (chunk) => {
      if (settled) return;
      bytesProcessed += chunk.length;
      try {
        parser.feed(chunk.toString('utf8'));
      } catch (err) {
        parserError = err;
        stream.destroy();
        return;
      }
      const rss = process.memoryUsage().rss;
      if (rss > peakRss.value) peakRss.value = rss;
      if (onProgress && bytesProcessed >= nextProgressAt) {
        try {
          onProgress({
            bytesProcessed,
            elapsedMs: Date.now() - startTime,
            rssBytes: rss,
          });
        } catch (err) {
          // ignore callback errors
        }
        nextProgressAt = bytesProcessed + progressIntervalBytes;
      }
      if (parserError || parser.fatal) {
        stream.destroy();
      }
    });

    const tryFinalize = () => {
      if (settled) return;
      try {
        parser.end();
      } catch (err) {
        parserError = err;
      }
      if (parserError || parser.fatal) {
        settleReject(parserError || new ParseError('Parse failed', parser.pos));
        return;
      }
      const aggregate = typeof collector.result === 'function' ? collector.result() : {};
      settleResolve({
        diagnostics: {
          bytesProcessed,
          durationMs: Date.now() - startTime,
          peakRssBytes: peakRss.value,
          compressedInput: isGz,
        },
        ...aggregate,
      });
    };

    stream.on('end', tryFinalize);
    stream.on('close', tryFinalize);
    stream.on('error', (err) => settleReject(err));
  });
}
