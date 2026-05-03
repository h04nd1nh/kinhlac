/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DEFAULT_JSON =
  'C:/Users/Truong/Downloads/Kinh lac-20260310T150757Z-3-001/Kinh lac/Kinhlac/Kinhlac/kl_bchung_luantri.json';

const FLAG_COLS = [
  'tieutruong_c8', 'tieutruong', 'tieutruong_c11',
  'tam_c8', 'tam', 'tam_c11',
  'tamtieu_c8', 'tamtieu', 'tamtieu_c11',
  'tambao_c8', 'tambao', 'tambao_c11',
  'daitrang_c8', 'daitrang', 'daitrang_c11',
  'phe_c8', 'phe', 'phe_c11',
  'bangquang_c8', 'bangquang', 'bangquang_c11',
  'than_c8', 'than', 'than_c11',
  'dam_c8', 'dam', 'dam_c11',
  'vi_c8', 'vi', 'vi_c11',
  'can_c8', 'can', 'can_c11',
  'ty_c8', 'ty', 'ty_c11',
];

function toInt(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function getDbConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL, ssl: false };
  if (process.env.POSTGRES_URL) return { connectionString: process.env.POSTGRES_URL, ssl: false };
  return {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.DB_NAME || process.env.POSTGRES_DATABASE || 'medicine',
    ssl: false,
  };
}

async function run() {
  const jsonPath = process.env.LEGACY_JSON_PATH || DEFAULT_JSON;
  const schemaSqlPath = path.resolve(__dirname, '../sql/create-legacy-meridian-syndromes.sql');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const rows = JSON.parse(raw);
  const client = new Client(getDbConfig());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(schemaSqlPath, 'utf8'));
    await client.query('TRUNCATE TABLE legacy_meridian_syndromes RESTART IDENTITY');

    const cols = [
      'nhomid',
      'tieuket',
      'trieuchung',
      'benhly',
      'phuyet_chamcuu',
      'giainghia_phuyet',
      'duyet',
      ...FLAG_COLS,
    ];
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO legacy_meridian_syndromes (${cols.join(', ')}) VALUES (${placeholders})`;

    for (const row of rows) {
      const values = [
        row.nhomid ?? null,
        row.tieuket ?? null,
        row.trieuchung ?? null,
        row.benhly ?? null,
        row.phuyet_chamcuu ?? null,
        row.giainghia_phuyet ?? null,
        row.duyet ?? null,
        ...FLAG_COLS.map((c) => toInt(row[c])),
      ];
      await client.query(sql, values);
    }
    await client.query('COMMIT');
    console.log(`Imported ${rows.length} legacy models from ${jsonPath}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error('Import legacy models failed:', e.message);
  process.exit(1);
});
