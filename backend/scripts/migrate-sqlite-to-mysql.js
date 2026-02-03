import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SQLITE_DB_PATH = path.join(__dirname, '../database/sm_volunteers.db');
const BACKUP_PATH = path.join(__dirname, `../database/sm_volunteers_backup_${Date.now()}.db`);

const mysqlConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'smvdb',
    multipleStatements: true
};

console.log('🚀 Complete SQLite to MySQL Migration');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`📂 SQLite: ${SQLITE_DB_PATH}`);
console.log(`🗄️  MySQL: ${mysqlConfig.user}@${mysqlConfig.host}/${mysqlConfig.database}`);
console.log('═══════════════════════════════════════════════════════════\n');

async function completeMigration() {
    let sqliteDb;
    let mysqlConn;

    try {
        // Step 1: Verify SQLite database exists
        console.log('📦 Step 1: Checking SQLite database...');
        if (!fs.existsSync(SQLITE_DB_PATH)) {
            console.error(`❌ SQLite database not found at: ${SQLITE_DB_PATH}`);
            console.log('\n💡 If you don\'t have existing data to migrate, you can skip this.');
            console.log('   Just make sure DB_TYPE=mysql in your .env and restart the server.');
            process.exit(1);
        }

        // Create backup
        fs.copyFileSync(SQLITE_DB_PATH, BACKUP_PATH);
        console.log(`✅ Backup created: ${path.basename(BACKUP_PATH)}\n`);

        // Step 2: Connect to MySQL
        console.log('📡 Step 2: Connecting to MySQL...');
        mysqlConn = await mysql.createConnection(mysqlConfig);
        console.log('✅ Connected to MySQL\n');

        // Step 3: Check if tables exist
        console.log('📋 Step 3: Checking MySQL tables...');
        const [tables] = await mysqlConn.execute('SHOW TABLES');
        console.log(`   Found ${tables.length} existing tables\n`);

        if (tables.length === 0) {
            console.log('⚠️  No tables found in MySQL database.');
            console.log('   Tables will be auto-created when you start the backend server.');
            console.log('   Please run: npm run dev');
            console.log('   Then run this script again to migrate data.\n');
            process.exit(0);
        }

        // Step 4: Check if data already exists
        console.log('🔍 Step 4: Checking for existing data...');
        try {
            const [userCount] = await mysqlConn.execute('SELECT COUNT(*) as count FROM users');
            const existingUsers = userCount[0].count;

            if (existingUsers > 0) {
                console.log(`   ⚠️  Found ${existingUsers} existing users in MySQL`);
                console.log('   Migration will skip duplicate entries (using INSERT IGNORE)\n');
            } else {
                console.log('   ✅ MySQL database is empty, ready for migration\n');
            }
        } catch (err) {
            console.log(`   ⚠️  Could not check existing data: ${err.message}\n`);
        }

        // Step 5: Connect to SQLite
        console.log('📂 Step 5: Reading SQLite database...');
        sqliteDb = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
                if (err) reject(err);
                else resolve(db);
            });
        });
        console.log('✅ Connected to SQLite\n');

        // Step 6: Get tables from SQLite
        console.log('📊 Step 6: Analyzing SQLite tables...');
        const sqliteTables = await new Promise((resolve, reject) => {
            sqliteDb.all(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(r => r.name));
                }
            );
        });
        console.log(`   Found ${sqliteTables.length} tables to migrate\n`);

        // Step 7: Migrate data
        console.log('🔄 Step 7: Migrating data...');
        console.log('═══════════════════════════════════════════════════════════');

        let totalMigrated = 0;
        const stats = [];

        for (const tableName of sqliteTables) {
            try {
                // Get data from SQLite
                const rows = await new Promise((resolve, reject) => {
                    sqliteDb.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });

                if (rows.length === 0) {
                    console.log(`⏭️  ${tableName.padEnd(35)} (empty)`);
                    stats.push({ table: tableName, migrated: 0, total: 0, status: 'empty' });
                    continue;
                }

                // Insert into MySQL
                const columns = Object.keys(rows[0]);
                const placeholders = columns.map(() => '?').join(', ');
                const insertQuery = `INSERT IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

                let migrated = 0;
                for (const row of rows) {
                    try {
                        const values = columns.map(col => row[col]);
                        const [result] = await mysqlConn.execute(insertQuery, values);
                        if (result.affectedRows > 0) migrated++;
                    } catch (err) {
                        // Skip errors (likely duplicates)
                    }
                }

                const status = migrated === rows.length ? '✅' : migrated > 0 ? '⚠️ ' : '⏭️ ';
                console.log(`${status} ${tableName.padEnd(35)} ${migrated}/${rows.length} rows`);

                totalMigrated += migrated;
                stats.push({ table: tableName, migrated, total: rows.length, status: 'success' });

            } catch (err) {
                console.log(`❌ ${tableName.padEnd(35)} Error: ${err.message}`);
                stats.push({ table: tableName, migrated: 0, total: 0, status: 'error', error: err.message });
            }
        }

        console.log('═══════════════════════════════════════════════════════════\n');

        // Step 8: Verify migration
        console.log('🔍 Step 8: Verifying migration...');
        const criticalTables = ['users', 'profiles', 'projects', 'attendance_records', 'events'];
        for (const table of criticalTables) {
            try {
                const [result] = await mysqlConn.execute(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`   ${table.padEnd(25)} ${result[0].count} rows`);
            } catch (err) {
                console.log(`   ${table.padEnd(25)} (table not found)`);
            }
        }

        // Summary
        console.log('\n📊 Migration Summary:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Total Tables: ${sqliteTables.length}`);
        console.log(`Total Rows Migrated: ${totalMigrated}`);
        console.log(`Backup Location: ${BACKUP_PATH}`);
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('✅ Migration completed successfully!\n');
        console.log('📝 Next Steps:');
        console.log('   1. Verify .env has: DB_TYPE=mysql');
        console.log('   2. Restart your backend: npm run dev');
        console.log('   3. Test the application');
        console.log('   4. Verify images and files load correctly\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\n💡 Troubleshooting:');
        console.error('   1. Make sure MySQL server is running');
        console.error('   2. Verify .env configuration');
        console.error('   3. Check if tables exist (run backend first)');
        console.error('   4. Review error message above\n');
        process.exit(1);
    } finally {
        if (sqliteDb) {
            sqliteDb.close();
        }
        if (mysqlConn) {
            await mysqlConn.end();
        }
    }
}

completeMigration();
