# AI Coding Agent Instructions for ARound BulSU

## Big picture
- Dual-app system sharing Supabase (Postgres + Realtime + Storage).
  - Mobile app: around-bulsu/ (Expo React Native with AR navigation).
  - Admin app: bulsu-admin/ (Create React App for campus data management).
- Shared data model is Supabase tables: `buildings`, `nodes`, `edges`, `evacuationZones`, `blockages`, `emergencyContacts`, `announcements`, `notifications`.
- Buildings store `latitude`/`longitude`, while routing uses a separate node/edge graph; blockages filter edges before pathfinding.

## Key directories and examples
- Mobile screens: around-bulsu/src/screens/ (e.g., NavigateScreen, EmergencyScreen, ARNavigationScreen).
- Mobile components: around-bulsu/src/components/ (e.g., SearchBottomSheet).
- Admin panels: bulsu-admin/src/ (MapEditor, BuildingManager, EmergencyManager, ContactsManager, AnnouncementsManager).
- Main navigators and drawer: around-bulsu/App.js.

## Data/geo conventions (important)
- Mapbox uses [lng, lat] arrays; Supabase `buildings` rows use separate `longitude`/`latitude` fields.
- Polygons are arrays of `{lng, lat}` objects; the UI visually closes the polygon by connecting first/last point.
- When navigating, screens pass params like `building`, `userLocation`, `nodes`, `edges` (see NavigateScreen → BuildingInfo).

## Realtime patterns
- Supabase realtime uses `subscribeToTable` helper (see around-bulsu/src/supabase.js, bulsu-admin/src/supabase.js); always return the unsubscribe function from effects.
- Blockage-aware routing filters edges against active blockages before A* (see EmergencyScreen).

## External integrations
- Supabase config lives in around-bulsu/src/supabase.js and bulsu-admin/src/supabase.js; migration/setup steps in SUPABASE_SETUP.md.
- Mapbox tokens are hardcoded in each map screen (not env-based).
- AR features require a physical device (camera/sensors); emulators won’t work.
- FCM is partially wired; UI exists in EmergencyManager and Notifications screen, but setup is in SETUP_GUIDE.

## Dev workflows
- Mobile dev: run in around-bulsu/ with `npm install` then `npx expo start`.
- Admin dev: run in bulsu-admin/ with `npm install` then `npm start`.
- Supabase setup (schema, realtime, storage) is documented in SUPABASE_SETUP.md at repo root.

