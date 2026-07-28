require('dotenv').config();
const { bootstrap } = require('./bootstrap');
const pool = require('./database');

(async () => {
  try {
    console.log('Connecting to MySQL...');
    await bootstrap();
    console.log('All tables created + extensions applied. Migration complete.');
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
})();
