const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  host: env.PG_HOST,
  port: env.PG_PORT,
  user: env.PG_USER,
  password: env.PG_PASSWORD,
  database: env.PG_DATABASE,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[Postgres] Unexpected error on idle client:', err);
});

async function testPgConnection() {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as current_time, current_database() as db_name;');
    client.release();
    console.log(`[Postgres] Connected to PostgreSQL (${res.rows[0].db_name}) at ${res.rows[0].current_time}`);
    return true;
  } catch (err) {
    console.error(`[Postgres] Failed to connect to PostgreSQL at ${env.PG_HOST}:${env.PG_PORT}:`, err.message);
    return false;
  }
}

// Parameterized safe query executor
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL) {
    console.log('[Postgres SQL]', { text, duration, rows: res.rowCount });
  }
  return res;
}

module.exports = {
  pool,
  query,
  testPgConnection
};
