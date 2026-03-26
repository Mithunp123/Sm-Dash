# Event Finance System - Complete Setup & Deployment Guide

## 🔧 SETUP INSTRUCTIONS

### Step 1: Database Migration
The system uses MySQL with automatic migrations. When the server starts:
1. All tables are created automatically
2. Missing columns are added via safe migrations
3. Foreign key constraints are established

### Step 2: Environment Configuration
Ensure `.env` includes:
```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=sm_volunteers
JWT_SECRET=your_secret
```

### Step 3: Start Server
```bash
cd backend
npm install
npm run start
```

Monitor console for:
- ✅ Connected to MySQL database
- ✅ Database tables initialized successfully

---

## 📊 WORKFLOW: End-to-End Example

### 1. Create Event with Finance Enabled

**Admin Action:**
```json
POST /api/events
{
  "title": "Annual Fund Rising Event",
  "description": "College annual event",
  "date": "2024-04-15",
  "year": "2024",
  "finance_enabled": true
}

Response: Event ID = 1 ✅
```

### 2. Create Folder for Expenses
```json
POST /api/expenses/folder/add
{
  "event_id": 1,
  "folder_name": "Venue Expenses",
  "description": "All venue-related costs"
}

Response: Folder ID = 1 ✅
```

### 3. Add Expenses
```json
POST /api/expenses/add
{
  "event_id": 1,
  "folder_id": 1,
  "expense_title": "Catering",
  "fuel_amount": 0,
  "breakfast_amount": 100,
  "lunch_amount": 300,
  "dinner_amount": 200,
  "refreshment_amount": 50,
  "accommodation_amount": 0,
  "other_expense": 0
}

CALCULATED:
- food_total = 100 + 300 + 200 + 50 = 650 ✅
- travel_total = 0 ✅
- grand_total = 650 ✅
```

### 4. Add Fund Collections
```json
POST /api/fundraising/add
{
  "event_id": 1,
  "payer_name": "Rajesh Kumar",
  "department": "CSE",
  "amount": 5000,
  "payment_mode": "cash"
}

AUTO-FILLED:
- received_by = 5 (logged-in user)
- received_by_name = "Admin User" ✅
```

### 5. Get Summary
```json
GET /api/fundraising/summary/event/1

Response:
{
  "total_raised": 5000,
  "entries_count": 1,
  "cash_received": 5000,
  "upi_received": 0
}

Balance = Fund - Expenses = 5000 - 650 = 4350 ✅
```

---

## 🐛 CRITICAL BUG FIXES IMPLEMENTED

### ✅ Fixed: event_id undefined in expenses
**Problem**: Expenses were being created without event_id
**Solution**: 
- API validation enforces event_id as required field
- Database schema mandates event_id (NOT NULL)
- Models validate before insertion

### ✅ Fixed: folder_id not accessible
**Problem**: Bill folders had no event_id, causing lookup failures
**Solution**:
- Added event_id to bill_folders table
- Foreign key reference to events table
- CASCADE delete when event deleted

### ✅ Fixed: Calculations not automatic
**Problem**: food_total, travel_total, grand_total were NULL
**Solution**:
- Backend calculates during INSERT
- Updates expenses table with computed values
- Frontend reads pre-calculated values

### ✅ Fixed: received_by missing
**Problem**: Fund entries had no user tracking
**Solution**:
- received_by auto-populated from JWT token
- Set to logged-in user automatically
- Not editable by frontend (security)

### ✅ Fixed: Type mismatch errors
**Problem**: String/number conversion causing SQL errors
**Solution**:
- All numeric fields parsed with parseFloat()
- Validation before database operations
- Error messages included in responses

### ✅ Fixed: Missing finance_enabled toggle
**Problem**: No way to disable finance per event
**Solution**:
- Added finance_enabled column to events
- Defaults to false (disabled)
- Can be toggled during create/update

---

## 🔒 SECURITY IMPLEMENTATION

### 1. Authentication
- JWT token required for all protected endpoints
- Token includes user ID and role
- Verified on every request

### 2. Authorization
- `allowFinance` middleware checks conditions:
  - Event exists
  - finance_enabled = 1
  - User has appropriate role

### 3. Input Validation
- All required fields validated
- Number fields range-checked
- SQL injection prevented via parameterized queries

### 4. Automatic User Population
- `received_by` set from JWT token
- Cannot be overridden by client
- Ensures accurate tracking

### 5. Activity Logging
```javascript
await logActivity(
  userId,
  'ACTION_TYPE',
  requestData,
  request,
  {
    action_type: 'CREATE/UPDATE/DELETE',
    module_name: 'finance|fundraising|expenses',
    action_description: 'Human readable',
    reference_id: resourceId
  }
);
```

---

## 📋 MODELS CONVERTED TO ES MODULES

### BillFolder.js
```javascript
import { getDatabase } from '../database/init.js';

export const BillFolder = {
  createFolder(),
  getFoldersByEvent(),
  getFolderById(),
  updateFolder(),
  deleteFolder(),
  getFolderSummary()
};
```

### Expense.js
```javascript
export const Expense = {
  addExpense(),              // AUTO-CALCULATES totals
  getExpensesByFolder(),
  getExpensesByEvent(),
  getExpenseById(),
  updateExpense(),           // AUTO-RECALCULATES totals
  deleteExpense(),
  getFolderSummary()
}
```

### FundCollection.js
```javascript
export const FundCollection = {
  addCollection(),           // received_by AUTO-SET
  getCollectionsByEvent(),
  getCollectionSummary(),
  getTotalCollections(),
  getCollectionById(),
  updateCollection(),
  deleteCollection(),
  getCollectionsByReceivedBy()
};
```

---

## 🚀 ROUTES STRUCTURE

### `/api/expenses` - Expense Management
```
POST   /add              → Create expense
GET    /folder/:id       → Get expenses in folder
GET    /event/:id        → Get all expenses for event
GET    /:id              → Get expense details
PUT    /:id              → Update expense
DELETE /:id              → Delete expense
```

### `/api/fundraising` - Fund Collection
```
POST   /add              → Add fund entry
GET    /event/:id        → Get all collections
GET    /#collectionId    → Get specific entry
PUT    /:id              → Update collection
DELETE /:id              → Delete collection
GET    /summary/:id      → Get summary
GET    /filter/:id       → Filter collections
```

### `/api/events` - Event Management (Updated)
```
POST   /                 → Create event (with finance_enabled)
PUT    /:id              → Update event (toggle finance_enabled)
GET    /:id              → Get event details (includes finance_enabled)
DELETE /:id              → Delete event (cascades to folders/expenses)
```

---

## 📊 FINANCIAL CALCULATIONS

### On Expense Creation/Update:
```javascript
food_total = 
  breakfast_amount + 
  lunch_amount + 
  dinner_amount + 
  refreshment_amount

travel_total = fuel_amount

accommodation_total = accommodation_amount

grand_total = 
  food_total + 
  travel_total + 
  accommodation_total + 
  other_expense
```

### Fund Balance:
```javascript
balance = total_fund_raised - total_expenses
```

### Collection Summary:
```javascript
by_payment_mode = {
  cash: SUM(amount WHERE payment_mode='cash'),
  upi: SUM(amount WHERE payment_mode='upi')
}
```

---

## 🧪 TESTING CHECKLIST

### Authentication Tests
- [ ] JWT token required for protected endpoints
- [ ] Invalid token rejected
- [ ] Expired token rejected
- [ ] User role checked properly

### Authorization Tests
- [ ] Admin can access all finance endpoints
- [ ] Office Bearer can access assigned event finance
- [ ] Student cannot create expenses/folders
- [ ] Non-finance-enabled events blocked

### Data Creation Tests
- [ ] Event created with finance_enabled flag
- [ ] Folder created with event_id reference
- [ ] Expense created with auto-calculated totals
- [ ] Fund entry created with auto-filled received_by

### Calculation Tests
- [ ] food_total = sum of food items ✓
- [ ] travel_total = fuel only ✓
- [ ] grand_total = all subtotals + other ✓
- [ ] Balance = funds - expenses ✓

### Validation Tests
- [ ] Missing required field rejected
- [ ] Negative amounts rejected
- [ ] Invalid payment_mode rejected
- [ ] Non-existent folder referenced rejected

### Error Handling Tests
- [ ] Proper error messages returned
- [ ] 400 for validation errors
- [ ] 404 for not found
- [ ] 500 for server errors

---

## 🎯 PERFORMANCE OPTIMIZATION

### Query Optimizations
1. **Indexes recommended:**
   ```sql
   CREATE INDEX idx_events_finance ON events(finance_enabled);
   CREATE INDEX idx_expenses_folder ON expenses(folder_id);
   CREATE INDEX idx_collections_event ON fund_collections(event_id);
   ```

2. **N+1 Query prevention:**
   - Join with users for names
   - Calculate summaries in single query
   - Use GROUP BY for aggregates

3. **Pagination ready:**
   - Endpoints support LIMIT/OFFSET
   - Frontend can implement pagination

---

## 📱 FRONTEND PREREQUISITE S

### Environment
- React/Vue.js with TypeScript
- Axios or Fetch API
- State management (Redux/Pinia)

### Components Needed
1. **EventFinanceToggle** - Enable/disable finance on event create
2. **FundRaisingForm** - Add fund entries
3. **FundRaisingTable** - Display collections with received_by names
4. **ExpenseForm** - Create/edit expenses with calculated totals
5. **FinanceSummary** - Show balance calculation
6. **FolderManager** - Create/manage expense folders

### API Integration Example
```typescript
async function addFundEntry(eventId, data) {
  const response = await fetch(`/api/fundraising/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      event_id: eventId,
      payer_name: data.name,
      department: data.dept,
      amount: data.amount,
      payment_mode: data.mode
    })
  });
  
  return await response.json();
}
```

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Errors

**"Event not found"**
- Verify event ID exists
- Check finance_enabled = 1

**"Missing required fields"**
- Check request body format
- Verify all mandatory fields included
- See API documentation

**"Unauthorized"**
- Verify JWT token in header
- Check token not expired
- Verify user role permissions

**"Calculation errors"**
- Verify all amounts are valid numbers
- Check no negative values
- Verify formula in backend (food_total, etc.)

### Debug Mode
Enable detailed logging:
```env
DEBUG=*
LOG_LEVEL=debug
```

---

## ✅ Deployment Commands

```bash
# Install dependencies
npm install

# Run migrations
npm run migrate

# Start server
npm run start

# Production
npm run build
npm run start:prod
```

---

## 🎓 Training Material

### For Admin:
1. Event creation with finance toggle
2. Adding expense folders
3. Reviewing financial summaries
4. Accessing user activity logs

### For Office Bearers:
1. Recording fund collections with payer details
2. Adding expenses by category
3. Viewing their collection history
4. Generating reports

### For Students:
1. Viewing event finance status
2. Contributing to fund raising
3. Checking payment record

---

