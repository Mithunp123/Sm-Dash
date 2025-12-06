import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'sm_volunteers.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open DB', DB_PATH, err);
    process.exit(1);
  }
});

db.serialize(() => {
  console.log('Updating resources: set title = original_name where title is NULL or empty');
  db.run("UPDATE resources SET title = original_name WHERE title IS NULL OR trim(title) = ''", function(err) {
    if (err) {
      console.error('Update failed:', err);
      process.exit(1);
    }
    console.log(`Rows updated: ${this.changes}`);

    db.all('SELECT id, title, original_name FROM resources ORDER BY created_at DESC', (err2, rows) => {
      if (err2) {
        console.error('Select failed:', err2);
        process.exit(1);
      }
      console.log('Current resources (id | title | original_name):');
      rows.forEach(r => console.log(`${r.id} | ${r.title} | ${r.original_name}`));
      db.close();
    });
  });
});
