# FCM Push Notifications Setup Guide

This guide covers setting up Firebase Cloud Messaging (FCM) for the ARound BulSU project.

## Prerequisites

- Supabase project with tables set up (run `supabase-migration.sql`)
- Firebase project (`around-bulsu-backend`)
- Supabase CLI installed (`npm install -g supabase`)

---

## Step 1: Run Database Migration

The FCM system requires two additional tables: `user_fcm_tokens` and `alerts`.

1. Go to **Supabase Dashboard → SQL Editor**
2. Run the updated `bulsu-admin/supabase-migration.sql` file
3. Or run just the new tables:

```sql
-- User FCM Tokens (stores device tokens)
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts (emergency push notification history)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT DEFAULT 'critical',
  is_active BOOLEAN DEFAULT true,
  sent_by TEXT DEFAULT 'admin',
  recipient_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for dev)
CREATE POLICY "Allow all for user_fcm_tokens" ON user_fcm_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for alerts" ON alerts FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE user_fcm_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
```

---

## Step 2: Get Firebase Service Account JSON

1. Go to **Firebase Console** → Select project `around-bulsu-backend`
2. Click **⚙️ Project Settings** → **Service Accounts** tab
3. Click **"Generate new private key"**
4. Save the downloaded JSON file (e.g., `service-account.json`)

> ⚠️ Keep this file secure! It contains credentials to send notifications to all users.

---

## Step 3: Set Supabase Edge Function Secret

The edge function needs the service account to authenticate with FCM V1 API.

### Option A: Using Supabase CLI

```bash
# Navigate to project root
cd c:\Users\seana\Desktop\apps

# Login to Supabase (if not already)
supabase login

# Link to your project (get project ref from Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Set the secret (paste the entire JSON content)
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat path/to/service-account.json)"
```

### Option B: Via Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Add new secret:
   - Name: `FCM_SERVICE_ACCOUNT`
   - Value: (paste entire JSON content from service account file)

---

## Step 4: Deploy the Edge Function

```bash
cd c:\Users\seana\Desktop\apps

# Deploy the send-alert function
supabase functions deploy send-alert --project-ref YOUR_PROJECT_REF
```

Or if you have the project linked:

```bash
supabase functions deploy send-alert
```

---

## Step 5: Verify Android Configuration

The mobile app's AndroidManifest.xml should have:

```xml
<!-- POST_NOTIFICATIONS permission for Android 13+ -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.INTERNET"/>

<!-- Inside <application> tag -->
<meta-data 
  android:name="com.google.firebase.messaging.default_notification_channel_id" 
  android:value="emergency_alerts" 
  tools:replace="android:value"/>
```

---

## Step 6: Test Push Notifications

### From Admin Panel

1. Open the Admin Panel (`bulsu-admin`)
2. Go to **Emergency Manager** section
3. Enter a test alert title and message
4. Click **Send Alert**

### Verify in Supabase

1. Check `user_fcm_tokens` table - should have registered device tokens
2. Check `alerts` table - should show sent alerts with recipient count

### Debug Logs

View edge function logs:
```bash
supabase functions logs send-alert --project-ref YOUR_PROJECT_REF
```

---

## Troubleshooting

### "No FCM tokens found"
- Make sure the mobile app has been opened at least once on a real device
- Check that `requestNotificationPermission()` was called and granted
- Verify tokens are being stored in `user_fcm_tokens` table

### "Invalid service account"
- Verify `FCM_SERVICE_ACCOUNT` secret is set correctly
- Ensure the JSON is valid (no truncation)
- Check that the service account belongs to the correct Firebase project

### "Notification not received"
- iOS Simulators don't support push notifications - use a real device
- Android emulators may work but real devices are recommended
- Check if the app is force-closed (may need to be in background, not killed)
- Verify notification permission is granted in device settings

### Edge function returns 500 error
- Check function logs for detailed error
- Verify Supabase URL and anon key are correct
- Ensure tables exist and RLS policies allow access

---

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Admin Panel   │──────│  Supabase Edge  │──────│   FCM V1 API    │
│  (bulsu-admin)  │      │    Function     │      │  (Google Cloud) │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        │ 1. Create alert        │                        │
        │ 2. Call send-alert     │                        │
        └────────────────────────┤                        │
                                 │ 3. Get FCM tokens      │
                                 │    from Supabase       │
                                 │                        │
                                 │ 4. Send to each device │
                                 ├────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Mobile Devices      │
                    │   (around-bulsu app)    │
                    └─────────────────────────┘
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `supabase-functions/send-alert/index.ts` | Edge function that sends FCM notifications |
| `around-bulsu/src/services/notificationService.js` | Mobile app FCM handling |
| `around-bulsu/android/app/google-services.json` | Firebase Android config |
| `bulsu-admin/src/EmergencyManager.js` | Admin panel alert sending UI |
| `bulsu-admin/supabase-migration.sql` | Database schema including FCM tables |
