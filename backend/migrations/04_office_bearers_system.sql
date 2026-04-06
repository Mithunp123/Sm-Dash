-- Migration: Add Office Bearer Role-Based Access Control System
-- Date: 2026-04-06
-- Description: Create office_bearers table and role_permissions reference table

-- ============================================================================
-- 1. Create office_bearers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS office_bearers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  position ENUM(
    'President',
    'Vice President',
    'Secretary',
    'Joint Secretary',
    'Treasurer',
    'Joint Treasurer'
  ) NOT NULL,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  term_end_date DATE NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_office_bearer_user FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uk_office_bearer_position UNIQUE (position),
  INDEX idx_office_bearer_user (user_id),
  INDEX idx_office_bearer_active (is_active),
  INDEX idx_office_bearer_position (position)
);

-- ============================================================================
-- 2. Create role_permissions reference table
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position VARCHAR(50) NOT NULL,
  feature VARCHAR(100) NOT NULL,
  permission_level ENUM('view', 'create', 'edit', 'delete') DEFAULT 'view',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT uk_role_permissions UNIQUE (position, feature),
  INDEX idx_role_permissions_position (position),
  INDEX idx_role_permissions_feature (feature)
);

-- ============================================================================
-- 3. Seed role_permissions with default permissions
-- ============================================================================

INSERT INTO role_permissions (position, feature, permission_level, description) VALUES

-- PRESIDENT (Full Access)
('President', 'all', 'edit', 'Super Admin - Full access to all features'),

-- VICE PRESIDENT (Full Access)
('Vice President', 'all', 'edit', 'Super Admin - Full access to all features'),

-- SECRETARY (People, Projects, Meetings)
('Secretary', 'people', 'edit', 'Can manage people and teams'),
('Secretary', 'projects', 'edit', 'Can manage projects'),
('Secretary', 'meetings', 'edit', 'Can manage meetings'),
('Secretary', 'teams', 'view', 'Can view teams'),
('Secretary', 'events', 'view', 'Can view events'),
('Secretary', 'announcements', 'view', 'Can view announcements'),
('Secretary', 'office-bearers', 'view', 'Can view office bearer assignments'),

-- JOINT SECRETARY (Limited View Access)
('Joint Secretary', 'people', 'view', 'Can view people'),
('Joint Secretary', 'meetings', 'view', 'Can view meetings'),
('Joint Secretary', 'events', 'view', 'Can view events'),
('Joint Secretary', 'announcements', 'view', 'Can view announcements'),
('Joint Secretary', 'teams', 'view', 'Can view teams'),

-- TREASURER (Finance & Reports)
('Treasurer', 'finance', 'edit', 'Can manage finance entries'),
('Treasurer', 'reports', 'view', 'Can view financial reports'),
('Treasurer', 'billing', 'view', 'Can view billing information'),
('Treasurer', 'announcements', 'view', 'Can view announcements'),
('Treasurer', 'events', 'view', 'Can view events'),

-- JOINT TREASURER (Finance Read-Only)
('Joint Treasurer', 'finance', 'view', 'Can view finance entries'),
('Joint Treasurer', 'reports', 'view', 'Can view financial reports'),
('Joint Treasurer', 'announcements', 'view', 'Can view announcements'),
('Joint Treasurer', 'events', 'view', 'Can view events'),

-- STUDENT (Default User - Basic Access)
('student', 'events', 'view', 'Can view events'),
('student', 'teams', 'view', 'Can view and join teams'),
('student', 'announcements', 'view', 'Can view announcements'),
('student', 'attendance', 'view', 'Can view own attendance'),
('student', 'profile', 'edit', 'Can edit own profile'),
('student', 'messages', 'view', 'Can view messages'),
('student', 'messages', 'create', 'Can send messages'),
('student', 'feedback', 'view', 'Can view feedback'),
('student', 'feedback', 'create', 'Can submit feedback');

-- ============================================================================
-- 4. Create activity_logs table (Optional - for audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  before_value JSON,
  after_value JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_activity_logs_user_timestamp (user_id, timestamp),
  INDEX idx_activity_logs_action (action),
  INDEX idx_activity_logs_entity (entity_type, entity_id)
);

-- ============================================================================
-- 5. Verification Queries
-- ============================================================================

-- Verify tables were created
-- SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
-- WHERE TABLE_SCHEMA = DATABASE() 
-- AND TABLE_NAME IN ('office_bearers', 'role_permissions', 'activity_logs');

-- Verify sample permissions exist
-- SELECT COUNT(*) as permission_count FROM role_permissions;

-- Verify unique constraint on position
-- SELECT * FROM office_bearers ORDER BY assigned_date DESC LIMIT 5;
