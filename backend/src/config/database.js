require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const mysql = require('mysql2/promise');

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'qft_support',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

if (process.env.NODE_ENV === 'production') {
  poolConfig.ssl = {};
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
