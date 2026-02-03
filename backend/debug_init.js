import { initDatabase, getDatabase } from './database/init.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Starting DB Init Check with MySQL...');
console.log('DB_TYPE:', process.env.DB_TYPE);

initDatabase()
    .then(async () => {
        console.log('Init Success');
        const db = getDatabase();
        if (db && db.end) {
            await db.end(); // Close the pool so the script exits
            console.log('Database connection closed');
        }
    })
    .catch(err => {
        console.error('Init Failed:');
        console.error(err);
        process.exit(1);
    });
