require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'insightiq_super_secure_jwt_secret_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/insightiq',
  PG_HOST: process.env.PG_HOST || 'localhost',
  PG_PORT: parseInt(process.env.PG_PORT || '5432', 10),
  PG_USER: process.env.PG_USER || 'postgres',
  PG_PASSWORD: process.env.PG_PASSWORD || 'root',
  PG_DATABASE: process.env.PG_DATABASE || 'insightiq',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  DEMO_MODE: process.env.DEMO_MODE === 'true' || !process.env.OPENAI_API_KEY,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000'
};
