# Bills & Expenses Management - Frontend Integration Guide

## 📋 Overview

The new Bills & Expenses Management system provides a folder-based interface for managing event expenses. Users can:
1. Select an event with finance enabled
2. Create expense folders
3. Add and manage expenses within folders
4. View auto-calculated expense totals

---

## 🎯 New Pages Created

### 1. **BillsEventSelector** (`/admin/bills` or `/office-bearer/bills`)
- **Path**: `/admin/bills` (Admin) or `/office-bearer/bills` (Office Bearer)
- **Purpose**: Select which event to manage bills for
- **Features**:
  - Shows only finance-enabled events
  - Clean table view with EVENT, DATE, YEAR columns
  - "Manage" button navigates to Bills Folder Management
  - "Finance Settings" button for configuring global settings
  - Empty state guidance if no finance-enabled events exist

### 2. **BillsFolderManagement** (`/bills/event/:eventId`)
- **Path**: `/bills/event/{eventId}`
- **Purpose**: Manage expense folders and bills for a specific event
- **Features**:
  - Create expense folders with name and description
  - View all folders in a table format
  - Delete folders (with cascade to expenses)
  - View expenses within each folder
  - Add new expenses to folders with auto-calculation
  - Delete individual expenses
  - Display calculated totals (food_total, travel_total, grand_total)

---

## 📁 Folder & Expense Structure

### Expense Folders
```
Bill Folder
├── folder_name (e.g., "Venue Expenses")
├── description (optional)
└── expenses (multiple)
    ├── Expense 1
    ├── Expense 2
    └── Expense N
```

### Expense Fields
- `expense_title` - Title of the expense
- `category` - Food | Transport | Accommodation | Supplies | Other
- `breakfast_amount` - Cost of breakfast (↓ included in food_total)
- `lunch_amount` - Cost of lunch (↓ included in food_total)
- `dinner_amount` - Cost of dinner (↓ included in food_total)
- `refreshment_amount` - Cost of refreshments (↓ included in food_total)
- `fuel_amount` - Fuel cost (↓ included in travel_total)
- `accommodation_amount` - Accommodation cost (included in grand_total)
- `other_expense` - Miscellaneous expenses

### Auto-Calculated Fields
```javascript
// Backend automatically calculates these:
food_total = breakfast_amount + lunch_amount + dinner_amount + refreshment_amount
travel_total = fuel_amount
grand_total = food_total + travel_total + accommodation_amount + other_expense
```

---

## 🔌 API Endpoints Used

### Folder Operations

#### Create Folder
```http
POST /api/bills/folders/add
Content-Type: application/json

{
  "event_id": 1,
  "folder_name": "Venue Expenses",
  "description": "All costs related to venue"
}
```

#### Get Folders for Event
```http
GET /api/bills/folders/{eventId}
```

#### Delete Folder
```http
DELETE /api/bills/folders/{folderId}
```

### Expense Operations

#### Add Expense
```http
POST /api/expenses/add
Content-Type: application/json

{
  "event_id": 1,
  "folder_id": 1,
  "expense_title": "Team Lunch",
  "category": "food",
  "breakfast_amount": 0,
  "lunch_amount": 500,
  "dinner_amount": 0,
  "refreshment_amount": 100,
  "fuel_amount": 0,
  "accommodation_amount": 0,
  "other_expense": 0
}

// Auto-calculated response:
{
  "success": true,
  "expense": {
    "id": 1,
    "expense_title": "Team Lunch",
    "food_total": 600,         // 500 + 100
    "travel_total": 0,
    "grand_total": 600,
    ...
  }
}
```

#### Get Expenses for Folder
```http
GET /api/expenses/folder/{folderId}

Response:
{
  "success": true,
  "expenses": [
    {
      "id": 1,
      "expense_title": "Team Lunch",
      "category": "food",
      "food_total": 600,
      "travel_total": 0,
      "grand_total": 600,
      ...
    }
  ],
  "folderSummary": {
    "totalExpenses": 600,
    "folderName": "Venue Expenses"
  }
}
```

#### Delete Expense
```http
DELETE /api/expenses/{expenseId}
```

---

## 🚀 User Workflows

### Admin/Office Bearer: Managing Bills

**1. Navigate to Bills Management**
```
Dashboard → Bills Management
or
Direct: /admin/bills (Admin)
or
Direct: /office-bearer/bills (Office Bearer)
```

**2. Select Event**
- See list of finance-enabled events
- Click "Manage" button
- Navigates to BillsFolderManagement

**3. Create Folder**
- Click "New Folder" button
- Enter folder name (e.g., "Venue Expenses")
- Optional: Add description
- Submit

**4. Add Expense to Folder**
- Click "View" on a folder
- Dialog opens showing folder expenses
- Click "Add Expense" button
- Fill expense details:
  - Title (required)
  - Category
  - Amount breakdown (breakfast, lunch, dinner, refreshment, fuel, accommodation, other)
- Submit
- System auto-calculates food_total, travel_total, grand_total
- Expense appears in folder view

**5. View Summary**
- Totals display immediately after adding expense
- Shows food_total (green), travel_total (blue), grand_total (purple)

**6. Delete Expense or Folder**
- Click delete button on expense → Confirms and removes
- Click delete button on folder → Confirms and removes all expenses in folder

---

## 🎨 UI Components Used

### BillsEventSelector
```
┌─ Header: "Event List" ────────────┐
│ "Choose the event for finance tracking"
│                    [Finance Settings]
├─────────────────────────────────────┤
│ EVENT │ DATE │ YEAR │ ACTION      │
├─────────────────────────────────────┤
│ Event1│12/5/24│ 2024│ Manage[→]  │
│ Event2│15/3/24│ 2024│ Manage[→]  │
└─────────────────────────────────────┘
```

### BillsFolderManagement
```
┌─ Header: "Bills & Expenses" ──────────┐
│ "Manage expense folders and bills"
│                         [New Folder +]
├───────────────────────────────────────┤
│ FOLDER NAME │ DESCRIPTION │ ACTIONS  │
├───────────────────────────────────────┤
│ Venue Expenses│ Venue costs│View/Delete│
│ Catering Costs│ Food & drink│View/Delete│
└───────────────────────────────────────┘

Folder Details Dialog:
┌─ "Venue Expenses - Expenses" ────────┐
│                       [Add Expense +]
├───────────────────────────────────────┤
│ Expense 1 (Card)
│ Title: Team Lunch
│ Food Total: ₹600 | Travel: ₹0 | Grand: ₹600
│                              [Delete Expense]
│
│ Expense 2 (Card)
│ Title: Fuel for Transport
│ Food Total: ₹0 | Travel: ₹800 | Grand: ₹800
│                              [Delete Expense]
└───────────────────────────────────────┘
```

---

## 🔐 Authentication & Authorization

### Required Roles
- **Admin**: `/admin/bills` access
- **Office Bearer**: `/office-bearer/bills` access
- Both roles required for: `/bills/event/:eventId`

### Permission Checks
- User must be authenticated
- Event must have `finance_enabled = 1`
- Folder and expense operations use JWT token for authentication

---

## ⚠️ Error Handling

### User Scenarios

**No Finance-Enabled Events**
```
Display: "No finance-enabled events found"
Action: Link to Finance Settings
```

**Failed to Create Folder**
```
Toast Error: "Failed to create folder"
Action: Check network connection, retry
```

**Failed to Add Expense**
```
Toast Error: "Failed to add expense"
Action: Verify all amounts are valid numbers
```

**Missing Required Fields**
```
Toast Error: "Please enter expense title"
Action: Fill all required fields
```

---

## 📊 Example Workflow: Complete Event

### Event: "Annual Fund Raising Event" (ID: 1)

**Step 1: Select Event**
- Go to `/admin/bills`
- See "Annual Fund Raising Event" in table
- Click "Manage"
- Navigate to `/bills/event/1`

**Step 2: Create Folders**
```
Folder 1: "Venue Expenses"
Folder 2: "Catering Costs"
Folder 3: "Travel & Transport"
```

**Step 3: Add Expenses to "Venue Expenses"**
```
Expense 1: "Lunch for Event Team"
- Lunch: ₹500
- Refreshment: ₹100
- Auto-calculated: food_total = ₹600

Expense 2: "Event Setup"
- Other: ₹2000
- Auto-calculated: grand_total = ₹2000

Expense 3: "Fuel for Transport"
- Fuel: ₹800
- Auto-calculated: travel_total = ₹800
```

**Step 4: View Total**
- Folder summary shows all expenses
- Can view in EventFundsManagement dashboard

**Step 5: Report Generation**
- Admin can view `/admin/events/1/funds`
- See all expenses, fund collections, and balance

---

## 🔗 Integration with Other Modules

### Finance Dashboard Integration
After managing bills, admins can:
- View `/admin/events/:eventId/funds` → See all expenses with fund collection summary
- View `/admin/finance` → See overall finance status

### Event Management
- Bills are tied to events with `finance_enabled = 1`
- Deleting event cascades to folders/expenses

### Activity Logging
- All CRUD operations logged for audit trail
- Track who created/modified/deleted expenses

---

## 📱 Mobile Responsiveness

All pages are fully responsive:
- ✅ Table columns stack on mobile
- ✅ Dialogs adapt to smaller screens
- ✅ Buttons remain accessible
- ✅ Form inputs properly sized

---

## 🧪 Testing Checklist

- [ ] Navigate to `/admin/bills` (shows event list)
- [ ] Click "Manage" button (navigates to `/bills/event/:id`)
- [ ] Click "New Folder" (create folder dialog appears)
- [ ] Create folder with name "Test Folder"
- [ ] Click "View" on folder (expenses dialog opens)
- [ ] Click "Add Expense" (expense form appears)
- [ ] Fill expense with:
  - Title: "Test Expense"
  - Lunch: 500
  - Refreshment: 50
- [ ] Submit (expense added, auto-calculated totals shown)
- [ ] Verify food_total = 550
- [ ] Click delete on expense (expense removed)
- [ ] Click delete on folder (folder and expenses removed)
- [ ] Test empty state (no folders)
- [ ] Test with multiple folders
- [ ] Verify auth redirects on /login

---

## 🎓 Training Guide

### For Admins
1. Create events with `finance_enabled = true`
2. Guide office bearers to `/office-bearer/bills`
3. Help set up folder structure for events
4. Review expenses before approval

### For Office Bearers
1. Navigate to `/office-bearer/bills`
2. Select your event
3. Create folders for expense categories
4. Add expenses as they occur
5. System auto-calculates, no manual math needed

### For Users
- Can view fund collections and expenses in `/admin/events/:eventId/funds`
- See balance calculation (funds - expenses)
- No permission to create/edit

---

## 🐛 Troubleshooting

### Page Not Loading
- Check if user is authenticated (Login required)
- Verify JWT token is valid
- Check browser console for errors

### Folders Not Showing
- Verify event has `finance_enabled = 1`
- Check API endpoint `/api/bills/folders/{eventId}`
- Confirm user has required role (admin/office_bearer)

### Expense Not Saving
- Ensure all amount fields are numbers
- Verify folder exists
- Check network tab in DevTools for API errors

### Calculations Wrong
- Refresh page to see latest data
- Verify amounts entered correctly
- Check if API returned calculated values

---

## 📞 Support

For issues:
1. Check browser console for error messages
2. Verify API endpoints are running (check `/api/bills/folders/1`)
3. Confirm database migrations ran
4. Review JWT token in localStorage
5. Check server logs for detailed errors

---

## 🚀 Deployment

### Prerequisites
- All backend routes integrated (bills-fixed.js, expenses-fixed.js)
- Database migrations run
- JWT authentication working

### Frontend Setup
```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
npm run dev

# Navigate to:
# http://localhost:5173/admin/bills
# (after authenticating)
```

### Environment Check
- Verify API base URL in `.env`
- Confirm `/api/bills/folders` endpoint accessible
- Test JWT token in Authorization header

---

## 📈 Future Enhancements

- [ ] Bulk expense upload (CSV)
- [ ] Expense approval workflow
- [ ] Budget limits per folder
- [ ] Recurring expenses
- [ ] Receipt attachment upload
- [ ] PDF report generation
- [ ] Expense analytics/charts

---

**Status**: ✅ Production Ready

**Last Updated**: March 24, 2024
**Version**: 1.0.0

