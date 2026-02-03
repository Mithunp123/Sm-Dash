import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

console.log('🔧 Testing MySQL Connection');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Host: ${process.env.DB_HOST}`);
console.log(`User: ${process.env.DB_USER}`);
console.log(`Database: ${process.env.DB_NAME}`);
console.log(`DB Type: ${process.env.DB_TYPE}`);
console.log('═══════════════════════════════════════════════════════════\n');

async function testConnection() {
    let connection;

    try {
        console.log('📡 Attempting to connect to MySQL...');

        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'smvdb'
        });

        console.log('✅ Successfully connected to MySQL!\n');

        // Test query
        console.log('📊 Testing query...');
        const [rows] = await connection.execute('SELECT DATABASE() as db, VERSION() as version');
        console.log(`   Current Database: ${rows[0].db}`);
        console.log(`   MySQL Version: ${rows[0].version}`);

        // List tables
        console.log('\n📋 Checking tables...');
        const [tables] = await connection.execute('SHOW TABLES');

        if (tables.length === 0) {
            console.log('   ⚠️  No tables found. Database is empty.');
            console.log('   Run: node scripts/init-db.js to create tables');
        } else {
            console.log(`   ✅ Found ${tables.length} tables:`);
            tables.slice(0, 10).forEach(table => {
                const tableName = Object.values(table)[0];
                console.log(`      - ${tableName}`);
            });
            if (tables.length > 10) {
                console.log(`      ... and ${tables.length - 10} more`);
            }
        }

        console.log('\n✅ MySQL connection test passed!');

    } catch (error) {
        console.error('\n❌ Connection failed!');
        console.error(`Error: ${error.message}`);

        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Make sure MySQL server is running');
            console.error('   2. Check if MySQL service is started:');
            console.error('      Get-Service -Name MySQL*');
            console.error('   3. Start MySQL service if needed:');
            console.error('      Start-Service -Name MySQL80');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Check your MySQL password in .env file');
            console.error('   2. Verify MySQL user has access to the database');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('\n💡 Troubleshooting:');
            console.error('   1. Database does not exist. Create it with:');
            console.error('      mysql -u root -p');
            console.error('      CREATE DATABASE smvdb;');
        }

        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testConnection();
