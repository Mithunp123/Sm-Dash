import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const testCollections = [
  { eventId: 1, payerName: 'Rajesh Kumar', amount: 5000, paymentMode: 'cash', payerDept: 'CSE', payerType: 'student' },
  { eventId: 1, payerName: 'Priya Sharma', amount: 10000, paymentMode: 'upi', payerDept: 'ECE', payerType: 'staff' },
  { eventId: 1, payerName: 'Arun Patel', amount: 2500, paymentMode: 'cash', payerDept: 'IT', payerType: 'student' },
  
  { eventId: 2, payerName: 'Sanjana Reddy', amount: 7500, paymentMode: 'upi', payerDept: 'CSE', payerType: 'student' },
  { eventId: 2, payerName: 'Vikram Singh', amount: 15000, paymentMode: 'cash', payerDept: 'ME', payerType: 'staff' },
  
  { eventId: 3, payerName: 'Deepika Nair', amount: 3000, paymentMode: 'cash', payerDept: 'EEE', payerType: 'student' },
  { eventId: 3, payerName: 'Ravi Kumar', amount: 20000, paymentMode: 'upi', payerDept: 'CSE', payerType: 'staff' },
  { eventId: 3, payerName: 'Ananya Singh', amount: 5500, paymentMode: 'cash', payerDept: 'IT', payerType: 'student' },
  
  { eventId: 4, payerName: 'Karthik Sharma', amount: 4000, paymentMode: 'cash', payerDept: 'CSE', payerType: 'student' },
  { eventId: 4, payerName: 'Neha Gupta', amount: 8000, paymentMode: 'upi', payerDept: 'ECE', payerType: 'staff' },
  
  { eventId: 5, payerName: 'Arjun Desai', amount: 6000, paymentMode: 'cash', payerDept: 'IT', payerType: 'student' },
  { eventId: 5, payerName: 'Divya Joshi', amount: 12000, paymentMode: 'upi', payerDept: 'CSE', payerType: 'staff' },
  { eventId: 5, payerName: 'Ashok Verma', amount: 3500, paymentMode: 'cash', payerDept: 'ME', payerType: 'student' },
  
  { eventId: 6, payerName: 'Sneha Kumari', amount: 2000, paymentMode: 'cash', payerDept: 'EEE', payerType: 'student' },
  { eventId: 6, payerName: 'Manish Reddy', amount: 10000, paymentMode: 'upi', payerDept: 'CSE', payerType: 'staff' },
  
  { eventId: 7, payerName: 'Pooja Saxena', amount: 1500, paymentMode: 'cash', payerDept: 'IT', payerType: 'student' },
  { eventId: 7, payerName: 'Rohit Singh', amount: 5000, paymentMode: 'upi', payerDept: 'ECE', payerType: 'staff' },
  
  { eventId: 8, payerName: 'Swati Nair', amount: 4500, paymentMode: 'cash', payerDept: 'CSE', payerType: 'student' },
  { eventId: 8, payerName: 'Nitin Patel', amount: 9000, paymentMode: 'upi', payerDept: 'ME', payerType: 'staff' },
];

async function createTestCollections() {
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

    console.log('🚀 Creating sample fund collections...\n');

    let createdCount = 0;
    let errorCount = 0;

    for (const collection of testCollections) {
      try {
        const query = `
          INSERT INTO fund_collections 
          (event_id, payer_name, amount, payment_mode, payer_dept, payer_type, created_at, entry_date)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURDATE())
        `;
        
        const [result] = await connection.execute(query, [
          collection.eventId,
          collection.payerName,
          collection.amount,
          collection.paymentMode,
          collection.payerDept,
          collection.payerType
        ]);

        console.log(`✅ Added: ${collection.payerName} - ₹${collection.amount} (${collection.paymentMode}) | Event ID: ${collection.eventId}`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Error: ${collection.payerName} - ${error.message}`);
        errorCount++;
      }
    }

    // Get summary by event
    console.log('\n📊 Fund Collection Summary by Event:\n');
    const [summaryResult] = await connection.execute(`
      SELECT 
        fc.event_id, 
        COUNT(fc.id) as collection_count, 
        SUM(fc.amount) as total_collected,
        SUM(CASE WHEN fc.payment_mode = 'cash' THEN fc.amount ELSE 0 END) as cash_total,
        SUM(CASE WHEN fc.payment_mode = 'upi' THEN fc.amount ELSE 0 END) as online_total
      FROM fund_collections fc
      GROUP BY fc.event_id
      ORDER BY fc.event_id
    `);

    let grandTotal = 0;
    summaryResult.forEach(row => {
      const collected = row.total_collected || 0;
      grandTotal += collected;
      const count = row.collection_count || 0;
      console.log(`📍 Event ID ${row.event_id}:`);
      console.log(`   Collections: ${count} | Total: ₹${collected} (Cash: ₹${row.cash_total || 0}, UPI: ₹${row.online_total || 0})`);
    });

    console.log(`\n💰 GRAND TOTAL: ₹${grandTotal}\n`);
    console.log(`✅ Successfully created: ${createdCount} collections`);
    if (errorCount > 0) {
      console.log(`⚠️  Errors: ${errorCount}`);
    }

    connection.release();
    await pool.end();

    console.log('\n✅ Test collections creation completed!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Refresh your Finance page in the browser');
    console.log('   2. Click "Manage" on any event to see fund collections');
    console.log('   3. View the fund raising dashboard and reports');
    console.log('   4. Manage expenses and track fund totals');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestCollections();
