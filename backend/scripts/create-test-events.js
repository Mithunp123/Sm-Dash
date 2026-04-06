import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const testEvents = [
  {
    title: 'Annual Mega Hackathon 2024',
    description: 'A 24-hour coding competition for all students to showcase their skills and win exciting prizes.',
    date: '2024-04-15',
    year: '2024',
    is_special_day: 0,
    max_volunteers: 150
  },
  {
    title: 'Tech Awareness Program',
    description: 'Interactive workshop on latest technologies and career opportunities in IT industry.',
    date: '2024-05-20',
    year: '2024',
    is_special_day: 1,
    max_volunteers: 200
  },
  {
    title: 'Charity Walk for Education',
    description: 'Community outreach event to raise funds for underprivileged students education.',
    date: '2024-06-10',
    year: '2024',
    is_special_day: 0,
    max_volunteers: 300
  },
  {
    title: 'Annual Sports Day',
    description: 'Inter-department sports competition with various indoor and outdoor events.',
    date: '2024-07-22',
    year: '2024',
    is_special_day: 1,
    max_volunteers: 250
  },
  {
    title: 'Cultural Fest - Colors 2024',
    description: 'Annual cultural event showcasing talents through dance, music, drama and art performances.',
    date: '2024-08-18',
    year: '2024',
    is_special_day: 1,
    max_volunteers: 400
  },
  {
    title: 'Blood Donation Camp',
    description: 'Medical camp for voluntary blood donation to support local hospitals and blood banks.',
    date: '2024-09-05',
    year: '2024',
    is_special_day: 0,
    max_volunteers: 100
  },
  {
    title: 'Industrial Visit - TCS Office',
    description: 'Educational visit to TCS office to learn about industry practices and job opportunities.',
    date: '2024-10-12',
    year: '2024',
    is_special_day: 0,
    max_volunteers: 80
  },
  {
    title: 'Environment Day Tree Plantation',
    description: 'Green initiative to plant 500+ trees around campus for environmental conservation.',
    date: '2024-11-08',
    year: '2024',
    is_special_day: 1,
    max_volunteers: 200
  }
];

async function createTestEvents() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const connection = await pool.getConnection();

    console.log('🚀 Creating test events...\n');

    for (const event of testEvents) {
      try {
        const query = `
          INSERT INTO events (title, description, date, year, is_special_day, max_volunteers, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        
        const [result] = await connection.execute(query, [
          event.title,
          event.description,
          event.date,
          event.year,
          event.is_special_day,
          event.max_volunteers
        ]);

        console.log(`✅ Created: "${event.title}" (ID: ${result.insertId})`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Skipped: "${event.title}" (Already exists)`);
        } else {
          console.error(`❌ Error creating "${event.title}":`, error.message);
        }
      }
    }

    // Get total events count
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM events');
    console.log(`\n📊 Total events in database: ${countResult[0].count}`);

    connection.release();
    await pool.end();

    console.log('\n✅ Test events creation completed!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Refresh your Finance page in the browser');
    console.log('   2. Events should now appear in the Event List');
    console.log('   3. Click on an event to manage fund raising and expenses');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestEvents();
