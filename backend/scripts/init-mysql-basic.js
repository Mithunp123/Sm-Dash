import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('🚀 MySQL Database Initialization');
console.log('═══════════════════════════════════════════════════════════\n');

async function initMySQL() {
    let connection;

    try {
        const config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'smvdb',
            multipleStatements: true
        };

        console.log(`📡 Connecting to MySQL at ${config.host}...`);
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to MySQL\n');

        // Import and run the initDatabase function
        console.log('📋 Creating tables...');

        // We'll manually create the key tables here for now
        const tables = [
            {
                name: 'users',
                sql: `CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(255) NOT NULL CHECK(role IN ('admin', 'office_bearer', 'student')),
          must_change_password INT DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
            },
            {
                name: 'profiles',
                sql: `CREATE TABLE IF NOT EXISTS profiles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          role VARCHAR(255) NOT NULL CHECK(role IN ('admin', 'student','office_bearer')),
          dept VARCHAR(255),
          year VARCHAR(255),
          phone VARCHAR(255),
          blood_group VARCHAR(255),
          gender VARCHAR(255),
          dob VARCHAR(255),
          address TEXT,
          photo_url TEXT,
          register_no VARCHAR(255),
          academic_year VARCHAR(255),
          father_number VARCHAR(255),
          hosteller_dayscholar VARCHAR(255),
          position VARCHAR(255),
          custom_fields TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id)
        )`
            }
        ];

        for (const table of tables) {
            try {
                await connection.execute(table.sql);
                console.log(`   ✅ ${table.name}`);
            } catch (err) {
                if (err.code === 'ER_TABLE_EXISTS_ERROR') {
                    console.log(`   ⏭️  ${table.name} (already exists)`);
                } else {
                    console.error(`   ❌ ${table.name}: ${err.message}`);
                }
            }
        }

        console.log('\n✅ Basic tables created successfully!');
        console.log('\n📝 Next step: Run the full init using the application:');
        console.log('   node scripts/init-db.js');

    } catch (error) {
        console.error('\n❌ Initialization failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

initMySQL();
