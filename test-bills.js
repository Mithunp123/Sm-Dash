
import { getDatabase } from './backend/database/init.js';
import dotenv from 'dotenv';
dotenv.config();

const test = async () => {
    try {
        const db = getDatabase();
        console.log('Testing bills query...');
        const result = await db.all(`
      SELECT b.*, 
             u1.name as submitted_by_name,
             u2.name as approved_by_name,
             p.title as project_title,
             bf.name as folder_name
      FROM bills b
      LEFT JOIN users u1 ON b.submitted_by = u1.id
      LEFT JOIN users u2 ON b.approved_by = u2.id
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN bill_folders bf ON b.folder_id = bf.id
      ORDER BY b.created_at DESC
    `);
        console.log('Result:', result);
        process.exit(0);
    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
};

test();
