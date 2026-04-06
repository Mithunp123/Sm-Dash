import express from 'express'; // Restart trigger
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import studentRoutes from './routes/students.js';
import interviewRoutes from './routes/interviews.js';
console.log('Loading interview routes...');
import attendanceRoutes from './routes/attendance.js';
import meetingRoutes from './routes/meetings.js';
import projectRoutes from './routes/projects.js';
// billRoutes used to handle legacy billing endpoints; replaced by financeRoutes below
import billRoutes from './routes/bills.js';
import timeRoutes from './routes/time.js';
import settingsRoutes from './routes/settings.js';
import feedbackRoutes from './routes/feedback.js';
import eventRoutes from './routes/events.js';
import awardsRoutes from './routes/awards.js';
import ngoRoutes from './routes/ngo.js';
import resourcesRoutes from './routes/resources.js';
import teamsRoutes from './routes/teams.js';
import uploadRoutes from './routes/upload.js';
import phoneMentoringRoutes from './routes/phoneMentoring.js';
import spocRoutes from './routes/spoc.js';
import officeBearersRoutes from './routes/office_bearers.js';
import announcementRoutes from './routes/announcements.js';
import activityRoutes from './routes/activity.js';
import messageRoutes from './routes/messages.js';
import mailRoutes from './routes/mail.js';
import momRoutes from './routes/mom.js';
import financeRoutes from './routes/finance.js';
import fundraisingRoutes from './routes/fundraising.js';
import expenseRoutes from './routes/expenses.js';
import { initDatabase } from './database/init.js';

// Load .env from backend directory
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
let server;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Debug middleware - log all requests
app.use((req, res, next) => {
  if (req.method === 'DELETE') {
    console.log(`[SERVER DEBUG] Incoming DELETE request - ${req.method} ${req.path}`);
  }
  next();
});

// Serve uploaded files (photos, resources, etc.) from public/uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Serve favicon.ico and favicon.png - SM Volunteers Logo
app.get('/favicon.ico', (req, res) => {
  const rootDir = path.resolve(__dirname, '..');
  const smLogoPath = path.join(rootDir, 'docs', 'Images', 'Picsart_23-05-18_16-47-20-287-removebg-preview.png');
  const faviconPath = path.join(rootDir, 'public', 'favicon.ico');

  // Try SM logo first, then fallback to favicon.ico
  if (fs.existsSync(smLogoPath)) {
    res.sendFile(smLogoPath, { headers: { 'Content-Type': 'image/png' } }, (err) => {
      if (err && fs.existsSync(faviconPath)) {
        res.sendFile(faviconPath);
      } else if (err) {
        res.status(204).end();
      }
    });
  } else if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else {
    res.status(204).end();
  }
});

app.get('/favicon.png', (req, res) => {
  const rootDir = path.resolve(__dirname, '..');
  const smLogoPath = path.join(rootDir, 'docs', 'Images', 'Picsart_23-05-18_16-47-20-287-removebg-preview.png');
  const faviconPngPath = path.join(rootDir, 'public', 'favicon.png');

  if (fs.existsSync(smLogoPath)) {
    res.sendFile(smLogoPath, { headers: { 'Content-Type': 'image/png' } }, (err) => {
      if (err && fs.existsSync(faviconPngPath)) {
        res.sendFile(faviconPngPath);
      } else if (err) {
        res.status(204).end();
      }
    });
  } else if (fs.existsSync(faviconPngPath)) {
    res.sendFile(faviconPngPath);
  } else {
    res.status(204).end();
  }
});

// Routes
app.use('/api/auth', authRoutes);
// Also expose auth routes at /auth so frontend simple redirects (e.g. /auth/google) work
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/projects', projectRoutes);
// legacy bills path now forwards to finance router for new expense/collection logic
app.use('/api/bills', financeRoutes);
// keep old billRoutes import around in case some other module still references it
/* app.use('/api/bills', billRoutes); */
// Event Fund Raising & Bill Management (new spec)
app.use('/api/fundraising', fundraisingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/awards', awardsRoutes);
app.use('/api/ngo', ngoRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/phone-mentoring', phoneMentoringRoutes);
app.use('/api/spoc', spocRoutes);
app.use('/api/office-bearers', officeBearersRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/mom', momRoutes);
app.use('/api/finance', financeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SM Volunteers API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();

    // Start server only after database is ready
    server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error('   Please stop the existing server or change the PORT in .env');
        process.exit(1);
      } else {
        console.error('❌ Server startup error:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
});
