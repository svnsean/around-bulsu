-- Emergency Alerts Table Migration for ARound BulSU
-- Run this ENTIRE script in Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/wcubybptmqnpfxvekmhv/sql/new

-- Step 1: Drop the table if it exists (to start fresh)
DROP TABLE IF EXISTS public.emergency_alerts CASCADE;

-- Step 2: Create the emergency_alerts table
CREATE TABLE public.emergency_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT,
  alert_type TEXT DEFAULT 'emergency',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Step 3: Enable Row Level Security
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Step 4: Create permissive policies
DROP POLICY IF EXISTS "Allow all operations" ON public.emergency_alerts;
CREATE POLICY "Allow all operations" ON public.emergency_alerts
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Step 5: Grant access
GRANT ALL ON public.emergency_alerts TO authenticated;
GRANT ALL ON public.emergency_alerts TO anon;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 6: Create RPC function to insert alerts (bypasses schema cache)
CREATE OR REPLACE FUNCTION create_emergency_alert(
  p_title TEXT,
  p_message TEXT,
  p_alert_type TEXT DEFAULT 'emergency'
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.emergency_alerts (title, message, alert_type, active)
  VALUES (p_title, p_message, p_alert_type, true)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create RPC function to stop alerts
CREATE OR REPLACE FUNCTION stop_emergency_alert(p_alert_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.emergency_alerts SET active = false WHERE id = p_alert_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create RPC function to get active alerts
CREATE OR REPLACE FUNCTION get_active_alerts()
RETURNS SETOF public.emergency_alerts AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.emergency_alerts WHERE active = true ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Enable realtime (ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Table already in realtime publication';
END $$;

-- Verify success
SELECT 'SUCCESS! Table and RPC functions created.' as status;
