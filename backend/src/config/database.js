const path = require('path');
const envFile = process.env.NODE_ENV && process.env.NODE_ENV !== 'production'
  ? `.env.${process.env.NODE_ENV}`
  : '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', envFile) });
if (!require('fs').existsSync(path.resolve(__dirname, '..', '..', envFile))) {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
}

const mysql = require('mysql2/promise');

/**
 * MySQL2 connection pool.
 * Returns [rows, fields] for SELECT, [{ insertId, affectedRows }] for INSERT/UPDATE/DELETE.
 * Compatible with existing controller patterns that use `?` placeholders.
 */

const poolConfig = process.env.DATABASE_URL
  ? { uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 10 }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'qft_support',
      waitForConnections: true,
      connectionLimit: 10
    };

const pool = mysql.createPool(poolConfig);

module.exports = pool;
