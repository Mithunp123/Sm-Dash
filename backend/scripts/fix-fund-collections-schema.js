import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function fixFundCollectionsSchema() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const connection = await pool.getConnection();

    console.log('🚀 Fixing fund_collections table schema...\n');

    try {
      console.log('📌 Step 1: Dropping old fund_collections table...');
      await connection.execute('DROP TABLE IF EXISTS fund_collections');
      console.log('✅ Dropped fund_collections table\n');

      console.log('📌 Step 2: Creating new fund_collections table with correct foreign key...');
      await connection.execute(`
        CREATE TABLE fund_collections (
          id INT PRIMARY KEY AUTO_INCREMENT,
          event_id INT NOT NULL,
          title TEXT,
          payer_name TEXT NOT NULL,
          payer_dept VARCHAR(100),
          payer_type ENUM('student', 'staff', 'other') DEFAULT 'student',
          amount DECIMAL(10, 2) DEFAULT 0,
          payment_mode ENUM('cash', 'upi') DEFAULT 'cash',
          received_by VARCHAR(255),
          user_id INT,
          status ENUM('active', 'closed') DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          entry_date DATE,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      console.log('✅ Created fund_collections table with correct foreign key\n');

      console.log('✅ Schema migration completed successfully!');
      console.log('\n📌 You can now create fund collections for events.\n');
    } catch (error) {
      console.error('❌ Error during migration:', error.message);
      throw error;
    }

    connection.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixFundCollectionsSchema();
