-- Migration: Add 'active' column to notifications table for emergency alert management
-- Run this SQL in your Supabase SQL Editor

-- Add the 'active' column to notifications table
-- This column tracks whether an emergency alert is currently active
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT false;

-- Create an index for efficient filtering of active alerts
CREATE INDEX IF NOT EXISTS idx_notifications_active ON notifications (active) WHERE active = true;

-- Update existing emergency notifications to be inactive by default
UPDATE notifications 
SET active = false 
WHERE type = 'emergency' AND active IS NULL;

-- Comment explaining the column purpose
COMMENT ON COLUMN notifications.active IS 'Indicates if an emergency alert is currently active and should trigger forced notifications in the mobile app';
