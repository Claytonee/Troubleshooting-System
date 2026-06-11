const mysql = require('mysql2/promise');
require('dotenv').config();

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
  poolConfig.ssl = { rejectUnauthorized: true };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
