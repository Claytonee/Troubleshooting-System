require('dotenv').config();

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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
  const caPath = path.join(__dirname, 'ca.pem');
  poolConfig.ssl = {
    ca: fs.readFileSync(caPath, 'utf8'),
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
