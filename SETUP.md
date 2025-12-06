# Quick Setup Guide

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

## Step 1: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and set your JWT_SECRET (important for production!)
# For development, you can use the default values

# Initialize database (creates tables and default admin user)
npm run init-db

# Start backend server
npm run dev
```

Backend will run on `http://localhost:3000`

## Step 2: Frontend Setup

```bash
# From project root
npm install

# Create .env file in root
echo "VITE_API_URL=http://localhost:3000/api" > .env

# Start frontend dev server
npm run dev
```

Frontend will run on `http://localhost:8080`

## Step 3: Login

1. Open `http://localhost:8080` in your browser
2. Click "Login" button
3. Use default admin credentials:
   - **Email**: `smvolunteers@ksrct.ac.in`
   - **Password**: `12345`

## Default Passwords (Set by Admin)

When admin creates new users, default passwords are:
- **Office Bearer**: `OB@123`
- **SPOC**: `SPOC@123`
- **Student**: `SMV@123`

Users will be prompted to change password on first login.

## Troubleshooting

### Backend won't start
- Make sure port 3000 is not in use
- Check that database directory exists
- Run `npm run init-db` again if database errors occur

### Frontend can't connect to backend
- Verify backend is running on port 3000
- Check `.env` file has correct `VITE_API_URL`
- Check browser console for CORS errors (shouldn't happen with current setup)

### Database errors
- Delete the database file and run `npm run init-db` again
- Make sure you have write permissions in the backend directory

## Production Deployment

1. Change `JWT_SECRET` to a strong random string
2. Set `NODE_ENV=production` in backend `.env`
3. Build frontend: `npm run build`
4. Serve frontend build files with a web server (nginx, Apache, etc.)
5. Run backend with PM2 or similar process manager
6. Use a production database (PostgreSQL/MySQL) instead of SQLite

## Features Implemented

✅ Landing page with logos, tagline, and animations
✅ JWT authentication system
✅ Role-based dashboards (Admin, Office Bearer, SPOC, Student, Alumni)
✅ Password management (change, reset, admin assignment)
✅ User management
✅ Meeting and attendance tracking
✅ Project management
✅ Bill submission and approval
✅ Time tracking and requests
✅ Alumni management
✅ Professional UI with glowing animations

---

**Happy Coding!** 🚀

