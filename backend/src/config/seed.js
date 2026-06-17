require('dotenv').config();
const { bootstrap } = require('./bootstrap');
const pool = require('./database');

// Seeding is part of bootstrap() and only runs when the DB is empty (idempotent).
(async () => {
  try {
    console.log('Seeding database (if empty)...');
    await bootstrap();
    console.log('\nSeed complete! Default login:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('  (All seeded users share password: admin123)');
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  }
})();
