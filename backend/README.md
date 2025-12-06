# SM Volunteers Backend API

Backend API server for SM Volunteers management system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
DB_PATH=./database/sm_volunteers.db
NODE_ENV=development
```

3. Initialize database:
```bash
npm run init-db
```

This will create the SQLite database and all required tables, plus the default admin user.

4. Start server:
```bash
npm run dev  # Development with nodemon
# or
npm start    # Production
```

## Database

The system uses SQLite by default. The database file will be created at the path specified in `DB_PATH`.

To migrate to PostgreSQL or MySQL:
1. Install the appropriate driver (`pg` for PostgreSQL, `mysql2` for MySQL)
2. Update the database connection in `database/init.js`
3. Adjust SQL syntax if needed (SQLite uses slightly different syntax)

## Default Admin User

After running `npm run init-db`, you can login with:
- Email: `smvolunteers@ksrct.ac.in`
- Password: `12345`

## API Documentation

All endpoints are prefixed with `/api`.

### Authentication Required

Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Error message"
}
```

### Success Responses

Success responses follow this format:
```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

