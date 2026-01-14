# ARound BulSU - Complete Setup Guide

## 📋 Table of Contents
1. [Admin Login Credentials](#admin-login-credentials)
2. [Firebase Firestore Setup](#firebase-firestore-setup)
3. [Firebase Cloud Messaging (FCM) Setup](#firebase-cloud-messaging-fcm-setup)
4. [Running the Applications](#running-the-applications)

---

## 🔐 Admin Login Credentials

### Hardcoded Credentials (No Firebase Auth Required)
- **Username:** `admin`
- **Password:** `bulsuadmin123`

These credentials are hardcoded in `bulsu-admin/src/Login.js` (lines 6-7). To change them, edit:

```javascript
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'bulsuadmin123';
```

---

## 🔥 Firebase Firestore Setup

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or select your existing project
3. Enter project name: `around-bulsu-backend` (or any name)
4. Disable Google Analytics (optional)
5. Click **"Create project"**

### Step 2: Enable Firestore Database
1. In Firebase Console, click **"Firestore Database"** in left menu
2. Click **"Create database"**
3. Select **"Start in test mode"** (we'll add security rules later)
4. Choose location: **us-central** or closest to Philippines
5. Click **"Enable"**

### Step 3: Get Firebase Config
1. Click **⚙️ Settings** → **Project settings**
2. Scroll to **"Your apps"** section
3. Click **</>** (Web) icon to add web app
4. Register app name: `ARound BulSU Admin` and `ARound BulSU Mobile`
5. Copy the `firebaseConfig` object

### Step 4: Update Firebase Config Files

**Admin (`bulsu-admin/src/firebase.js`):**
```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

**Mobile (`around-bulsu/src/firebase.js`):**
```javascript
// Same config as above
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = { /* paste config here */ };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

### Step 5: Firestore Security Rules
1. In Firebase Console → **Firestore Database** → **Rules** tab
2. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Buildings - Read by all, write by admin only
    match /buildings/{document} {
      allow read: if true;
      allow write: if request.auth != null; // Admin only (if you enable auth later)
    }
    
    // Navigation nodes and edges - Read by all, write by admin
    match /nodes/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /edges/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Emergency features - Read by all, write by admin
    match /evacuationZones/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /blockages/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /emergencyContacts/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Announcements - Read by all, write by admin
    match /announcements/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Notifications history - Read by all, write by admin
    match /notifications/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

**Note:** For development, you can use:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Open access for testing
    }
  }
}
```

### Step 6: Enable Firebase Storage
1. Click **"Storage"** in left menu
2. Click **"Get started"**
3. Use default security rules
4. Click **"Done"**

This is needed for announcement images uploaded by admins.

---

## 📱 Firebase Cloud Messaging (FCM) Setup

### What is FCM Used For?
- Send emergency alerts to all mobile app users
- Push notifications for announcements
- Real-time evacuation alerts

### Step 1: Enable Firebase Cloud Messaging
1. In Firebase Console → **⚙️ Settings** → **Project settings**
2. Go to **"Cloud Messaging"** tab
3. Under **"Cloud Messaging API (Legacy)"**, note your **Server key** (starts with `AAAA...`)
4. Keep this key secure - you'll use it for sending notifications

### Step 2: Mobile App - Install Expo Notifications
```bash
cd around-bulsu
npm install expo-notifications
```

### Step 3: Mobile App - Request FCM Token
Update `around-bulsu/src/firebase.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const firebaseConfig = { /* your config */ };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Get FCM token
export async function registerForPushNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('Expo Push Token:', token);
  return token;
}
```

### Step 4: Mobile App - Register Token on Launch
In `around-bulsu/App.js`, add:

```javascript
import { registerForPushNotifications } from './src/firebase';
import * as Notifications from 'expo-notifications';

function App() {
  useEffect(() => {
    // Register for notifications
    registerForPushNotifications().then(token => {
      if (token) {
        console.log('Push token:', token);
        // Optionally save to Firestore for targeted notifications
      }
    });

    // Listen for notifications
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      // Navigate to relevant screen based on notification data
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);
  
  // ... rest of app
}
```

### Step 5: Admin Site - Send Notifications via HTTP
Update `bulsu-admin/src/EmergencyManager.js` send notification function:

```javascript
const sendNotification = async () => {
  if (!notificationTitle.trim()) {
    alert('Enter a notification title');
    return;
  }

  setSending(true);
  try {
    // Send via Expo Push Service
    const message = {
      to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', // Or use topic
      sound: 'default',
      title: notificationTitle,
      body: notificationMessage,
      data: { type: 'emergency' },
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.data?.status === 'ok') {
      // Save to Firestore for history
      await addDoc(collection(db, 'notifications'), {
        title: notificationTitle,
        body: notificationMessage,
        type: 'emergency',
        timestamp: new Date(),
        sentBy: 'admin',
      });

      alert('Notification sent successfully!');
      setNotificationTitle('');
      setNotificationMessage('');
      setShowNotificationModal(false);
    } else {
      throw new Error(result.data?.message || 'Failed to send');
    }
  } catch (error) {
    console.error('Send notification error:', error);
    alert('Failed to send notification');
  } finally {
    setSending(false);
  }
};
```

### Step 6: Testing FCM
1. Run mobile app: `npx expo start`
2. Open app on physical device (required for notifications)
3. Check console for: `Push token: ExponentPushToken[...]`
4. Copy this token
5. In admin site, paste token in send notification function
6. Send test notification
7. Should receive push on device

### Alternative: Firebase Cloud Functions (Production)
For production, use Firebase Cloud Functions to send to all users:

```bash
cd functions
npm install firebase-functions firebase-admin
```

Create `functions/index.js`:
```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendEmergencyAlert = functions.https.onCall(async (data, context) => {
  const { title, body } = data;
  
  // Get all user tokens from Firestore
  const tokensSnapshot = await admin.firestore().collection('userTokens').get();
  const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
  
  // Send to all tokens
  const message = {
    notification: { title, body },
    tokens: tokens,
  };
  
  const response = await admin.messaging().sendMulticast(message);
  console.log(`${response.successCount} messages sent successfully`);
  
  return { success: true, sent: response.successCount };
});
```

Deploy: `firebase deploy --only functions`

---

## 🚀 Running the Applications

### Admin Site
```bash
cd bulsu-admin
npm install
npm start
```
- Opens at `http://localhost:3000`
- Login: `admin` / `bulsuadmin123`

### Mobile App (Development)
```bash
cd around-bulsu
npm install
npx expo start
```
- Scan QR code with Expo Go app (iOS/Android)
- Or press `a` for Android emulator / `i` for iOS simulator

### Mobile App (Production Build)
```bash
cd around-bulsu

# Android APK
eas build --platform android --profile preview

# Android App Bundle (for Play Store)
eas build --platform android --profile production

# iOS (requires Apple Developer account)
eas build --platform ios --profile production
```

---

## 🔧 Troubleshooting

### "Firebase not configured"
- Check `firebase.js` has correct config from Firebase Console
- Ensure `firebaseConfig` object has all fields

### "Permission denied" in Firestore
- Update security rules in Firebase Console → Firestore → Rules
- For testing, use: `allow read, write: if true;`

### Notifications not received
- Test on **real device** (emulator doesn't support push)
- Check device notification permissions
- Verify Expo Push Token is valid
- Check Firebase Cloud Messaging is enabled

### Admin login not working
- Verify credentials in `bulsu-admin/src/Login.js`
- Clear browser localStorage: `localStorage.clear()`
- Check browser console for errors

---

## 📝 Next Steps
1. ✅ Update Firebase config in both apps
2. ✅ Test admin site at `localhost:3000`
3. ✅ Test mobile app with `expo start`
4. ✅ Add sample buildings/nodes via admin site
5. ✅ Test navigation on real device
6. ⚠️ Set up FCM for push notifications (optional)
7. ⚠️ Deploy admin site to hosting (Vercel/Netlify)
8. ⚠️ Build production APK for distribution

**Ready to go! 🎉**
