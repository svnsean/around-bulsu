# AI Coding Agent Instructions for Around BULSU

## Project Vision
**ARound BulSU**: Campus AR navigation app for Bulacan State University Main Campus with companion admin site.

## Architecture Overview
Dual-app system sharing Firebase Firestore (`around-bulsu-backend`):
- **around-bulsu/**: Expo React Native mobile app with AR navigation (expo-camera + Three.js)
- **bulsu-admin/**: Create React App admin dashboard for managing campus data

### Firestore Collections
| Collection | Schema | Purpose |
|------------|--------|---------|
| `buildings` | `{name, description, latitude, longitude, rooms[], images[]}` | Building pins & info |
| `nodes` | `{lng, lat}` | Navigation graph vertices |
| `edges` | `{from, to, weight}` | A* pathfinding connections |
| `evacuationZones` | `{name, points[{lng, lat}], color}` | Polygon safe zones |
| `blockages` | `{name, points[{lng, lat}], active, createdAt}` | Route obstacles (polygon) |
| `emergencyContacts` | `{name, phone, category, order}` | Admin-managed contacts |
| `announcements` | `{title, body, imageUrl?, createdAt, active}` | Important campus info |
| `notifications` | `{title, body, type, timestamp, sentBy}` | Push notification history |

**Critical**: Buildings have coordinates; nodes/edges form a *separate* navigation mesh for A* routing. Blockages affect edge traversal in real-time.

## Implementation Status

### Mobile App (around-bulsu/)
| Feature | Status | File(s) |
|---------|--------|---------|
| Splash + permissions | ✅ Done | `SplashScreen.js` |
| Navigate tab + map | ✅ Done | `NavigateScreen.js` |
| Building markers | ✅ Done | `NavigateScreen.js` |
| Search bottom sheet | ✅ Done | `SearchBottomSheet.js` |
| Room search | ✅ Done | `SearchBottomSheet.js` |
| Building info page | ✅ Done | `BuildingInfoScreen.js` |
| AR navigation view | ✅ Done | `ARNavigationScreen.js` |
| Map in AR (pull-up) | ✅ Done | `ARNavigationScreen.js` |
| "Arrived" screen | ✅ Done | `ARNavigationScreen.js` |
| Outside campus warning | ✅ Done | `NavigateScreen.js` |
| Emergency tab | ✅ Done | `EmergencyScreen.js` |
| Info tab | ✅ Done | `InfoScreen.js` |
| Menu button (☰) | ✅ Done | `NavigateScreen.js`, `App.js` |
| Drawer navigation | ✅ Done | `App.js` |
| Settings screen | ✅ Done | `App.js` (inline) |
| Notifications screen | ✅ Done | `App.js` (inline) |
| Blockage-aware routing | ✅ Done | `EmergencyScreen.js` |
| FCM push notifications | ⚠️ Partial | UI ready, needs FCM setup |

### Admin Site (bulsu-admin/)
| Feature | Status | File(s) |
|---------|--------|---------|
| Login page | ✅ Done (Hardcoded) | `Login.js` |
| Map Editor tab | ✅ Done | `MapEditor.js` |
| Add/delete nodes | ✅ Done | `MapEditor.js` |
| Connect nodes (edges) | ✅ Done | `MapEditor.js` |
| Add building pins | ✅ Done | `MapEditor.js` |
| Show/hide nodes toggle | ✅ Done | `MapEditor.js` |
| Search buildings/rooms | ✅ Done | `MapEditor.js` |
| Buildings tab | ✅ Done | `BuildingManager.js` |
| Edit building + rooms | ✅ Done | `BuildingManager.js` |
| Emergency tab | ✅ Done | `EmergencyManager.js` |
| Evacuation zones (polygon) | ✅ Done | `EmergencyManager.js` |
| Blockage areas (polygon) | ✅ Done | `EmergencyManager.js` |
| Push notifications (FCM) | ⚠️ Partial | UI ready in `EmergencyManager.js` |
| Emergency contacts CRUD | ✅ Done | `ContactsManager.js` |
| Announcements manager | ✅ Done | `AnnouncementsManager.js` |
| Image upload (announcements) | ✅ Done | `AnnouncementsManager.js` |
| Split edge (node in middle) | ❌ TODO | — |
| Settings page | ❌ TODO | — |

## Development Phases (All Core Features Complete)

### Phase 1: Foundation (Admin Auth + Schema) ✅
1. ✅ Hardcoded admin login (admin/bulsuadmin123) in `Login.js`
2. ✅ Updated `firebase.js` with Firestore + Storage exports
3. ⚠️ Firestore security rules (see `SETUP_GUIDE.md`)

### Phase 2: Admin Emergency Features ✅
1. ✅ Added Emergency tab to AdminPanel sidebar
2. ✅ **Evacuation Zones**: Polygon drawing tool with green color
3. ✅ **Blockages**: Polygon tool with red color, active/inactive toggle
4. ⚠️ **Push Notifications**: UI ready, see `SETUP_GUIDE.md` for FCM setup

### Phase 3: Admin Content Management ✅
1. ✅ **Emergency Contacts**: Full CRUD with categories
2. ✅ **Announcements**: Create/edit with image upload to Firebase Storage
3. ⚠️ Building images upload (can use same pattern as announcements)

### Phase 4: Mobile Emergency Tab ✅
1. ✅ Map showing evacuation zone polygons (green)
2. ✅ Blockage polygons displayed (red)
3. ✅ "Activate Evacuation" → nearest zone → AR navigation
4. ✅ Cancel returns to Navigate tab
5. ✅ Campus bounds check

### Phase 5: Mobile Info Tab ✅
1. ✅ Emergency contacts list with call button
2. ✅ Buildings list from Firestore
3. ✅ Announcements feed with images

### Phase 6: Mobile Menu & Notifications ✅
1. ✅ Drawer menu (☰ top-left on NavigateScreen)
2. ✅ Notifications screen (placeholder for FCM messages)
3. ✅ Settings screen with notification toggle and about section

## Commands
```bash
# Mobile (around-bulsu/)
npm install && npx expo start        # Dev server
npx expo run:android                 # Native build

# Admin (bulsu-admin/)
npm install && npm start             # localhost:3000
```

## Key Patterns

### Firestore Listeners (Always cleanup)
```javascript
useEffect(() => {
  const unsub = onSnapshot(collection(db, 'buildings'), (snap) => 
    setBuildings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
  return () => unsub();  // CRITICAL: prevent memory leaks
}, []);
```

### Navigation Params (Mobile)
```javascript
navigation.navigate('BuildingInfo', { building, userLocation, nodes, edges });
// In target: const { building, userLocation, nodes, edges } = route.params;
```

### Coordinate Convention
- **Mapbox**: `[lng, lat]` array order
- **Firestore buildings**: separate `latitude`, `longitude` fields
- **Polygons**: array of `{lng, lat}` objects
- Convert carefully: `[building.longitude, building.latitude]`

### Polygon Drawing (Admin)
```javascript
// Store points as array of {lng, lat} objects
const [polygonPoints, setPolygonPoints] = useState([]);
const handleMapClick = (e) => {
  setPolygonPoints([...polygonPoints, { lng: e.lngLat.lng, lat: e.lngLat.lat }]);
};
// Save: await addDoc(collection(db, 'evacuationZones'), { name, points: polygonPoints });
```

### Blockage-Aware A* Routing
```javascript
// Filter edges that pass through active blockages before pathfinding
const activeBlockages = blockages.filter(b => b.active);
const validEdges = edges.filter(edge => !isEdgeBlocked(edge, activeBlockages, nodes));
// Then run A* on validEdges
```

## File Structure
- `around-bulsu/src/screens/*.js` — Full screens (NavigateScreen, EmergencyScreen, InfoScreen, ARNavigationScreen, BuildingInfoScreen, SplashScreen)
- `around-bulsu/src/components/*.js` — Reusable UI (SearchBottomSheet)
- `around-bulsu/App.js` — Main app with Drawer + Tab navigation, Settings & Notifications screens
- `bulsu-admin/src/*.js` — Admin panels (MapEditor, BuildingManager, EmergencyManager, ContactsManager, AnnouncementsManager)
- `bulsu-admin/src/AdminPanel.js` — Main admin layout with sidebar navigation
- `*/src/firebase.js` — Firebase config (exports db, auth, storage)

## Gotchas
1. **Mapbox token** hardcoded in each screen file (not env var)
2. **AR requires real device** — emulator has no camera/sensors
3. **No state management library** — local useState + Firestore onSnapshot for real-time sync
4. **Campus boundary** defined in `NavigateScreen.js` and `EmergencyScreen.js` (bounds object)
5. **FCM requires** `expo-notifications` + setup (see `SETUP_GUIDE.md`)
6. **Polygon closing** — polygons auto-close visually (first/last point connected)
7. **Admin credentials** — Hardcoded as `admin` / `bulsuadmin123` in `Login.js`
8. **Drawer navigation** — requires `@react-navigation/drawer` package

## External Dependencies
- Mobile: `@rnmapbox/maps`, `expo-camera`, `expo-gl`, `@react-three/fiber`, `@react-three/drei`, `three`, `expo-location`, `expo-sensors`, `@react-navigation/drawer`, `react-native-gesture-handler`
- Admin: `react-map-gl`, `mapbox-gl`, `lucide-react`
- Shared: `firebase` (Firestore, Storage)

## Quick Start
See [`SETUP_GUIDE.md`](../SETUP_GUIDE.md) for complete setup instructions including:
- Admin login credentials
- Firebase configuration
- FCM push notifications setup
- Running the apps

