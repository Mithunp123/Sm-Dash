# 🎉 Event Fund Raising + Bill Management System

Complete Event Fundraising & Bills/Expenses Management System with QR-based payments, folder-based organization, role-based access control, and advanced financial tracking.

## 🎯 System Overview

```
Event Finance System
├── 💰 Fund Raising Module
│   ├── Cash Collections
│   ├── Online Payments (QR Code)
│   ├── Collection History
│   └── User-wise Breakdown
├── 📋 Bill Management Module
│   ├── Folder Organization
│   ├── Expense Tracking
│   ├── Auto Calculations
│   └── Category Breakdown
├── ⚙️ Settings Module (Admin)
│   ├── Fundraising Toggle
│   ├── QR Code Upload
│   └── Configuration
└── 📊 Summary & Analytics
    ├── Total Collections
    ├── Total Expenses
    ├── Balance Analysis
    └── Daily/User Summaries
```

## 👥 User Roles & Permissions

### 🔴 Admin
```
✅ Full Access
✅ Enable/Disable Fundraising
✅ Upload QR Codes
✅ View All Collections & Expenses
✅ Delete Any Entry
✅ View Financial Summary
```

### 🟢 Office Bearer (Student Leader)
```
✅ Access Fundraising (if enabled)
✅ Add Collections (Cash & Online)
✅ Add Expenses
✅ Create Bill Folders
✅ View All Entries (Combined)
❌ Cannot Delete Others' Data
```

### 🟡 Volunteer
```
❌ No Access To Finance Modules
```

## 📊 Database Schema

### Tables Created: 4

#### 1️⃣ `fund_collections`
Track all fund raised with detailed information:
```
- Payer name, Amount
- Payment Mode (Cash/Online)
- Transaction ID (for online)
- Department, Contributor Type
- Received By (Auto-filled, user ID)
- Timestamps & Notes
```

#### 2️⃣ `bill_folders`
Organize expenses by folders:
```
- Folder Name, Description
- Event Association
- Created By (Tracking)
- Timestamps
```

#### 3️⃣ `expenses`
Detailed expense tracking with auto-calculations:
```
- Category (Fuel, Food, Travel, Accommodation, Other)
- Expense Title
- Amount Breakdown:
  - Breakfast, Lunch, Dinner, Refreshment
  - Fuel, Accommodation, Other
- Auto-Calculated Totals:
  - food_total (auto-sum)
  - travel_total (auto-sum)
  - grand_total (complete total)
- Transport Details (from/to/mode)
```

#### 4️⃣ `settings`
System-wide configuration:
```
- fundraising_enabled (Boolean)
- qr_code_path (Image Path)
- Extensible for future settings
```

## 🚀 Key Features

### 💰 Fund Raising Module
- ✅ **QR Code Display** - Admin uploads QR, auto-displayed to office bearers
- ✅ **Dual Payment Modes** - Cash & Online (with transaction ID)
- ✅ **Auto-fill User** - "Received By" field auto-filled with logged-in user
- ✅ **Enable/Disable** - Admin can toggle module on/off
- ✅ **Payment Mode Badges** - Visual distinction between cash & online
- ✅ **User-wise Summary** - See who collected how much
- ✅ **Daily Summaries** - Track collections by date

### 📁 Bill Management Module
- ✅ **Folder Organization** - Group expenses logically
- ✅ **Detailed Tracking** - Meal-by-meal, transport breakdown
- ✅ **Auto Calculations** - Food total, travel total, grand total
- ✅ **Category Filtering** - Organize by expense type
- ✅ **Folder Summaries** - Quick total per folder
- ✅ **User Creation Tracking** - See who created what

### ⚙️ Admin Settings
- ✅ **Fundraising Toggle** - Enable/disable with one click
- ✅ **QR Upload** - Drag & drop QR code image
- ✅ **QR Delete** - Replace or remove QR code
- ✅ **File Validation** - Only images allowed (PNG, JPEG, GIF)
- ✅ **Size Limit** - 5MB max per file

### 📊 Financial Summary
- ✅ **Total Fund Raised** - Complete amount collected
- ✅ **Total Expenses** - Complete amount spent
- ✅ **Balance Calculation** - Fund Raised - Expenses
- ✅ **Status Indicator** - Surplus or Deficit
- ✅ **Real-time Updates** - Changes reflect immediately
- ✅ **Summary Cards** - Visual financial overview

## 🔐 Security Features

✅ **JWT Authentication** - All endpoints secured
✅ **Role-based Access** - Middleware enforces permissions
✅ **Auto-filled received_by** - Cannot be manually edited
✅ **Input Validation** - All amounts validated
✅ **SQL Injection Protection** - Parameterized queries
✅ **File Upload Security** - Type & size validation
✅ **Error Handling** - Graceful error messages

## 📱 UI/UX Features

- ✅ **Mobile Responsive** - Works on all devices
- ✅ **Tab-based Navigation** - Overview | Fundraising | Expenses
- ✅ **QR Centered Display** - Easy scanning
- ✅ **Real-time Calculations** - Instant feedback
- ✅ **Status Badges** - Quick visual status
- ✅ **Data Tables** - Organized display
- ✅ **Loading States** - User feedback
- ✅ **Toast Notifications** - Action confirmation
- ✅ **Modal Forms** - Clean data entry
- ✅ **Grid Layouts** - Modern presentation

## 📝 API Endpoints

### Fundraising (9 endpoints)
```
GET    /api/fundraising/status
POST   /api/fundraising/add
GET    /api/fundraising/list/:eventId
GET    /api/fundraising/summary/:eventId
GET    /api/fundraising/user-contribution/:eventId
GET    /api/fundraising/daily-totals/:eventId
DELETE /api/fundraising/:id
```

### Expenses (7 endpoints)
```
POST   /api/expenses/folder/add
GET    /api/expenses/folders/:eventId
GET    /api/expenses/folder/:folderId
POST   /api/expenses/add
GET    /api/expenses/list/:eventId
PUT    /api/expenses/:id
DELETE /api/expenses/:id
GET    /api/expenses/event/:eventId/by-category
```

### Finance Settings (4 endpoints)
```
GET    /api/finance/settings
POST   /api/finance/settings/fundraising/toggle
POST   /api/finance/settings/qrcode/upload
POST   /api/finance/settings/qrcode/delete
GET    /api/finance/summary/:eventId
```

## 🎯 User Workflows

### 📋 Admin Setup Event
```
1. Create Event
2. Go to Finance Settings (/admin/finance-settings)
3. Toggle "Enable Fund Raising" ON
4. Upload QR code image
5. Share event link with office bearers
```

### 💰 Office Bearer Add Collection
```
1. Event created with fundraising enabled
2. Navigate to Event Funds (/office-bearer/events/:eventId/funds)
3. Click "Add Collection Entry"
4. Enter: Payer Name, Amount, Payment Mode
5. System auto-fills "Received By"
6. Entry added to database
7. View in collections table
```

### 📁 Office Bearer Manage Bills
```
1. Create Bill Folder ("Venue Expenses")
2. Add multiple expenses to folder
3. Enter title and breakdown amounts
4. System auto-calculates food_total, travel_total, grand_total
5. View all expenses per folder
6. See folder total
```

### 📊 Admin View Summary
```
1. Event Funds Management (/admin/events/:eventId/funds)
2. Overview Tab:
   - Total Fund Raised
   - Total Expenses
   - Balance (Surplus/Deficit)
3. Fundraising Tab: All collections with "Received By"
4. Expenses Tab: All folders with expense breakdown
5. Can delete any entry if needed
```

## 🔄 Auto-Calculations

### Expense Totals (Auto-Calculated in Database)
```
food_total = breakfast + lunch + dinner + refreshment
travel_total = fuel_amount
grand_total = food_total + travel_total + accommodation + other

Note: Using MySQL GENERATED ALWAYS AS (Computed Columns)
```

### Financial Summary
```
total_fund_raised = SUM(all collections)
total_expenses = SUM(all expense grand_totals)
balance = total_fund_raised - total_expenses
status = (balance >= 0) ? 'Surplus' : 'Deficit'
```

## 📦 Files Created

### Backend (7 files)
```
backend/
├── migrations/
│   └── 03_event_fundraising_system.sql     ← Database schema
├── models/
│   ├── FundCollection.js                   ← Fund tracking
│   ├── Expense.js                          ← Expense management
│   ├── BillFolder.js                       ← Folder organization
│   └── Settings.js                         ← Settings management
├── routes/
│   ├── fundraising.js                      ← Fund APIs
│   └── expenses.js                         ← Expense APIs
└── middleware/
    └── validation.js                       ← Input validation
```

### Frontend (3 files)
```
frontend/src/
├── pages/
│   ├── EventFundsManagement.tsx             ← Main dashboard
│   └── EventFinanceSettings.tsx             ← Admin settings
└── lib/
    └── financeApi.ts                        ← API helpers
```

### Documentation (3 files)
```
/
├── FINANCE_SYSTEM_INTEGRATION.md            ← Integration steps
├── SETUP_FINANCE_SYSTEM.sh                  ← Quick setup script
└── EVENT_FINANCE_README.md                  ← This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js + Express running
- MySQL database
- React frontend setup
- JWT authentication established

### 3-Step Integration

```bash
# 1. Run Database Migration
mysql -u root -p your_db < backend/migrations/03_event_fundraising_system.sql

# 2. Add Routes to Backend (server.js)
# - Add imports for fundraising & expenses routes
# - Register routes with app.use()

# 3. Add Pages to Frontend (App.tsx)
# - Import EventFundsManagement & EventFinanceSettings
# - Add routes for both components
```

See `FINANCE_SYSTEM_INTEGRATION.md` for detailed steps.

## ✅ Testing Checklist

- [ ] Database migration successful
- [ ] Backend routes registered
- [ ] Frontend pages added to routes
- [ ] Admin can toggle fundraising
- [ ] Admin can upload QR code
- [ ] Office bearer can add collections
- [ ] Office bearer can create folders
- [ ] Office bearer can add expenses
- [ ] Amounts auto-calculate correctly
- [ ] Admin can delete entries
- [ ] Volunteer cannot access finance
- [ ] Mobile responsive design works
- [ ] Summary calculates correctly

## 🆘 Troubleshooting

### Collections Not Showing
- Check `fundraising_enabled` is `true`
- Verify user has office_bearer role
- Confirm JWT token is valid

### QR Code Won't Upload
- Check file is valid image (PNG, JPEG, GIF)
- Verify file size < 5MB
- Ensure `/uploads/qrcodes/` directory exists

### Calculations Wrong
- Verify amounts are numeric values
- Check grand_total formula in database
- Clear browser cache

### Permissions Denied
- Verify user role in database
- Check JWT token includes correct role
- Review middleware authorization

## 📚 Documentation Files

- **FINANCE_SYSTEM_INTEGRATION.md** - Complete integration guide
- **SETUP_FINANCE_SYSTEM.sh** - Automated setup checklist
- **EVENT_FINANCE_README.md** - This comprehensive guide

## 🎓 Learning Resources

The system demonstrates:
- ✅ MVC Architecture (Models, Routes, API)
- ✅ Role-based Access Control (RBAC)
- ✅ MySQL Database Design (Relations, Computed Columns)
- ✅ RESTful API Design
- ✅ Input Validation & Security
- ✅ Frontend-Backend Integration
- ✅ Responsive UI/UX Design
- ✅ Error Handling & User Feedback

## 🔄 Version History

**v1.0** (Current)
- Core fundraising module
- Expense management with folders
- Admin settings
- Financial summary
- Role-based access control

**Future Enhancements** (v2.0)
- Receipt uploads
- Approval workflows
- Email notifications
- Export to Excel/PDF
- Budget tracking
- Advanced analytics

## 📞 Support & Issues

For help:
1. Check FINANCE_SYSTEM_INTEGRATION.md troubleshooting section
2. Review database migration output
3. Check browser console for API errors
4. Verify all roles and permissions
5. Clear cache and browser storage

## 📄 License & Credits

Built as part of SM Volunteers Dashboard system.
Follows best practices for:
- Security & authentication
- Database design
- API development
- Frontend architecture

---

**Status:** ✅ Production Ready
**Last Updated:** 2024
**Version:** 1.0.0
