#!/usr/bin/env node
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/sm_volunteers.db');

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Error opening DB:', err.message);
    process.exit(1);
  }
});

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function main() {
  try {
    const eventId = 1; // Childrens Day (from inspection)

    // Get members
    const members = await all('SELECT em.user_id, u.name FROM event_members em LEFT JOIN users u ON em.user_id = u.id WHERE em.event_id = ?', [eventId]);
    if (!members || members.length === 0) {
      console.log('No members found for event', eventId);
      return;
    }

    // Insert sample attendance for each member if none exists for that date
    const sampleDate = '2025-11-14T10:00:00';

    for (const [i, m] of members.entries()) {
      const existing = await all('SELECT id FROM event_attendance WHERE event_id = ? AND user_id = ? AND DATE(marked_at) = DATE(?)', [eventId, m.user_id, sampleDate]);
      if (existing && existing.length > 0) {
        console.log(`Skipping user ${m.user_id} (${m.name}) - attendance already exists for date`);
        continue;
      }

      const status = i === 0 ? 'present' : (i === 1 ? 'absent' : 'late');
      const res = await run('INSERT INTO event_attendance (event_id, user_id, status, marked_at, notes) VALUES (?, ?, ?, ?, ?)', [eventId, m.user_id, status, sampleDate, 'Imported sample']);
      console.log(`Inserted attendance id=${res.lastID} for user ${m.user_id} (${m.name}) status=${status}`);
    }

    const rows = await all('SELECT ea.id, ea.event_id, ea.user_id, ea.status, ea.marked_at, ea.notes, u.name as marked_by_name FROM event_attendance ea LEFT JOIN users u ON ea.marked_by = u.id WHERE ea.event_id = ? ORDER BY ea.marked_at DESC', [eventId]);
    console.log('event_attendance rows now: ', rows.length);
    console.table(rows);
  } catch (err) {
    console.error('Error inserting sample attendance:', err.message || err);
  } finally {
    db.close();
  }
}

main();
