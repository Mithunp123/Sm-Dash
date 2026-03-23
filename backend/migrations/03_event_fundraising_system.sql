-- ============================================
-- EVENT FUNDRAISING & BILL MANAGEMENT SYSTEM
-- ============================================

-- 1. SETTINGS TABLE (Admin Configuration)
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  data_type ENUM('boolean', 'string', 'json') DEFAULT 'string',
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. FUND COLLECTIONS TABLE
CREATE TABLE IF NOT EXISTS fund_collections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT NOT NULL,
  payer_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  department VARCHAR(100),
  contributor_type ENUM('staff', 'student', 'other') DEFAULT 'other',
  payment_mode ENUM('cash', 'online') NOT NULL,
  transaction_id VARCHAR(100),
  received_by INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_event_id (event_id),
  INDEX idx_created_date (created_at),
  INDEX idx_payment_mode (payment_mode)
);

-- 3. BILL FOLDERS TABLE
CREATE TABLE IF NOT EXISTS bill_folders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT NOT NULL,
  folder_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_event_id (event_id),
  UNIQUE KEY unique_folder_per_event (event_id, folder_name)
);

-- 4. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT NOT NULL,
  folder_id INT NOT NULL,
  expense_title VARCHAR(255) NOT NULL,
  category ENUM('fuel', 'food', 'travel', 'accommodation', 'other') DEFAULT 'other',
  
  -- Transportation Details
  transport_from VARCHAR(255),
  transport_to VARCHAR(255),
  transport_mode VARCHAR(100),
  
  -- Expense Amounts
  fuel_amount DECIMAL(10, 2) DEFAULT 0,
  breakfast_amount DECIMAL(10, 2) DEFAULT 0,
  lunch_amount DECIMAL(10, 2) DEFAULT 0,
  dinner_amount DECIMAL(10, 2) DEFAULT 0,
  refreshment_amount DECIMAL(10, 2) DEFAULT 0,
  accommodation_amount DECIMAL(10, 2) DEFAULT 0,
  other_expense DECIMAL(10, 2) DEFAULT 0,
  
  -- Calculated Totals
  food_total DECIMAL(10, 2) GENERATED ALWAYS AS (breakfast_amount + lunch_amount + dinner_amount + refreshment_amount) STORED,
  travel_total DECIMAL(10, 2) GENERATED ALWAYS AS (fuel_amount) STORED,
  grand_total DECIMAL(10, 2) GENERATED ALWAYS AS (
    breakfast_amount + lunch_amount + dinner_amount + refreshment_amount + 
    accommodation_amount + fuel_amount + other_expense
  ) STORED,
  
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES bill_folders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_event_id (event_id),
  INDEX idx_folder_id (folder_id),
  INDEX idx_created_date (created_at)
);

-- 5. Add fundraising_enabled to events table (if not exists)
ALTER TABLE events ADD COLUMN IF NOT EXISTS fundraising_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_code_path VARCHAR(500) AFTER fundraising_enabled;

-- 6. Insert default settings
INSERT INTO settings (setting_key, setting_value, data_type) 
VALUES 
  ('fundraising_enabled', 'false', 'boolean'),
  ('qr_code_path', '', 'string'),
  ('max_qr_file_size_mb', '5', 'string')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- Add permissions if needed
INSERT INTO permissions (permission_name, description, created_at) 
VALUES 
  ('can_manage_fundraising', 'Can manage fundraising for events', NOW()),
  ('can_view_fundraising', 'Can view fundraising entries', NOW()),
  ('can_manage_expenses', 'Can manage expenses and bills', NOW()),
  ('can_view_expenses', 'Can view expenses and bills', NOW()),
  ('can_manage_settings', 'Can manage system settings', NOW())
ON DUPLICATE KEY UPDATE permission_name = permission_name;
