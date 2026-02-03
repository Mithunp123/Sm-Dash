import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('🔍 Post-Migration Verification');
console.log('═══════════════════════════════════════════════════════════\n');

async function verify() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'smvdb'
        });

        console.log('✅ Connected to MySQL\n');

        // Check tables
        console.log('📋 Checking Tables:');
        const [tables] = await connection.execute('SHOW TABLES');
        console.log(`   Total tables: ${tables.length}\n`);

        // Check critical data
        console.log('📊 Checking Data:');
        const criticalTables = [
            'users',
            'profiles',
            'projects',
            'events',
            'attendance_records',
            'meetings',
            'bills',
            'teams',
            'resources',
            'volunteers'
        ];

        let totalRecords = 0;
        for (const table of criticalTables) {
            try {
                const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
                const count = result[0].count;
                totalRecords += count;
                const status = count > 0 ? '✅' : '⚠️ ';
                console.log(`   ${status} ${table.padEnd(25)} ${count.toString().padStart(6)} rows`);
            } catch (err) {
                console.log(`   ❌ ${table.padEnd(25)} (not found)`);
            }
        }

        console.log(`\n   Total records: ${totalRecords}\n`);

        // Check file paths
        console.log('📁 Checking File Paths:');
        try {
            const [photos] = await connection.execute(
                'SELECT COUNT(*) as count FROM profiles WHERE photo_url IS NOT NULL'
            );
            console.log(`   Profile photos: ${photos[0].count}`);

            const [projectImages] = await connection.execute(
                'SELECT COUNT(*) as count FROM projects WHERE image_url IS NOT NULL'
            );
            console.log(`   Project images: ${projectImages[0].count}`);

            const [resources] = await connection.execute(
                'SELECT COUNT(*) as count FROM resources'
            );
            console.log(`   Resources: ${resources[0].count}`);
        } catch (err) {
            console.log(`   ⚠️  Could not check file paths: ${err.message}`);
        }

        // Sample data check
        console.log('\n👤 Sample Users:');
        try {
            const [users] = await connection.execute(
                'SELECT id, name, email, role FROM users LIMIT 5'
            );
            users.forEach(user => {
                console.log(`   ${user.id}. ${user.name} (${user.email}) - ${user.role}`);
            });
        } catch (err) {
            console.log(`   ⚠️  Could not fetch users: ${err.message}`);
        }

        // Database info
        console.log('\n🗄️  Database Info:');
        const [dbInfo] = await connection.execute('SELECT DATABASE() as db, VERSION() as version');
        console.log(`   Database: ${dbInfo[0].db}`);
        console.log(`   MySQL Version: ${dbInfo[0].version}`);

        // Size check
        const [sizeInfo] = await connection.execute(`
      SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = ?
    `, [process.env.DB_NAME || 'smvdb']);
        console.log(`   Database Size: ${sizeInfo[0].size_mb} MB`);

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ Verification Complete!');
        console.log('═══════════════════════════════════════════════════════════\n');

        if (totalRecords > 0) {
            console.log('🎉 Migration successful! Your data is in MySQL.');
            console.log('\n📝 Next steps:');
            console.log('   1. Test your application thoroughly');
            console.log('   2. Verify file uploads work');
            console.log('   3. Check that images/PDFs load correctly');
            console.log('   4. Monitor application logs for any errors\n');
        } else {
            console.log('⚠️  No data found in MySQL.');
            console.log('\n💡 Possible reasons:');
            console.log('   1. Migration hasn\'t been run yet');
            console.log('   2. SQLite database was empty');
            console.log('   3. Migration encountered errors\n');
            console.log('Run: node scripts/migrate-sqlite-to-mysql.js\n');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

verify();
