import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    multipleStatements: true
  });

  try {
    console.log('Connected to MySQL server. Running schema migrations...');
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`Applying migration: ${file}...`);
      await connection.query(sql);
    }

    console.log(`✅ All migrations applied successfully to '${process.env.DB_NAME || 'tour_marketplace_db'}'!`);

    const [tables] = await connection.query(
      `SHOW TABLES FROM \`${process.env.DB_NAME || 'tour_marketplace_db'}\``
    );
    console.log('Active tables:', tables.map((row) => Object.values(row)[0]));
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

runMigrations();
