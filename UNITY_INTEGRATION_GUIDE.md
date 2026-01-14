# Unity as a Library Integration Guide for ARound BulSU

## Overview

This guide explains how to integrate Unity as a Library (UaaL) into your React Native Expo app for true 3D AR navigation.

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native (Expo)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Navigate │  │Emergency │  │   Info   │  │ Settings │    │
│  │   Tab    │  │   Tab    │  │   Tab    │  │          │    │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘    │
│       │                                                      │
│       │ User selects destination                             │
│       │ Taps "Start Navigate"                                │
│       ▼                                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Native Module Bridge                     │   │
│  │         (UnityBridge.java / .kt)                     │   │
│  └────────────────────────┬─────────────────────────────┘   │
│                           │                                  │
│                           │ Launch Unity with parameters     │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               Unity AR Activity                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │            Unity AR Scene                       │  │   │
│  │  │  • Camera + AR Background                       │  │   │
│  │  │  • GPS-anchored 3D Arrow                        │  │   │
│  │  │  • 3D Building markers                          │  │   │
│  │  │  • Turn signs                                   │  │   │
│  │  │  • Navigation path visualization               │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  ReactNativeBridge.cs ←→ Unity Message System        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Unity 2022.3 LTS** or newer (with Android Build Support)
- **Android Studio** (for native bridging)
- **React Native CLI** (we'll need to eject from Expo or use a development build)
- Basic understanding of:
  - Unity C# scripting
  - Android Java/Kotlin
  - React Native Native Modules

---

## Phase 1: Unity Project Setup (Day 1-2)

### Step 1.1: Create Unity Project

```
1. Open Unity Hub
2. New Project → 3D (URP) Template
3. Name: "BulsuARNavigation"
4. Location: C:\Users\seana\OneDrive\Desktop\apps\
```

### Step 1.2: Install AR Foundation

```
Window → Package Manager → Unity Registry:
- AR Foundation (5.1.x)
- ARCore XR Plugin (5.1.x)
- XR Plugin Management
```

### Step 1.3: Configure Project for Android

```
Edit → Project Settings → Player:
- Company Name: BulsuDev
- Product Name: ARound BulSU AR
- Package Name: com.bulsu.arnavigation.unity

Edit → Project Settings → XR Plug-in Management:
- ✅ ARCore (Android tab)

Edit → Project Settings → Player → Android:
- Minimum API Level: 26 (Android 8.0)
- Target API Level: 33+
- Scripting Backend: IL2CPP
- Target Architectures: ARM64
```

### Step 1.4: Project Folder Structure

Create this structure in Unity:

```
Assets/
├── Scenes/
│   └── ARNavScene.unity
├── Scripts/
│   ├── Core/
│   │   ├── ARNavigationController.cs
│   │   ├── GPSManager.cs
│   │   └── CompassManager.cs
│   ├── AR/
│   │   ├── GPSAnchor.cs
│   │   └── ARObjectPlacer.cs
│   ├── UI/
│   │   ├── NavigationHUD.cs
│   │   └── TurnIndicator.cs
│   └── Bridge/
│       └── ReactNativeBridge.cs
├── Prefabs/
│   ├── 3DArrow.prefab
│   ├── DestinationMarker.prefab
│   ├── TurnSign.prefab
│   └── WaypointMarker.prefab
├── Materials/
│   ├── ArrowMaterial.mat
│   ├── GlowMaterial.mat
│   └── HologramMaterial.mat
└── Shaders/
    └── AROverlay.shader
```

---

## Phase 2: Unity AR Implementation (Day 2-4)

### Step 2.1: Main Scene Setup

Create `ARNavScene.unity` with:

```
Hierarchy:
├── AR Session
├── AR Session Origin
│   ├── AR Camera
│   └── AR Object Container (empty)
├── Navigation Manager (empty)
├── UI Canvas
│   ├── HUD Panel
│   ├── Distance Text
│   └── Turn Indicator
└── Directional Light
```

### Step 2.2: GPSManager.cs

```csharp
// Assets/Scripts/Core/GPSManager.cs
using UnityEngine;
using System;
using System.Collections;

public class GPSManager : MonoBehaviour
{
    public static GPSManager Instance { get; private set; }
    
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }
    public float Accuracy { get; private set; }
    public bool IsReady { get; private set; }
    
    public event Action<double, double> OnLocationUpdated;
    
    void Awake()
    {
        Instance = this;
    }
    
    public IEnumerator StartGPS()
    {
        // Check if location service is enabled
        if (!Input.location.isEnabledByUser)
        {
            Debug.LogError("GPS not enabled");
            yield break;
        }
        
        // Start location service
        Input.location.Start(1f, 1f); // High accuracy
        
        int maxWait = 20;
        while (Input.location.status == LocationServiceStatus.Initializing && maxWait > 0)
        {
            yield return new WaitForSeconds(1);
            maxWait--;
        }
        
        if (Input.location.status == LocationServiceStatus.Running)
        {
            IsReady = true;
            StartCoroutine(UpdateLoop());
        }
    }
    
    IEnumerator UpdateLoop()
    {
        while (true)
        {
            Latitude = Input.location.lastData.latitude;
            Longitude = Input.location.lastData.longitude;
            Accuracy = Input.location.lastData.horizontalAccuracy;
            
            OnLocationUpdated?.Invoke(Latitude, Longitude);
            
            yield return new WaitForSeconds(0.5f);
        }
    }
    
    // Haversine distance calculation
    public static double GetDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371e3; // Earth radius in meters
        double p1 = lat1 * Mathf.Deg2Rad;
        double p2 = lat2 * Mathf.Deg2Rad;
        double dp = (lat2 - lat1) * Mathf.Deg2Rad;
        double dl = (lon2 - lon1) * Mathf.Deg2Rad;
        
        double a = Math.Sin(dp / 2) * Math.Sin(dp / 2) +
                   Math.Cos(p1) * Math.Cos(p2) *
                   Math.Sin(dl / 2) * Math.Sin(dl / 2);
        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        
        return R * c;
    }
    
    // Bearing calculation
    public static double GetBearing(double lat1, double lon1, double lat2, double lon2)
    {
        double p1 = lat1 * Mathf.Deg2Rad;
        double p2 = lat2 * Mathf.Deg2Rad;
        double dl = (lon2 - lon1) * Mathf.Deg2Rad;
        
        double y = Math.Sin(dl) * Math.Cos(p2);
        double x = Math.Cos(p1) * Math.Sin(p2) - Math.Sin(p1) * Math.Cos(p2) * Math.Cos(dl);
        double bearing = Math.Atan2(y, x) * Mathf.Rad2Deg;
        
        return (bearing + 360) % 360;
    }
}
```

### Step 2.3: GPSAnchor.cs

```csharp
// Assets/Scripts/AR/GPSAnchor.cs
using UnityEngine;

public class GPSAnchor : MonoBehaviour
{
    [Header("GPS Target")]
    public double targetLatitude;
    public double targetLongitude;
    
    [Header("Settings")]
    public float maxRenderDistance = 200f;
    public float scaleFalloffStart = 50f;
    public float minScale = 0.3f;
    
    private Camera arCamera;
    private CompassManager compass;
    
    void Start()
    {
        arCamera = Camera.main;
        compass = CompassManager.Instance;
    }
    
    void Update()
    {
        if (!GPSManager.Instance.IsReady) return;
        
        double userLat = GPSManager.Instance.Latitude;
        double userLon = GPSManager.Instance.Longitude;
        
        // Calculate distance and bearing
        double distance = GPSManager.GetDistance(userLat, userLon, targetLatitude, targetLongitude);
        double bearing = GPSManager.GetBearing(userLat, userLon, targetLatitude, targetLongitude);
        
        // Calculate relative angle
        float compassHeading = compass.TrueHeading;
        float relativeAngle = (float)(bearing - compassHeading);
        
        // Position in world space (relative to camera)
        float distanceMeters = Mathf.Min((float)distance, maxRenderDistance);
        float angleRad = relativeAngle * Mathf.Deg2Rad;
        
        Vector3 direction = new Vector3(
            Mathf.Sin(angleRad),
            0,
            Mathf.Cos(angleRad)
        );
        
        // Position object at calculated direction from camera
        transform.position = arCamera.transform.position + direction * Mathf.Min(distanceMeters, 30f);
        
        // Scale based on distance
        float scale = 1f;
        if (distance > scaleFalloffStart)
        {
            float falloff = Mathf.InverseLerp(scaleFalloffStart, maxRenderDistance, (float)distance);
            scale = Mathf.Lerp(1f, minScale, falloff);
        }
        transform.localScale = Vector3.one * scale;
        
        // Face camera (billboarding)
        transform.LookAt(arCamera.transform);
        transform.Rotate(0, 180, 0);
        
        // Hide if too far
        gameObject.SetActive(distance <= maxRenderDistance);
    }
    
    public void SetTarget(double lat, double lon)
    {
        targetLatitude = lat;
        targetLongitude = lon;
    }
}
```

### Step 2.4: ARNavigationController.cs

```csharp
// Assets/Scripts/Core/ARNavigationController.cs
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using System.Collections.Generic;

public class ARNavigationController : MonoBehaviour
{
    public static ARNavigationController Instance { get; private set; }
    
    [Header("AR Components")]
    public ARSession arSession;
    public ARSessionOrigin arSessionOrigin;
    
    [Header("Prefabs")]
    public GameObject arrowPrefab;
    public GameObject destinationMarkerPrefab;
    public GameObject waypointPrefab;
    public GameObject turnSignPrefab;
    
    [Header("Navigation Data")]
    private NavigationData currentNavData;
    private GameObject arrowInstance;
    private GameObject destinationInstance;
    private List<GameObject> waypointInstances = new List<GameObject>();
    
    void Awake()
    {
        Instance = this;
    }
    
    void Start()
    {
        StartCoroutine(GPSManager.Instance.StartGPS());
        StartCoroutine(CompassManager.Instance.StartCompass());
    }
    
    // Called from React Native
    public void StartNavigation(string jsonData)
    {
        currentNavData = JsonUtility.FromJson<NavigationData>(jsonData);
        
        // Create AR elements
        CreateNavigationElements();
    }
    
    void CreateNavigationElements()
    {
        // Create main arrow (always visible, points to next waypoint)
        arrowInstance = Instantiate(arrowPrefab);
        var arrowController = arrowInstance.AddComponent<ARArrowController>();
        
        // Create destination marker
        destinationInstance = Instantiate(destinationMarkerPrefab);
        var destAnchor = destinationInstance.AddComponent<GPSAnchor>();
        destAnchor.SetTarget(currentNavData.destLat, currentNavData.destLon);
        
        // Create waypoint markers
        foreach (var waypoint in currentNavData.pathNodes)
        {
            var wpObj = Instantiate(waypointPrefab);
            var wpAnchor = wpObj.AddComponent<GPSAnchor>();
            wpAnchor.SetTarget(waypoint.lat, waypoint.lng);
            waypointInstances.Add(wpObj);
        }
    }
    
    public void StopNavigation()
    {
        // Cleanup
        if (arrowInstance) Destroy(arrowInstance);
        if (destinationInstance) Destroy(destinationInstance);
        foreach (var wp in waypointInstances) Destroy(wp);
        waypointInstances.Clear();
        
        // Notify React Native
        ReactNativeBridge.SendMessage("NavigationStopped", "");
    }
    
    void Update()
    {
        if (currentNavData == null) return;
        
        // Check arrival
        double distance = GPSManager.GetDistance(
            GPSManager.Instance.Latitude,
            GPSManager.Instance.Longitude,
            currentNavData.destLat,
            currentNavData.destLon
        );
        
        if (distance < 15)
        {
            OnArrived();
        }
    }
    
    void OnArrived()
    {
        ReactNativeBridge.SendMessage("Arrived", currentNavData.buildingName);
        StopNavigation();
    }
}

[System.Serializable]
public class NavigationData
{
    public string buildingName;
    public double destLat;
    public double destLon;
    public PathNode[] pathNodes;
}

[System.Serializable]
public class PathNode
{
    public double lat;
    public double lng;
}
```

### Step 2.5: ReactNativeBridge.cs

```csharp
// Assets/Scripts/Bridge/ReactNativeBridge.cs
using UnityEngine;

public class ReactNativeBridge : MonoBehaviour
{
    public static ReactNativeBridge Instance { get; private set; }
    
    void Awake()
    {
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }
    
    // Called FROM React Native (via Android native code)
    public void ReceiveMessage(string message)
    {
        Debug.Log($"[Unity] Received from RN: {message}");
        
        // Parse JSON message
        var data = JsonUtility.FromJson<BridgeMessage>(message);
        
        switch (data.action)
        {
            case "startNavigation":
                ARNavigationController.Instance.StartNavigation(data.payload);
                break;
            case "stopNavigation":
                ARNavigationController.Instance.StopNavigation();
                break;
            case "updateLocation":
                // Handle location updates from RN if needed
                break;
        }
    }
    
    // Send message TO React Native
    public static void SendMessage(string action, string payload)
    {
        string message = JsonUtility.ToJson(new BridgeMessage { action = action, payload = payload });
        
        #if UNITY_ANDROID && !UNITY_EDITOR
        using (AndroidJavaClass jc = new AndroidJavaClass("com.bulsu.aroundbulsu.UnityBridge"))
        {
            jc.CallStatic("sendToReactNative", message);
        }
        #endif
        
        Debug.Log($"[Unity] Sent to RN: {message}");
    }
}

[System.Serializable]
public class BridgeMessage
{
    public string action;
    public string payload;
}
```

---

## Phase 3: Export Unity as Library (Day 4-5)

### Step 3.1: Configure Export Settings

```
File → Build Settings:
- Platform: Android
- Export Project: ✅ (IMPORTANT!)
- Build System: Gradle

Player Settings → Other Settings:
- Scripting Backend: IL2CPP
- API Compatibility Level: .NET Standard 2.1
```

### Step 3.2: Export Unity Project

```
1. Build Settings → Export
2. Choose folder: C:\Users\seana\OneDrive\Desktop\apps\around-bulsu\unity-export
3. Wait for export to complete
```

This creates:

```
unity-export/
├── unityLibrary/           ← This is what we need!
│   ├── build.gradle
│   ├── libs/
│   ├── src/
│   └── ...
├── launcher/
├── gradle/
└── build.gradle
```

---

## Phase 4: React Native Integration (Day 5-7)

### Step 4.1: Eject from Expo (if using managed workflow)

If you're using Expo managed workflow, you need a development build:

```bash
cd around-bulsu
npx expo prebuild --platform android
```

This creates the `android/` folder with native code.

### Step 4.2: Add Unity Library to Android Project

1. Copy `unityLibrary` folder:

```
around-bulsu/
├── android/
│   ├── app/
│   └── unityLibrary/    ← Paste here
```

2. Modify `android/settings.gradle`:

```gradle
// Add at the end
include ':unityLibrary'
project(':unityLibrary').projectDir = new File(rootProject.projectDir, './unityLibrary')
```

3. Modify `android/app/build.gradle`:

```gradle
dependencies {
    // ... existing deps
    implementation project(':unityLibrary')
}
```

4. Modify `android/build.gradle` (project level):

```gradle
allprojects {
    repositories {
        // ... existing
        flatDir {
            dirs "${project(':unityLibrary').projectDir}/libs"
        }
    }
}
```

### Step 4.3: Create Native Module (UnityBridge.java)

Create `android/app/src/main/java/com/aroundbulsu/UnityBridge.java`:

```java
package com.aroundbulsu;

import android.app.Activity;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.unity3d.player.UnityPlayer;
import org.json.JSONObject;

public class UnityBridge extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContext;
    
    UnityBridge(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }
    
    @Override
    public String getName() {
        return "UnityBridge";
    }
    
    @ReactMethod
    public void startARNavigation(String navigationJson, Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity");
            return;
        }
        
        try {
            // Launch Unity Activity
            Intent intent = new Intent(activity, UnityARActivity.class);
            intent.putExtra("navigationData", navigationJson);
            activity.startActivity(intent);
            
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("UNITY_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void stopARNavigation() {
        sendToUnity("stopNavigation", "");
    }
    
    private void sendToUnity(String action, String payload) {
        try {
            JSONObject message = new JSONObject();
            message.put("action", action);
            message.put("payload", payload);
            
            UnityPlayer.UnitySendMessage("ReactNativeBridge", "ReceiveMessage", message.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    // Called from Unity (static for Unity to access)
    public static void sendToReactNative(String message) {
        if (reactContext != null) {
            new Handler(Looper.getMainLooper()).post(() -> {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("UnityMessage", message);
            });
        }
    }
}
```

### Step 4.4: Create Unity Activity

Create `android/app/src/main/java/com/aroundbulsu/UnityARActivity.java`:

```java
package com.aroundbulsu;

import android.os.Bundle;
import com.unity3d.player.UnityPlayerActivity;
import com.unity3d.player.UnityPlayer;
import org.json.JSONObject;

public class UnityARActivity extends UnityPlayerActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Get navigation data from intent
        String navigationData = getIntent().getStringExtra("navigationData");
        
        if (navigationData != null) {
            // Send to Unity after it initializes
            new android.os.Handler().postDelayed(() -> {
                try {
                    JSONObject message = new JSONObject();
                    message.put("action", "startNavigation");
                    message.put("payload", navigationData);
                    
                    UnityPlayer.UnitySendMessage(
                        "ReactNativeBridge", 
                        "ReceiveMessage", 
                        message.toString()
                    );
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }, 1000);
        }
    }
    
    @Override
    public void onBackPressed() {
        // Return to React Native
        finish();
    }
}
```

### Step 4.5: Register Native Module

Create `android/app/src/main/java/com/aroundbulsu/UnityBridgePackage.java`:

```java
package com.aroundbulsu;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class UnityBridgePackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new UnityBridge(reactContext));
        return modules;
    }
    
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
```

Add to `MainApplication.java`:

```java
@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    packages.add(new UnityBridgePackage()); // Add this
    return packages;
}
```

### Step 4.6: Add Unity Activity to Manifest

In `android/app/src/main/AndroidManifest.xml`:

```xml
<activity
    android:name=".UnityARActivity"
    android:label="AR Navigation"
    android:screenOrientation="portrait"
    android:launchMode="singleTask"
    android:configChanges="mcc|mnc|locale|touchscreen|keyboard|keyboardHidden|navigation|orientation|screenLayout|uiMode|screenSize|smallestScreenSize|fontScale|layoutDirection|density"
    android:hardwareAccelerated="true"
    android:process=":Unity">
</activity>
```

---

## Phase 5: React Native Usage (Day 7-8)

### Step 5.1: Create TypeScript Bindings

Create `src/native/UnityBridge.ts`:

```typescript
import { NativeModules, NativeEventEmitter } from 'react-native';

const { UnityBridge } = NativeModules;
const eventEmitter = new NativeEventEmitter(UnityBridge);

export interface NavigationData {
  buildingName: string;
  destLat: number;
  destLon: number;
  pathNodes: Array<{ lat: number; lng: number }>;
}

export const startARNavigation = async (data: NavigationData): Promise<boolean> => {
  return await UnityBridge.startARNavigation(JSON.stringify(data));
};

export const stopARNavigation = (): void => {
  UnityBridge.stopARNavigation();
};

export const onUnityMessage = (callback: (message: string) => void) => {
  return eventEmitter.addListener('UnityMessage', callback);
};
```

### Step 5.2: Use in BuildingInfoScreen.js

```javascript
import { startARNavigation, onUnityMessage } from '../native/UnityBridge';

// In your navigation handler:
const handleStartNavigation = async () => {
  const navData = {
    buildingName: building.name,
    destLat: building.latitude,
    destLon: building.longitude,
    pathNodes: pathNodes.map(n => ({ lat: n.lat, lng: n.lng })),
  };
  
  // Listen for Unity messages
  const subscription = onUnityMessage((message) => {
    const data = JSON.parse(message);
    if (data.action === 'Arrived') {
      // Handle arrival
      navigation.navigate('Navigate');
    }
  });
  
  try {
    await startARNavigation(navData);
  } catch (error) {
    console.error('Failed to start AR:', error);
    // Fallback to React Native AR
    navigation.navigate('ARNavigation', { building, userLocation, nodes, edges });
  }
  
  return () => subscription.remove();
};
```

---

## Phase 6: 3D Assets in Unity (Day 8-10)

### 3D Arrow Design

```
Create in Unity:
1. Cylinder body (stretched)
2. Cone head
3. Emission material for glow
4. Particle system for trail
5. Animator for floating motion
```

### Turn Signs

```
Create prefab with:
1. Rounded rectangle mesh
2. Arrow icon (plane with texture)
3. Text Mesh Pro for distance
4. Glow effect shader
```

### Building Marker

```
Create prefab with:
1. Vertical beam (cylinder, emission)
2. Floating diamond/pin (custom mesh)
3. World space canvas for name
4. Particle ring effect
```

---

## Timeline Summary

| Day | Task | Hours |
|-----|------|-------|
| 1-2 | Unity project setup, AR Foundation | 8h |
| 2-4 | GPS/Compass scripts, GPSAnchor | 12h |
| 4-5 | Export Unity, configure Gradle | 6h |
| 5-7 | Native Module bridge | 10h |
| 7-8 | React Native integration | 6h |
| 8-10 | 3D assets, polish | 12h |
| **Total** | | **~54h** |

---

## Potential Issues & Solutions

### Issue 1: Unity crashes on launch
**Solution**: Check that IL2CPP is properly configured and all plugins are ARM64 compatible.

### Issue 2: GPS not updating
**Solution**: Ensure location permissions in both AndroidManifest.xml and Unity's Player Settings.

### Issue 3: AR objects floating wrong position
**Solution**: Calibrate compass offset, check GPS accuracy, verify coordinate math.

### Issue 4: Memory issues
**Solution**: Unity runs in separate process (`:Unity`), but still share resources. Optimize textures and meshes.

### Issue 5: Expo compatibility
**Solution**: Must use Expo Dev Client or bare workflow. Managed workflow won't work.

---

## Alternative: Simpler Hybrid Approach

If full Unity integration is too complex, consider:

1. **Build Unity as standalone APK** for AR navigation
2. **Launch via Intent** from React Native
3. **Pass data via Intent extras**
4. **Use deep links** to return to React Native

This is simpler but less integrated.

---

## Files Checklist

### Unity Project
- [ ] GPSManager.cs
- [ ] CompassManager.cs
- [ ] GPSAnchor.cs
- [ ] ARNavigationController.cs
- [ ] ReactNativeBridge.cs
- [ ] 3D Arrow prefab
- [ ] Destination marker prefab
- [ ] Waypoint prefab
- [ ] Turn sign prefab

### Android Native
- [ ] UnityBridge.java
- [ ] UnityARActivity.java
- [ ] UnityBridgePackage.java
- [ ] AndroidManifest.xml updates
- [ ] build.gradle updates
- [ ] settings.gradle updates

### React Native
- [ ] UnityBridge.ts
- [ ] BuildingInfoScreen integration
- [ ] Fallback to RN AR

---

## Recommendation

Given your **3-week timeline** and **solo development**:

1. **Week 1**: Continue using enhanced React Native AR (already done!)
2. **Week 2**: Start Unity project, basic AR scene
3. **Week 3**: Integration attempt

**Fallback plan**: If Unity integration fails by mid-week 3, the React Native AR is your demo.

The enhanced React Native AR I just built for you is a solid foundation that looks professional and works reliably. Unity would be the "wow factor" upgrade, but it's high-risk with tight timeline.

---

## Next Steps

1. **Test the enhanced React Native AR** I just built
2. **If satisfied**: Focus on other thesis features
3. **If want Unity**: Start with Phase 1-2 this weekend
4. **Reach out** if you hit blockers with either approach

Good luck! 🎓
