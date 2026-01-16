-- =====================================================
-- ARound BulSU - Supabase Migration SQL
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- DROP EXISTING TABLES (if you want a fresh start)
-- Uncomment these lines if you want to reset everything
-- =====================================================
DROP TABLE IF EXISTS edges CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS evacuation_zones CASCADE;
DROP TABLE IF EXISTS blockages CASCADE;
DROP TABLE IF EXISTS emergency_contacts CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- =====================================================
-- 1. BUILDINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  rooms JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_buildings_location ON buildings (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_buildings_name ON buildings (name);

-- =====================================================
-- 2. NODES TABLE (Navigation graph vertices)
-- =====================================================
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_nodes_location ON nodes (lng, lat);

-- =====================================================
-- 3. EDGES TABLE (A* pathfinding connections)
-- =====================================================
CREATE TABLE IF NOT EXISTS edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_node UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  weight DOUBLE PRECISION DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pathfinding queries
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges (from_node);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges (to_node);

-- =====================================================
-- 4. EVACUATION ZONES TABLE (Polygon safe zones)
-- =====================================================
CREATE TABLE IF NOT EXISTS evacuation_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  color TEXT DEFAULT '#22c55e',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. BLOCKAGES TABLE (Route obstacles - polygon)
-- =====================================================
CREATE TABLE IF NOT EXISTS blockages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blockages_active ON blockages (active);

-- =====================================================
-- 6. EMERGENCY CONTACTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  category TEXT DEFAULT 'emergency',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_category ON emergency_contacts (category);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_order ON emergency_contacts ("order");

-- =====================================================
-- 7. ANNOUNCEMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements (active);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements (created_at DESC);

-- =====================================================
-- 8. NOTIFICATIONS TABLE (Push notification history)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'general',
  sent_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE evacuation_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockages ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (mobile app needs to read)
CREATE POLICY "Public read access" ON buildings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON nodes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON edges FOR SELECT USING (true);
CREATE POLICY "Public read access" ON evacuation_zones FOR SELECT USING (true);
CREATE POLICY "Public read access" ON blockages FOR SELECT USING (true);
CREATE POLICY "Public read access" ON emergency_contacts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON announcements FOR SELECT USING (true);
CREATE POLICY "Public read access" ON notifications FOR SELECT USING (true);

-- For development: Allow all operations (remove in production!)
CREATE POLICY "Allow all for dev" ON buildings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON edges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON evacuation_zones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON blockages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON emergency_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- STORAGE BUCKET FOR IMAGES
-- =====================================================
-- Run this separately in Storage settings or via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- Enable realtime for all tables (for live updates in admin)
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE buildings;
ALTER PUBLICATION supabase_realtime ADD TABLE nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE edges;
ALTER PUBLICATION supabase_realtime ADD TABLE evacuation_zones;
ALTER PUBLICATION supabase_realtime ADD TABLE blockages;
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =====================================================
-- DONE! Tables are ready for data migration.
-- =====================================================
