# ARound BulSU - Supabase Migration Guide

## 📋 Table of Contents
1. [Create Supabase Project](#create-supabase-project)
2. [Database Schema](#database-schema)
3. [Enable Real-time](#enable-real-time)
4. [Storage Setup](#storage-setup)
5. [Update Configuration](#update-configuration)
6. [Install Dependencies](#install-dependencies)

---

## 🚀 Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Enter project name: `around-bulsu`
4. Set a secure database password
5. Select region closest to Philippines
6. Click **"Create new project"**

---

## 🗄️ Database Schema

Run these SQL commands in Supabase SQL Editor:

```sql
-- Buildings table
CREATE TABLE buildings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  rooms JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Navigation nodes
CREATE TABLE nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Navigation edges
CREATE TABLE edges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "from" UUID REFERENCES nodes(id) ON DELETE CASCADE,
  "to" UUID REFERENCES nodes(id) ON DELETE CASCADE,
  weight DOUBLE PRECISION DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evacuation zones
CREATE TABLE "evacuationZones" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  points JSONB NOT NULL,
  color TEXT DEFAULT '#22c55e',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blockages
CREATE TABLE blockages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  points JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency contacts
CREATE TABLE "emergencyContacts" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  category TEXT,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Announcements
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications history
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'general',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_by TEXT
);
```

---

## ⚡ Enable Real-time

1. Go to **Database** → **Replication**
2. Enable replication for all tables:
   - buildings
   - nodes
   - edges
   - evacuationZones
   - blockages
   - emergencyContacts
   - announcements
   - notifications

Or run:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE buildings;
ALTER PUBLICATION supabase_realtime ADD TABLE nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE edges;
ALTER PUBLICATION supabase_realtime ADD TABLE "evacuationZones";
ALTER PUBLICATION supabase_realtime ADD TABLE blockages;
ALTER PUBLICATION supabase_realtime ADD TABLE "emergencyContacts";
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

---

## 📦 Storage Setup

1. Go to **Storage** in Supabase dashboard
2. Create a new bucket called `images`
3. Set bucket to **Public**
4. Add policy for uploads (or use open access for development):

```sql
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'images');
```

---

## ⚙️ Update Configuration

1. Go to **Settings** → **API**
2. Copy **Project URL** and **anon public** key
3. Update both config files:

**around-bulsu/src/supabase.js:**
```javascript
const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY';
```

**bulsu-admin/src/supabase.js:**
```javascript
const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseAnonKey = 'YOUR_ANON_KEY';
```

---

## 📥 Install Dependencies

**Mobile App:**
```bash
cd around-bulsu
npm install @supabase/supabase-js
```

**Admin Site:**
```bash
cd bulsu-admin
npm install @supabase/supabase-js
```

---

## 🔒 Row Level Security (Production)

For production, enable RLS on all tables:

```sql
-- Enable RLS
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evacuationZones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockages ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emergencyContacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow public read for all tables
CREATE POLICY "Public read" ON buildings FOR SELECT USING (true);
CREATE POLICY "Public read" ON nodes FOR SELECT USING (true);
CREATE POLICY "Public read" ON edges FOR SELECT USING (true);
CREATE POLICY "Public read" ON "evacuationZones" FOR SELECT USING (true);
CREATE POLICY "Public read" ON blockages FOR SELECT USING (true);
CREATE POLICY "Public read" ON "emergencyContacts" FOR SELECT USING (true);
CREATE POLICY "Public read" ON announcements FOR SELECT USING (true);
CREATE POLICY "Public read" ON notifications FOR SELECT USING (true);

-- For development, allow all writes (update for production)
CREATE POLICY "Dev write" ON buildings FOR ALL USING (true);
CREATE POLICY "Dev write" ON nodes FOR ALL USING (true);
CREATE POLICY "Dev write" ON edges FOR ALL USING (true);
CREATE POLICY "Dev write" ON "evacuationZones" FOR ALL USING (true);
CREATE POLICY "Dev write" ON blockages FOR ALL USING (true);
CREATE POLICY "Dev write" ON "emergencyContacts" FOR ALL USING (true);
CREATE POLICY "Dev write" ON announcements FOR ALL USING (true);
CREATE POLICY "Dev write" ON notifications FOR ALL USING (true);
```

---

## ✅ Migration Checklist

- [ ] Create Supabase project
- [ ] Run SQL schema creation
- [ ] Enable real-time replication
- [ ] Create storage bucket
- [ ] Update supabase.js in both apps
- [ ] Install @supabase/supabase-js
- [ ] Test admin site
- [ ] Test mobile app
- [ ] Remove old firebase.js files (optional)

---

## 🔄 Key Differences from Firebase

| Firebase | Supabase |
|----------|----------|
| `onSnapshot()` | `supabase.channel().on()` |
| `addDoc()` | `supabase.from().insert()` |
| `updateDoc()` | `supabase.from().update()` |
| `deleteDoc()` | `supabase.from().delete()` |
| `doc.id` | `row.id` (UUID) |
| `doc.data()` | Direct row data |
| Firebase Storage | Supabase Storage |

**Ready to go! 🎉**
