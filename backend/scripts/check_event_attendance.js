#!/usr/bin/env node
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/sm_volunteers.db');

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening DB:', err.message);
    process.exit(1);
  }
});

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
    // Try a trimmed, case-insensitive match first; fall back to LIKE
    let events = await all(`SELECT id, title, date FROM events WHERE TRIM(title) = ? COLLATE NOCASE`, ['Childrens Day']);
    if (!events || events.length === 0) {
      events = await all(`SELECT id, title, date FROM events WHERE title LIKE ? COLLATE NOCASE`, ['%Children%']);
    }
    if (!events || events.length === 0) {
      console.log('No event matching "Childrens Day" found. Listing all events:');
      const allEvents = await all('SELECT id, title, date FROM events ORDER BY date DESC LIMIT 50');
      console.table(allEvents);
      process.exit(0);
    }

    for (const e of events) {
      console.log('Found event:', e);
      const rows = await all(`SELECT ea.id, ea.event_id, ea.user_id, ea.status, ea.marked_at, ea.notes, u.name as marked_by_name FROM event_attendance ea LEFT JOIN users u ON ea.marked_by = u.id WHERE ea.event_id = ? ORDER BY ea.marked_at DESC`, [e.id]);
      console.log(`event_attendance rows for event id=${e.id}: ${rows.length}`);
      if (rows.length > 0) console.table(rows);

      const members = await all(`SELECT em.user_id, u.name, u.email FROM event_members em LEFT JOIN users u ON em.user_id = u.id WHERE em.event_id = ?`, [e.id]);
      console.log(`event_members for event id=${e.id}: ${members.length}`);
      if (members.length > 0) console.table(members);
    }
  } catch (err) {
    console.error('Query error:', err.message || err);
  } finally {
    db.close();
  }
}

main();
