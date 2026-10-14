import dotenv from 'dotenv';
import app from './app.js';
import { checkDbConnection } from './config/db.js';

dotenv.config();

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await checkDbConnection();
    console.log(`✅ Connected to MySQL database: ${process.env.DB_NAME || 'tour_marketplace_db'}`);

    app.listen(PORT, () => {
      console.log(`🚀 Tour Marketplace API running at http://localhost:${PORT}`);
      console.log(`🩺 Health Check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MySQL database:', err.message);
    process.exit(1);
  }
}

startServer();
