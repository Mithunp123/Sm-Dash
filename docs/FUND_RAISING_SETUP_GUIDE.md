# Fund Raising Setup Guide

## What Was Fixed

### 1. QR Code Display Issue ✅
- **Problem**: QR code image was not displaying in EventFinanceSettings
- **Root Cause**: Backend was returning relative paths like `/uploads/qr_codes/filename.png` instead of full URLs
- **Solution**: Updated backend endpoints to construct and return full URLs with host and protocol:
  ```
  http://localhost:3000/uploads/qr_codes/filename.png
  ```
- **Updated Endpoints**:
  - `GET /api/finance/settings` - Admin settings page
  - `GET /api/fundraising/status` - Office bearers/students view
  - `POST /api/finance/settings/qrcode/upload` - QR upload response

### 2. Database Schema Fix ✅
- Added missing `data_type` column to `settings` table
- Table now includes: `setting_key`, `setting_value`, `data_type`, `updated_by`, `created_at`, `updated_at`

## How to Use Fund Raising

### Step 1: Enable Fund Raising (Admin Only)
1. Navigate to **Finance Settings** page
2. Under "Fund Raising Status", toggle **"Enable Fund Raising"** to ON
3. Status will show: "Fund raising is currently ✓ Enabled"
4. Click **Save**

### Step 2: Upload QR Code (Admin Only)
1. Still on Finance Settings page
2. Scroll to **"QR Code Management"** section
3. Click **"Upload QR Code"** button
4. Select a QR code image (PNG, JPEG, GIF, WebP - max 5MB)
5. Click **Upload**
6. QR code will now display in the preview area

### Step 3: Office Bearers/Students Add Fund Collection
1. Office bearers navigate to **"Funds Management"** (Event module)
2. Click **"Add New Collection"** button
3. Fill in the form:
   - **Payer Name**: Name of the person donating
   - **Amount**: Amount collected
   - **Payment Mode**: Select "Online" to show QR code
4. When "Online" is selected, the QR code will display automatically
5. Enter transaction ID (for tracking) and notes if needed
6. Click **Submit**

## Checklist Before Testing

✅ Database tables initialized with `settings` table
✅ Backend endpoints return full URLs for QR codes
✅ Fund raising toggle endpoint working
✅ QR code upload/delete endpoints working
✅ Three helper functions added to fundraising.js:
   - `getFundraisingEnabled(db)`
   - `getQRCodePath(db)`
   - `requireFundraisingEnabled(req, res, db)`

## API Endpoints Summary

### For Admins
- `GET /api/finance/settings` - Get fundraising status and QR code (returns full URL)
- `POST /api/finance/settings/fundraising/toggle` - Enable/disable fundraising
- `POST /api/finance/settings/qrcode/upload` - Upload QR code
- `POST /api/finance/settings/qrcode/delete` - Delete QR code

### For Office Bearers/Students
- `GET /api/fundraising/status` - Get fundraising status and QR code (returns full URL)
- `POST /api/fundraising/add` - Add fund collection entry
- `GET /api/fundraising/list/:eventId` - View collections for an event
- `GET /api/fundraising/summary/:eventId` - View collection summary

## Permissions

- **Admin**: Full access to settings, QR management, and fund tracking
- **Office Bearer**: Can add/view fund collections (if fundraising enabled)
- **Student**: Read-only access to fund collection summaries (if fundraising enabled)

## Troubleshooting

### QR Code Still Not Showing
1. Ensure fundraising is **Enabled** first
2. Ensure a QR code has been uploaded (check if image preview appears)
3. Check browser console for any 404 errors
4. Verify `/public/uploads/qr_codes/` directory exists on backend

### Fund Raising Toggle Not Working
1. Ensure you are logged in as Admin
2. Check that the `settings` table exists in the database
3. Check backend logs for any errors

### QR Code Not Displaying When Adding Collections
1. The QR code should only display when "Online" payment mode is selected
2. Make sure fundraising is enabled
3. Make sure fund raising toggle is ON (not disabled)
