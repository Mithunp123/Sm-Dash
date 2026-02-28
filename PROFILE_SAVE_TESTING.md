# Profile Save Testing Guide

## How to Test the Fix

### Prerequisites
- Backend server running on `localhost:3000`
- Database initialized (MySQL or SQLite)
- Student account available

### Test Steps

#### 1. Login as a Student
1. Navigate to login page
2. Enter student credentials
3. Click Login

#### 2. Navigate to Profile
1. After login, go to Student Profile page (usually `/profile` or from dashboard)
2. You should see a profile form with fields like:
   - Name
   - Email
   - Register No
   - Department
   - Year
   - Phone
   - Blood Group
   - Gender
   - DOB
   - Address
   - Hosteller/Dayscholar

#### 3. Fill Profile Data
1. Enter some data in the fields (e.g., Department: "Computer Science")
2. You should see the form enter "Edit" mode (button changes to "Save Profile")

#### 4. Save Profile
1. Click the "Save Profile" button
2. You should see:
   - A loading indicator (button shows "Saving...")
   - A success toast message: "Profile updated successfully!"
   - The form exits edit mode

#### 5. Verify Data is Persisted
1. Refresh the page (F5)
2. Navigate back to profile
3. You should see all the data you saved is still there

### Browser Console Checks

#### Check Console Logs
1. Open Browser Developer Tools (F12)
2. Go to Console tab
3. Look for messages from the API request

#### Expected Logs (frontend)
- No errors
- Network request to `PUT /api/users/{userId}/profile` should show **200 OK** status

#### Server Console Logs (if you can see backend logs)
1. Check backend terminal/logs
2. You should see messages like:
   ```
   📋 Profile update request for user 123
   ✅ User found: 123, role: student
   ✅ Profile updated for user 123, changes made: 1
   ```

### What to Check if Save Still Doesn't Work

#### Issue: Save button does nothing
- **Check**: Browser console for errors
- **Check**: Network tab to see if request is sent
- **Check**: Backend server console for error logs
- **Check**: Student has proper authentication (token valid)

#### Issue: Save shows error
- **Check**: Error message in toast notification
- **Check**: Browser console for the specific error
- **Check**: Authorization - make sure student is saving their own profile (not another student's)

#### Issue: Data is not saved after refresh
- **Check**: Database directly with:
  ```sql
  SELECT * FROM profiles WHERE user_id = {studentId};
  ```
- **Check**: Backend logs to see if UPDATE query was successful
- **Check**: Database permissions and connection

### Database Direct Query Test (if using MySQL client)

```sql
-- Check if student profile exists
SELECT * FROM profiles WHERE user_id = 1;

-- Check updated_at timestamp
SELECT id, user_id, dept, year, phone, updated_at FROM profiles WHERE user_id = 1;
```

If `updated_at` changes after clicking save, the database is being updated correctly.

### Testing with cURL (Manual API Test)

```bash
# Update a student profile via API
curl -X PUT http://localhost:3000/api/users/1/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dept": "Computer Science",
    "year": "3",
    "phone": "9876543210",
    "register_no": "CSE001"
  }'

# Expected response:
# {"success":true,"message":"Profile updated successfully"}
```

## Success Criteria
- ✅ Student can fill profile form
- ✅ Clicking save shows "Profile updated successfully!" message
- ✅ Page reloads and shows saved data
- ✅ Browser console shows no errors
- ✅ Backend logs show profile was updated
- ✅ Database has the updated data

## Troubleshooting Commands

### Check Backend Logs for Profile Operations
```bash
# View recent logs (if you have logging set up)
tail -f backend.log | grep -i profile
```

### Test Database Connection
```bash
# For MySQL
mysql -h localhost -u user -p database_name -e "SELECT * FROM profiles;"

# For SQLite
sqlite3 smvdb.db "SELECT * FROM profiles;"
```

### Check if Student User was Created with Profile
```bash
# Check users table
SELECT id, name, email, role FROM users WHERE role = 'student';

# Check their profiles
SELECT * FROM profiles WHERE user_id IN (SELECT id FROM users WHERE role = 'student');
```
