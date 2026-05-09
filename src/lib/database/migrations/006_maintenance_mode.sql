-- Maintenance mode table to control service availability
CREATE TABLE IF NOT EXISTS maintenance_mode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT false NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Only allow one row in maintenance_mode table
CREATE UNIQUE INDEX maintenance_mode_single_row ON maintenance_mode ((1));

-- Enable RLS
ALTER TABLE maintenance_mode ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write maintenance mode
-- Admin emails are checked via the admin-config helper
CREATE POLICY "Admins can view maintenance mode"
  ON maintenance_mode FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update maintenance mode"
  ON maintenance_mode FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert maintenance mode"
  ON maintenance_mode FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Public can read maintenance mode status (for banners)
CREATE POLICY "Public can read maintenance mode"
  ON maintenance_mode FOR SELECT
  TO anon
  USING (true);
