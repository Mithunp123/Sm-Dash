import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../volunteer_system.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
  fixBillFoldersSchema();
});

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const fixBillFoldersSchema = async () => {
  try {
    // Step 1: Get current schema
    const columns = await all("PRAGMA table_info(bill_folders)");
    
    console.log('\n📋 Current bill_folders schema:');
    columns.forEach((col) => {
      console.log(`  - ${col.name}: ${col.type} (notnull: ${col.notnull})`);
    });

    const hasNameColumn = columns.some((col) => col.name === 'name');
    const hasFolderNameColumn = columns.some((col) => col.name === 'folder_name');

    if (!hasNameColumn && !hasFolderNameColumn) {
      console.log('❌ ERROR: No name or folder_name column found!');
      process.exit(1);
    }

    // Step 2: Backup old table
    console.log('\n🔄 Creating backup of old table...');
    await run('ALTER TABLE bill_folders RENAME TO bill_folders_backup');
    console.log('✅ Backup created (bill_folders_backup)');

    // Step 3: Create new table with correct schema
    console.log('🔄 Creating new table with correct schema...');
    await run(`
      CREATE TABLE bill_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        folder_name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ New table created');

    // Step 4: Migrate data
    console.log('🔄 Migrating data...');
    const sourceColumn = hasFolderNameColumn ? 'folder_name' : 'name';
    await run(`
      INSERT INTO bill_folders (id, event_id, folder_name, description, created_by, created_at, updated_at)
      SELECT id, event_id, COALESCE(${sourceColumn}, 'Unnamed Folder'), description, created_by, created_at, updated_at
      FROM bill_folders_backup
    `);
    console.log('✅ Data migrated successfully');

    // Step 5: Verify
    const newColumns = await all("PRAGMA table_info(bill_folders)");
    console.log('\n📋 New bill_folders schema:');
    newColumns.forEach((col) => {
      console.log(`  - ${col.name}: ${col.type}`);
    });

    const rowCount = await get('SELECT COUNT(*) as count FROM bill_folders');
    console.log(`\n📊 Total rows migrated: ${rowCount.count}`);

    // Step 6: Cleanup backup
    console.log('\n🗑️  Cleaning up backup table...');
    await run('DROP TABLE bill_folders_backup');
    console.log('✅ Backup table removed');

    console.log('\n✅ ✅ ✅ SCHEMA MIGRATION COMPLETED SUCCESSFULLY! ✅ ✅ ✅');
    db.close();
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    process.exit(1);
  }
};

