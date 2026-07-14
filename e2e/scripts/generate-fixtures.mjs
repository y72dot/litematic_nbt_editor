import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const nbt = require('prismarine-nbt');
const pako = require('pako');

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');
mkdirSync(fixturesDir, { recursive: true });

// ── NBT tag helpers ──────────────────────────────────────────

function str(v) { return { type: 'string', value: v }; }
function int(v) { return { type: 'int', value: v }; }
function long(v) { return { type: 'long', value: BigInt(v) }; }

function cc(obj) {
  // prismarine-nbt compound tags expose children directly on the tag object
  // as well as on .value, so spread value properties onto the tag
  return { type: 'compound', value: obj, ...obj };
}

function longArr(arr) {
  const buf = new BigInt64Array(arr.map(v => BigInt(v)));
  return { type: 'longArray', value: buf };
}

function paletteEntry(name, properties) {
  const entry = { Name: str(name) };
  if (properties && Object.keys(properties).length > 0) {
    const props = {};
    for (const [k, v] of Object.entries(properties)) {
      props[k] = str(v);
    }
    entry.Properties = cc(props);
  }
  return entry;
}

// ── Write helper ─────────────────────────────────────────────

function writeGzippedNbt(filename, rootNbtValue) {
  // Root nbt container needs: { type, name, value }
  const rootTag = { type: 'compound', name: '', value: rootNbtValue };
  const uncompressed = nbt.writeUncompressed(rootTag);
  const compressed = pako.gzip(new Uint8Array(uncompressed));
  writeFileSync(join(fixturesDir, filename), Buffer.from(compressed));
}

// ── Fixture 1: Valid version 6 litematic (3x3x3, air + stone) ─

const airAndStone = [paletteEntry('minecraft:air'), paletteEntry('minecraft:stone')];

writeGzippedNbt('valid-v6.litematic', {
  Version: int(6),
  Metadata: cc({
    Name: str('Test Build'),
    Author: str('E2E Test'),
    Description: str('A 3x3x3 test litematic'),
    EnclosingSize: cc({ x: int(3), y: int(3), z: int(3) }),
    TimeCreated: long(1700000000000n),
    TimeModified: long(1700000001000n),
  }),
  Regions: cc({
    Main: cc({
      Size: cc({ x: int(3), y: int(3), z: int(3) }),
      Position: cc({ x: int(0), y: int(0), z: int(0) }),
      BlockStatePalette: {
        type: 'list',
        value: { type: 'compound', value: airAndStone },
      },
      BlockStates: longArr([0, 0]), // 27 blocks * 2 bits = 54 bits, fits in 2 longs
    }),
  }),
});

console.log('[fixtures] Created valid-v6.litematic');

// ── Fixture 2: Valid version 5 litematic (spanning) ──────────

writeGzippedNbt('valid-v5-spanning.litematic', {
  Version: int(5),
  Metadata: cc({
    Name: str('V5 Spanning Build'),
    Author: str('E2E Test'),
    Description: str('A V5 spanning litematic'),
    EnclosingSize: cc({ x: int(4), y: int(4), z: int(4) }),
    TimeCreated: long(1700000000000n),
    TimeModified: long(1700000001000n),
  }),
  Regions: cc({
    Main: cc({
      Size: cc({ x: int(4), y: int(4), z: int(4) }),
      Position: cc({ x: int(0), y: int(0), z: int(0) }),
      BlockStatePalette: {
        type: 'list',
        value: { type: 'compound', value: airAndStone },
      },
      BlockStates: longArr([0, 0, 0, 0]), // 64 blocks * 2 bits = 128 bits, 2 longs
    }),
  }),
});

console.log('[fixtures] Created valid-v5-spanning.litematic');

// ── Fixture 3: Multi-region litematic ────────────────────────

writeGzippedNbt('multi-region.litematic', {
  Version: int(6),
  Metadata: cc({
    Name: str('Multi-Region Build'),
    Author: str('E2E Test'),
    Description: str('Litematic with 2 regions'),
    EnclosingSize: cc({ x: int(6), y: int(3), z: int(3) }),
    TimeCreated: long(1700000000000n),
    TimeModified: long(1700000001000n),
  }),
  Regions: cc({
    RegionA: cc({
      Size: cc({ x: int(3), y: int(3), z: int(3) }),
      Position: cc({ x: int(0), y: int(0), z: int(0) }),
      BlockStatePalette: {
        type: 'list',
        value: { type: 'compound', value: airAndStone },
      },
      BlockStates: longArr([0, 0]),
    }),
    RegionB: cc({
      Size: cc({ x: int(3), y: int(3), z: int(3) }),
      Position: cc({ x: int(3), y: int(0), z: int(0) }),
      BlockStatePalette: {
        type: 'list',
        value: { type: 'compound', value: airAndStone },
      },
      BlockStates: longArr([0, 0]),
    }),
  }),
});

console.log('[fixtures] Created multi-region.litematic');

// ── Fixture 4: Structure .nbt file ───────────────────────────

writeGzippedNbt('valid-structure.nbt', {
  size: {
    type: 'list',
    value: { type: 'int', value: [int(3), int(3), int(3)] },
  },
  palette: {
    type: 'list',
    value: { type: 'compound', value: [
      paletteEntry('minecraft:air'),
      paletteEntry('minecraft:stone'),
      paletteEntry('minecraft:oak_log', { axis: 'y' }),
    ]},
  },
  blocks: {
    type: 'list',
    value: {
      type: 'compound',
      value: [
        {
          pos: {
            type: 'list',
            value: { type: 'int', value: [int(0), int(0), int(0)] },
          },
          state: int(1),
        },
        {
          pos: {
            type: 'list',
            value: { type: 'int', value: [int(1), int(1), int(1)] },
          },
          state: int(2),
        },
      ],
    },
  },
});

console.log('[fixtures] Created valid-structure.nbt');

// ── Fixture 5: Invalid files ─────────────────────────────────

writeFileSync(join(fixturesDir, 'invalid.litematic'), Buffer.from('this is not a valid NBT file at all'));

console.log('[fixtures] Created invalid.litematic');

const notNbtGzip = pako.gzip(new Uint8Array(Buffer.from('not valid NBT')));
writeFileSync(join(fixturesDir, 'not-gzip.litematic'), Buffer.from(notNbtGzip));

console.log('[fixtures] Created not-gzip.litematic');

// ── Fixture 6: Empty regions litematic ───────────────────────

writeGzippedNbt('empty-regions.litematic', {
  Version: int(6),
  Metadata: cc({
    Name: str('Empty Build'),
    Author: str('E2E Test'),
    Description: str('Litematic with no regions'),
    EnclosingSize: cc({ x: int(1), y: int(1), z: int(1) }),
    TimeCreated: long(1700000000000n),
    TimeModified: long(1700000001000n),
  }),
  Regions: cc({}),
});

console.log('[fixtures] Created empty-regions.litematic');

console.log('\nAll E2E test fixtures generated at', fixturesDir);
