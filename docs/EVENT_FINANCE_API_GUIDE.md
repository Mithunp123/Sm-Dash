# Event Finance Management System - Complete API Guide

## 🎯 Overview
This is a comprehensive Event Finance Management System with Fund Raising and Bills modules. The system manages events with finance functionality, allowing users to track fund collections and expenses efficiently.

## 📋 Key Features

### 1. Event Management
- Create events with optional finance Enabling
- Track event details: title, description, date, year
- Attach event images
- Enable/disable finance module per event

### 2. Fund Raising Module
- Record fund collections with payer details
- Support multiple payment modes (Cash, UPI)
- Auto-populate logged-in user as receiver
- Generate fund collection summaries and reports

### 3. Bill Management Module  
- Organize expenses in folders per event
- Track detailed expenses with break down by category
- Auto-calculate totals (food, travel, grand total)
- Group expenses by folder for better management

### 4. Financial Summary
- View total fund raised vs. expenses
- Calculate remaining balance
- Generate payment mode breakdowns
- Time-based filtering and reports

---

## 🔐 Authentication & Authorization

### User Roles
1. **Admin** - Full access to all modules
2. **Office Bearer** - Can manage finance for assigned events
3. **Student** - Can view fund and add contributions (if finance_enabled)
4. **Volunteer** - Limited access

### Middleware
- `authenticateToken` - Validates JWT token
- `allowFinance` - Checks finance_enabled for event
- `requireAdmin` - Admin-only endpoints

---

## 📊 Database Schema

### 1. Events Table
```sql
CREATE TABLE events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  year TEXT NOT NULL,
  finance_enabled INT DEFAULT 0,  -- CRITICAL: Toggle for finance
  created_by INT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ...
)
```

### 2. Bill Folders Table
```sql
CREATE TABLE bill_folders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT NOT NULL REFERENCES events(id),
  folder_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 3. Expenses Table
```sql
CREATE TABLE expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT NOT NULL REFERENCES events(id),
  folder_id INT NOT NULL REFERENCES bill_folders(id),
  expense_title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  fuel_amount DECIMAL(10, 2),
  breakfast_amount DECIMAL(10, 2),
  lunch_amount DECIMAL(10, 2),
  dinner_amount DECIMAL(10, 2),
  refreshment_amount DECIMAL(10, 2),
  accommodation_amount DECIMAL(10, 2),
  other_expense DECIMAL(10, 2),
  food_total DECIMAL(10, 2),      -- AUTO-CALCULATED
  travel_total DECIMAL(10, 2),    -- AUTO-CALCULATED
  grand_total DECIMAL(10, 2),     -- AUTO-CALCULATED
  created_by INT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 4. Fund Collections Table
```sql
CREATE TABLE fund_collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT NOT NULL REFERENCES events(id),
  payer_name VARCHAR(255) NOT NULL,
  department VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  payment_mode ENUM('cash', 'upi') DEFAULT 'cash',
  received_by INT NOT NULL REFERENCES users(id),  -- AUTO-POPULATED
  status ENUM('active', 'closed') DEFAULT 'active',
  entry_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 🔌 API Endpoints

### EVENT ENDPOINTS

#### Create Event
```http
POST /api/events
Content-Type: multipart/form-data

{
  "title": "Annual Event 2024",
  "description": "Description here",
  "date": "2024-03-24",
  "year": "2024",
  "finance_enabled": true,        -- NEW: Enable finance module
  "image": <file>
}

Response (201):
{
  "success": true,
  "id": 1,
  "message": "Event created successfully"
}
```

#### Get Event
```http
GET /api/events/:id

Response (200):
{
  "success": true,
  "event": {
    "id": 1,
    "title": "Annual Event 2024",
    "finance_enabled": 1,
    ...
  }
}
```

#### Update Event
```http
PUT /api/events/:id
Content-Type: application/json

{
  "title": "Updated Title",
  "finance_enabled": true,
  ...
}
```

---

### FUND RAISING ENDPOINTS

#### Add Fund Entry
```http
POST /api/fundraising/add
Content-Type: application/json

Authorization: Bearer <token>

{
  "event_id": 1,
  "payer_name": "John Doe",
  "department": "ECE",
  "amount": 5000,
  "payment_mode": "cash"               -- Can be "cash" or "upi"
}

Response (201):
{
  "success": true,
  "message": "Fund entry added successfully",
  "collection": {
    "id": 1,
    "event_id": 1,
    "payer_name": "John Doe",
    "amount": 5000,
    "received_by": 5,                 -- AUTO-FILLED: Logged-in user ID
    "received_by_name": "Admin User",  -- Name of logged-in user
    "payment_mode": "cash",
    "created_at": "2024-03-24T10:30:00Z"
  }
}
```

#### Get All Fund Collections for Event
```http
GET /api/fundraising/event/:eventId

Response (200):
{
  "success": true,
  "collections": [
    {
      "id": 1,
      "payer_name": "John Doe",
      "amount": 5000,
      "payment_mode": "cash",
      "received_by": 5,
      "received_by_name": "Admin User",
      "entry_date": "2024-03-24",
      "created_at": "2024-03-24T10:30:00Z"
    },
    ...
  ],
  "total_raised": 25000,
  "count": 5
}
```

#### Get Fund Summary
```http
GET /api/fundraising/summary/event/:eventId

Response (200):
{
  "success": true,
  "summary": {
    "total_raised": 25000,
    "entries_count": 5,
    "cash_received": 15000,
    "upi_received": 10000,
    "by_payment_mode": {
      "cash": 15000,
      "upi": 10000
    }
  }
}
```

#### Update Fund Entry
```http
PUT /api/fundraising/:collectionId
Content-Type: application/json

{
  "payer_name": "John Smith",
  "amount": 6000,
  "payment_mode": "upi",
  "department": "ECE"
}
```

#### Delete Fund Entry
```http
DELETE /api/fundraising/:collectionId
```

---

### BILL MANAGEMENT ENDPOINTS

#### Create Folder
```http
POST /api/expenses/folder/add
Content-Type: application/json

{
  "event_id": 1,
  "folder_name": "Trip Expenses",
  "description": "Expenses for annual trip"
}

Response (201):
{
  "success": true,
  "message": "Folder created successfully",
  "id": 1
}
```

#### Get Folders for Event
```http
GET /api/expenses/folders/:eventId

Response (200):
{
  "success": true,
  "folders": [
    {
      "id": 1,
      "event_id": 1,
      "folder_name": "Trip Expenses",
      "created_by_name": "Admin User",
      "expense_count": 3,
      "folder_total": 15000
    },
    ...
  ],
  "count": 2
}
```

#### Add Expense (CRITICAL)
```http
POST /api/expenses/add
Content-Type: application/json

{
  "event_id": 1,        -- MANDATORY
  "folder_id": 1,       -- MANDATORY
  "expense_title": "Fuel",
  "category": "travel",
  "fuel_amount": 500,
  "breakfast_amount": 100,
  "lunch_amount": 200,
  "dinner_amount": 0,
  "refreshment_amount": 50,
  "accommodation_amount": 0,
  "other_expense": 0
}

Response (201):
{
  "success": true,
  "message": "Expense added successfully",
  "expense": {
    "id": 1,
    "event_id": 1,
    "folder_id": 1,
    "expense_title": "Fuel",
    "fuel_amount": 500,
    "breakfast_amount": 100,
    "lunch_amount": 200,
    "dinner_amount": 0,
    "refreshment_amount": 50,
    "accommodation_amount": 0,
    "other_expense": 0,
    "food_total": 350,         -- AUTO-CALCULATED
    "travel_total": 500,       -- AUTO-CALCULATED
    "grand_total": 850         -- AUTO-CALCULATED
  }
}
```

#### Get Expenses for Folder
```http
GET /api/expenses/folder/:folderId

Response (200):
{
  "success": true,
  "expenses": [...]
  "summary": {
    "expense_count": 3,
    "total_amount": 15000,
    "food_subtotal": 5000,
    "travel_subtotal": 8000,
    "accommodation_subtotal": 2000,
    "other_subtotal": 0
  }
}
```

#### Get All Expenses for Event
```http
GET /api/expenses/event/:eventId

Response (200):
{
  "success": true,
  "expenses": [...],
  "total": 20000,
  "count": 5
}
```

#### Update Expense
```http
PUT /api/expenses/:expenseId
Content-Type: application/json

{
  "expense_title": "Updated Fuel",
  "fuel_amount": 600,
  ...
}
```

#### Delete Expense
```http
DELETE /api/expenses/:expenseId
```

---

## 💻 Frontend Integration

### Fund Raising Component
```typescript
// Adding fund entry
const response = await fetch('/api/fundraising/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    event_id: eventId,
    payer_name: formData.payer_name,
    department: formData.department,
    amount: parseFloat(formData.amount),
    payment_mode: formData.payment_mode
  })
});

// Get all collections
const response = await fetch(`/api/fundraising/event/${eventId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Expense Component
```typescript
// Adding expense
const response = await fetch('/api/expenses/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    event_id: eventId,
    folder_id: folderId,
    expense_title: formData.title,
    fuel_amount: parseFloat(formData.fuel),
    breakfast_amount: parseFloat(formData.breakfast),
    lunch_amount: parseFloat(formData.lunch),
    dinner_amount: parseFloat(formData.dinner),
    refreshment_amount: parseFloat(formData.refreshment),
    accommodation_amount: parseFloat(formData.accommodation),
    other_expense: parseFloat(formData.other)
  })
});
```

---

## 🔍 Common Issues & Solutions

### Issue: Fund entry not saving
**Solution**: Verify:
- ✅ event_id is valid and exists
- ✅ event.finance_enabled === 1
- ✅ payer_name is not empty
- ✅ amount > 0
- ✅ payment_mode is 'cash' or 'upi'
- ✅ received_by is auto-populated from auth token

### Issue: Expense total not calculating
**Solution**: Check:
- ✅ folder_id is valid
- ✅ API response includes calculated totals
- ✅ All amount fields are valid numbers

### Issue: Can't access finance module
**Solution**:
- ✅ Verify user role (admin/office_bearer/student)
- ✅ Check event.finance_enabled isTrue
- ✅ Verify JWT token is valid

---

## 🚀 Deployment Checklist

- [ ] Database migrations run successfully
- [ ] All tables created with correct schema
- [ ] finance_enabled column added to events
- [ ] event_id added to bill_folders
- [ ] expenses table created
- [ ] fund_collections table created
- [ ] Models converted to ES modules
- [ ] Routes updated with validation
- [ ] Error handling implemented
- [ ] Activity logging working
- [ ] JWT authentication enforced
- [ ] Role-based access control working
- [ ] All calculation fields auto-populated

---

## 📞 Support

For issues or questions, check:
1. Database schema matches documentation
2. All required fields are provided
3. Authentication token is valid
4. User has required permissions
5. Event has finance_enabled = 1
