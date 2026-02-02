import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database', 'sm-volunteers.db');

console.log('Checking database schema...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
});

// Get all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
        console.error('Error getting tables:', err);
        process.exit(1);
    }

    console.log('Tables in database:');
    tables.forEach(t => console.log(`  - ${t.name}`));

    // Check if bill_folders exists
    const hasBillFolders = tables.some(t => t.name === 'bill_folders');

    if (!hasBillFolders) {
        console.log('\n❌ bill_folders table does not exist!');
        console.log('Creating bill_folders table...\n');

        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS bill_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        parent_folder_id INTEGER DEFAULT NULL,
        is_file BOOLEAN DEFAULT 0,
        file_path TEXT DEFAULT NULL,
        file_size INTEGER DEFAULT NULL,
        file_type TEXT DEFAULT NULL,
        file_name TEXT DEFAULT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (parent_folder_id) REFERENCES bill_folders(id)
      )
    `;

        db.run(createTableSQL, (err) => {
            if (err) {
                console.error('Error creating table:', err);
            } else {
                console.log('✅ bill_folders table created successfully!');
            }
            db.close();
            process.exit(0);
        });
    } else {
        // Check current schema
        db.all(`PRAGMA table_info(bill_folders)`, (err, columns) => {
            if (err) {
                console.error('Error getting schema:', err);
                db.close();
                process.exit(1);
            }

            console.log('\nCurrent bill_folders columns:');
            columns.forEach(col => {
                console.log(`  - ${col.name} (${col.type})`);
            });

            db.close();
            process.exit(0);
        });
    }
});
