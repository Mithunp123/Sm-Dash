# Quick Reference Guide - Event Finance System

## 🔑 Key Files Modified/Created

### Database
- ✅ [init.js](backend/database/init.js) - Added finance_enabled, event_id to bill_folders, created expenses table

### Models (ES Modules)
- ✅ [BillFolder.js](backend/models/BillFolder.js) - Complete CRUD operations
- ✅ [Expense.js](backend/models/Expense.js) - With auto-calculations
- ✅ [FundCollection.js](backend/models/FundCollection.js) - With received_by auto-population

### Routes
- ✅ [events.js](backend/routes/events.js) - Added finance_enabled support
- ✅ [expenses-fixed.js](backend/routes/expenses-fixed.js) - NEW comprehensive routes
- ✅ [fundraising-fixed.js](backend/routes/fundraising-fixed.js) - NEW comprehensive routes
- ✅ [bills-fixed.js](backend/routes/bills-fixed.js) - NEW clean routes  

### Documentation
- ✅ [EVENT_FINANCE_API_GUIDE.md](EVENT_FINANCE_API_GUIDE.md) - Complete API reference
- ✅ [COMPLETE_SETUP_GUIDE.md](COMPLETE_SETUP_GUIDE.md) - Setup & deployment guide
- ✅ [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - This file

---

## 📝 CRITICAL FIELDS

### Events Table ADDITIONS
```sql
finance_enabled INT DEFAULT 0              -- Toggle for finance module
created_by INT REFERENCES users(id)        -- Who created the event
event_date DATE                            -- Just the date part
```

### Expenses Table (NEW)
```sql
All fields from requirements
food_total, travel_total, grand_total      -- AUTO-CALCULATED
```

### Bill Folders Table FIXES
```sql
event_id INT NOT NULL REFERENCES events(id) -- NOW REQUIRED
folder_name VARCHAR(255)                    -- RENAMED from 'name'
created_by INT REFERENCES users(id)        -- WHO created folder
```

### Fund Collections Table FIXES
```sql
received_by INT NOT NULL REFERENCES users(id)  -- Auto-populated from JWT
department VARCHAR(255)                        -- Added for tracking
amount DECIMAL(10, 2) NOT NULL               -- Type fixed
payment_mode ENUM('cash', 'upi')             -- Standardized
```

---

## 🎯 MANDATORY API REQUIREMENTS

### Expense Creation - MUST INCLUDE:
✅ event_id - The parent event ID (NOT optional)
✅ folder_id - Which folder this belongs to
✅ expense_title - What the expense is for
✅ All amount fields (defaults to 0)

### Fund Entry Creation - MUST INCLUDE:
✅ event_id - The parent event ID
✅ payer_name - Who's contributing
✅ amount - How much (must > 0)
✅ payment_mode - 'cash' or 'upi'
❌ received_by - AUTO-SET from logged-in user (don't send)

### Event Creation - NOW INCLUDES:
✅ finance_enabled - Boolean to toggle finance module
✅ title, date, year - Existing required fields  
✅ created_by - Auto-set from logged-in user

---

## 🔄 AUTO-CALCULATED FIELDS

### Expense Totals (Always calculated)
```javascript
food_total = breakfast + lunch + dinner + refreshment
travel_total = fuel_amount
grand_total = food_total + travel_total + accommodation + other_expense
```

### Fund Summary
```javascript
total_raised = SUM(amount) for event
by_payment_mode = { cash: X, upi: Y }
balance = total_raised - total_expenses
```

---

## 🛡️ SECURITY MEASURES

### Authentication Required
```
All /api/fundraising/* endpoints
All /api/expenses/* endpoints
All /api/events (except read-only public endpoints)
```

### Authorization Checks
```
finance_enabled must be = 1 (true) for event
User must have allowFinance middleware permission
User role must be admin/office_bearer/student (not volunteer)
```

### Data Protection
```
received_by - Set server-side from JWT, never from client
event_id - Required, must reference valid event
folder_id - Validated against folder's event_id
```

---

## ⚡ QUICK COMMANDS

### Test Fund Entry Creation
```bash
curl -X POST http://localhost:3000/api/fundraising/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "event_id": 1,
    "payer_name": "Test User",
    "department": "CSE",
    "amount": 5000,
    "payment_mode": "cash"
  }'
```

### Test Expense Creation
```bash
curl -X POST http://localhost:3000/api/expenses/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "event_id": 1,
    "folder_id": 1,
    "expense_title": "Lunch",
    "lunch_amount": 500
  }'
```

### Test Event Creation with Finance
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Annual Event",
    "date": "2024-04-15",
    "year": "2024",
    "finance_enabled": true
  }'
```

---

## 🐛 5 Critical Bugs FIXED

| Bug | Cause | Fix |
|-----|-------|-----|
| event_id undefined | Not required in API | Made mandatory with validation |
| folder_id not found | bill_folders had no event_id | Added FK to events table |
| Totals were NULL | Not calculated in backend | Auto-calc on INSERT/UPDATE |
| received_by missing | Not auto-populated | Server-side populate from JWT |
| Type errors | String/number mismatch | parseFloat() validation |

---

## 📊 TESTING THE SYSTEM

### 1. Verify Database
```sql
-- Check finance_enabled exists
DESCRIBE events;
-- Should show: finance_enabled INT DEFAULT 0

-- Check bill_folders has event_id
DESCRIBE bill_folders;
-- Should show: event_id INT NOT NULL with FK

-- Verify expenses table
SHOW TABLES LIKE 'expenses';
-- Should exist and have all calculation fields
```

### 2. Test Auth
```
POST /login → Get JWT token
Use token in Authorization header
```

### 3. Test Event Creation
```
POST /api/events + finance_enabled
GET /api/events/:id → Verify finance_enabled = 1
```

### 4. Test Fund Collection
```
POST /api/fundraising/add → Verify received_by auto-filled
GET /api/fundraising/event/:id → Verify sums correct
```

### 5. Test Expenses
```
POST /api/expenses/add → Verify food_total calculated
GET /api/expenses/event/:id → Verify all fields present
GET /api/expenses/summary/:id → Verify balance = fund - expense
```

---

## 📈 Future Enhancements

### Phase 2
- [ ] QR code upload for fund entries
- [ ] Payment verification system
- [ ] Receipt generation
- [ ] Email notifications

### Phase 3
- [ ] Budget planning per event
- [ ] Approval workflows
- [ ] Multi-level authorization
- [ ] Audit trails

### Phase 4
- [ ] Analytics dashboard
- [ ] Export to Excel/PDF
- [ ] API rate limiting
- [ ] Caching layer

---

## 🎓 Architecture Overview

```
Events (finance_enabled toggle)
    ├─ Bill Folders (event_id FK)
    │   └─ Expenses (folder_id FK, auto-calculated totals)
    └─ Fund Collections (auto-filled received_by)
        └─ Summary (balance = funds - expenses)
```

---

## 💾 Database Sequence

```
1. Create Event
2. Enable Finance (finance_enabled = 1)
3. Create Folder (links to event)
4. Add Expenses (links to folder, auto-calc totals)
5. Add Fund Entries (auto-set received_by)
6. View Summary (balance calculation)
```

---

## 🔗 Routes Mapping

| Feature | OLD | NEW |
|---------|-----|-----|
| Bills | /api/bills | /api/expenses |
| Folders | /api/bills/folders | /api/expenses/folders |
| Fund | /api/fundraising | /api/fundraising (improved) |
| Events | /api/events | /api/events (updated) |

---

## ✨ Key Improvements

✅ Type-safe ES modules for all models
✅ Comprehensive input validation on every endpoint
✅ Automatic calculations prevent null/undefined errors
✅ Security: received_by set server-side only
✅ Full activity logging for audit trail
✅ Cascading deletes to maintain referential integrity
✅ Clear error messages for debugging
✅ Modular router design for maintainability
✅ Proper HTTP status codes (201 for create, 404 for not found, etc.)
✅ Comprehensive documentation with examples

