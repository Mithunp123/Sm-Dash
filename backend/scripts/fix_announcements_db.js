import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../database/sm_volunteers.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.run("ALTER TABLE announcements ADD COLUMN deadline TEXT", (err) => {
        if (err) {
            console.log("Error adding deadline (might exist):", err.message);
        } else {
            console.log("Success: Added deadline column.");
        }
    });
});
