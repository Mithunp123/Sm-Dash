import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import attendanceRoutes from './routes/attendance.js';
import meetingRoutes from './routes/meetings.js';
import projectRoutes from './routes/projects.js';
import billRoutes from './routes/bills.js';
import timeRoutes from './routes/time.js';
import permissionRoutes from './routes/permissions.js';
import permissionRequestRoutes from './routes/permissionRequests.js';
import settingsRoutes from './routes/settings.js';
import feedbackRoutes from './routes/feedback.js';
import eventRoutes from './routes/events.js';
import resourcesRoutes from './routes/resources.js';
import teamsRoutes from './routes/teams.js';
import uploadRoutes from './routes/upload.js';
import phoneMentoringRoutes from './routes/phoneMentoring.js';
import { initDatabase } from './database/init.js';

// Load .env from backend directory first, then fallback to root directory
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initDatabase();

// Serve uploaded files (photos, resources, etc.) from public/uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Serve favicon.ico from root public folder
app.get('/favicon.ico', (req, res) => {
  // Get the root directory (one level up from backend)
  const rootDir = path.resolve(__dirname, '..');
  const faviconPath = path.join(rootDir, 'public', 'favicon.ico');
  res.sendFile(faviconPath, (err) => {
    if (err) {
      // If favicon not found, return 204 No Content (browser will stop requesting)
      res.status(204).end();
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
// Also expose auth routes at /auth so frontend simple redirects (e.g. /auth/google) work
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/permission-requests', permissionRequestRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/phone-mentoring', phoneMentoringRoutes);

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

app.listen(PORT, () => {
  console.log(`🚀 SM Volunteers API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

