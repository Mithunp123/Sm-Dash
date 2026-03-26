# How to Create Events - Complete Guide

Two ways to create events in SM Dash:

---

## Method 1: Create Events Through the Web UI (Admin)

### Step-by-Step Guide:

1. **Navigate to Events Management**
   - Click on **Events** in the sidebar
   - Or go to: `/admin/events`

2. **Click "Add New Event" Button**
   - Blue button on the top right
   - Opens a dialog form

3. **Fill in Event Details**
   - **Title** *(Required)* - Event name
     - Example: "Tech Summit 2024"
   - **Date** *(Required)* - Event date (YYYY-MM-DD)
     - Example: 2024-12-15
   - **Year** *(Required)* - Academic year
     - Example: 2024
   - **Description** - Event details (optional)
     - Describe the event purpose and details
   - **Special Day** - Toggle if it's an important day
     - Check if event is a special occasion
   - **Max Volunteers** - Maximum volunteers allowed (optional)
     - Example: 100
   - **Image** - Upload event poster (optional)
     - Supported: PNG, JPEG, GIF, WebP
     - Max size: 5MB

4. **Click "Create Event"**
   - System validates and saves
   - You'll see success toast notification
   - Event appears in Events list

5. **Event is Now Ready**
   - Visible in Finance module
   - Can add fund collections
   - Can manage volunteers and attendance

---

## Method 2: Create Events Using Script (Bulk)

### For Creating Multiple Events Quickly:

1. **Quick Script Method**
   ```bash
   cd backend
   node scripts/create-test-events.js
   ```

   This creates 8 sample events like:
   - Annual Mega Hackathon 2024
   - Tech Awareness Program
   - Charity Walk for Education
   - Annual Sports Day
   - Cultural Fest - Colors 2024
   - Blood Donation Camp
   - Industrial Visit - TCS Office
   - Environment Day Tree Plantation

### Create Custom Events Script

Create a file `backend/scripts/create-custom-events.js`:

```javascript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const customEvents = [
  {
    title: 'Your Event Title',
    description: 'Your event description',
    date: '2024-12-20',
    year: '2024',
    is_special_day: 1,
    max_volunteers: 150
  },
  // Add more events...
];

async function createCustomEvents() {
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
    console.log('🚀 Creating custom events...\n');

    for (const event of customEvents) {
      try {
        const query = `
          INSERT INTO events 
          (title, description, date, year, is_special_day, max_volunteers, created_at, updated_at)
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

        console.log(`✅ Created: "${event.title}"`);
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }
    }

    connection.release();
    await pool.end();
    
    console.log('\n✅ Complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createCustomEvents();
```

**Run it:**
```bash
node scripts/create-custom-events.js
```

---

## Method 3: Create Events Using API

### Direct API Call:

**Endpoint:** `POST /api/events`

**Headers:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Workshop on AI",
  "description": "Learn about Artificial Intelligence",
  "date": "2024-12-25",
  "year": "2024",
  "is_special_day": true,
  "max_volunteers": 200
}
```

**Response:**
```json
{
  "success": true,
  "id": 9,
  "message": "Event created successfully"
}
```

### With Image Upload:

Use `FormData` for multipart upload:

```javascript
const formData = new FormData();
formData.append('title', 'Tech Conference');
formData.append('description', 'Annual tech conference');
formData.append('date', '2024-12-30');
formData.append('year', '2024');
formData.append('is_special_day', 'true');
formData.append('max_volunteers', '500');
formData.append('image', imageFile); // File object

fetch('http://localhost:3000/api/events', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## Event Fields Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | Text | ✅ Yes | Event name (max 255 chars) |
| date | Date | ✅ Yes | Format: YYYY-MM-DD |
| year | Text | ✅ Yes | Academic year (e.g., "2024") |
| description | Text | ❌ No | Event details and purpose |
| is_special_day | Boolean | ❌ No | Mark as special occasion |
| max_volunteers | Number | ❌ No | Max volunteers allowed |
| image | File | ❌ No | PNG, JPEG, GIF, WebP (5MB max) |
| volunteer_registration_deadline | DateTime | ❌ No | Deadline for registrations |

---

## Common Event Creation Scenarios

### Scenario 1: Monthly Tech Talk
```
Title: "Monthly Tech Talk - January"
Date: 2024-01-15
Year: 2024
Description: Discussing latest tech trends
Is Special Day: No
Max Volunteers: 50
```

### Scenario 2: Annual Marathon
```
Title: "Annual Marathon 2024"
Date: 2024-03-17
Year: 2024
Description: Fundraising marathon for charity
Is Special Day: Yes (important event)
Max Volunteers: 300
```

### Scenario 3: Department Fest
```
Title: "CSE Department Fest"
Date: 2024-04-22
Year: 2024
Description: Annual computer science department festival
Is Special Day: Yes
Max Volunteers: 250
```

---

## After Creating an Event

✅ **Event is now available for:**
1. **Fund Collection** - Add cash/online payments
2. **Expense Management** - Track event costs
3. **Volunteer Tracking** - Record participants
4. **Attendance** - Mark attendance
5. **Reporting** - Generate event reports

✅ **Next Steps:**
1. Enable fundraising in Finance Settings
2. Upload QR code for online payments
3. Add fund collections
4. Manage event expenses
5. View financial reports

---

## Quick Reference

### Via UI:
- Events → Add New Event → Fill form → Create

### Via Script:
- Edit `create-test-events.js` with your data
- Run: `node scripts/create-test-events.js`

### Via API:
- POST `/api/events` with auth token
- Send FormData for image upload

---

## Troubleshooting

**Q: Event not appearing after creation?**
- Refresh the page
- Check if you're logged in as Admin
- Verify date format (YYYY-MM-DD)

**Q: Image upload failed?**
- Ensure file is PNG, JPEG, GIF, or WebP
- Check file size (max 5MB)
- Ensure `/public/uploads/events` directory exists

**Q: Can't create event through API?**
- Verify auth token is valid
- Check request body format
- Ensure title, date, year are provided
- Check backend server is running

---
