require('dotenv').config();

const { Pool } = require('pg');

/**
 * PostgreSQL pool with a mysql2-compatible query() wrapper, so existing
 * controllers (written for mysql2) keep working with minimal changes:
 *   - translates `?` placeholders to `$1, $2, ...`
 *   - SELECT  -> returns [rows, fields]            (rows is an array)
 *   - INSERT  -> returns [{ insertId, affectedRows, rows }]  (auto-appends RETURNING id)
 *   - UPDATE/DELETE -> returns [{ affectedRows, rows }]
 *
 * SSL: enabled when DB_SSL=true (Render/managed Postgres). Falls back to
 * NODE_ENV==='production' for backward compatibility. Disabled locally.
 */

const useSSL = process.env.DB_SSL != null
  ? process.env.DB_SSL === 'true'
  : process.env.NODE_ENV === 'production';

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: useSSL ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'qft_support',
      ssl: useSSL ? { rejectUnauthorized: false } : false
    };

poolConfig.max = 10;

const pgPool = new Pool(poolConfig);

function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

async function query(sql, params = []) {
  const isSelect = /^\s*(select|with|show)/i.test(sql);
  const isInsert = /^\s*insert/i.test(sql);
  let text = toPgPlaceholders(sql);
  if (isInsert && !/\breturning\b/i.test(text)) text += ' RETURNING id';

  const res = await pgPool.query(text, params);

  if (isSelect) return [res.rows, res.fields];

  const insertId = (res.rows && res.rows[0] && res.rows[0].id != null) ? res.rows[0].id : 0;
  return [{ affectedRows: res.rowCount, insertId, rows: res.rows }, res.fields];
}

module.exports = {
  query,
  connect: (...args) => pgPool.connect(...args),
  end: (...args) => pgPool.end(...args),
  _pool: pgPool
};
