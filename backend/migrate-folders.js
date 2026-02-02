import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database', 'sm-volunteers.db');

console.log('Running migration for nested folders...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
});

const migrations = [
    'ALTER TABLE bill_folders ADD COLUMN parent_folder_id INTEGER DEFAULT NULL',
    'ALTER TABLE bill_folders ADD COLUMN is_file BOOLEAN DEFAULT 0',
    'ALTER TABLE bill_folders ADD COLUMN file_path TEXT DEFAULT NULL',
    'ALTER TABLE bill_folders ADD COLUMN file_size INTEGER DEFAULT NULL',
    'ALTER TABLE bill_folders ADD COLUMN file_type TEXT DEFAULT NULL',
    'ALTER TABLE bill_folders ADD COLUMN file_name TEXT DEFAULT NULL'
];

let completed = 0;

migrations.forEach((sql, index) => {
    db.run(sql, (err) => {
        if (err) {
            // Ignore "duplicate column" errors (column already exists)
            if (err.message.includes('duplicate column')) {
                console.log(`✓ Column already exists (skipping): ${sql.split('ADD COLUMN ')[1].split(' ')[0]}`);
            } else {
                console.error(`✗ Error running migration ${index + 1}:`, err.message);
            }
        } else {
            console.log(`✓ Migration ${index + 1} completed: ${sql.split('ADD COLUMN ')[1].split(' ')[0]}`);
        }

        completed++;
        if (completed === migrations.length) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('\n✅ All migrations completed successfully!');
                    console.log('You can now restart the server.');
                }
                process.exit(0);
            });
        }
    });
});
