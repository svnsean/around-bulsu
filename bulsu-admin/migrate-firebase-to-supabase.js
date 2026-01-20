/**
 * Firebase to Supabase Migration Script
 * 
 * This script exports data from Firebase Firestore and imports it to Supabase.
 * 
 * SETUP:
 * 1. Run: npm install firebase @supabase/supabase-js
 * 2. Update the Firebase and Supabase configs below
 * 3. Run: node migrate-firebase-to-supabase.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { createClient } = require('@supabase/supabase-js');

// =====================================================
// CONFIGURATION - UPDATE THESE VALUES
// =====================================================

// Firebase Config (from your Firebase project)
const firebaseConfig = {
  apiKey: "AIzaSyBgtYcktJtpX1gQ_TCVLn3u3Mo3PRqMr0U",
  authDomain: "around-bulsu-backend.firebaseapp.com",
  projectId: "around-bulsu-backend",
  storageBucket: "around-bulsu-backend.firebasestorage.app",
  messagingSenderId: "649098234000",
  appId: "1:649098234000:web:6b719f5f12eea5b7413015"
};

// Supabase Config (from your Supabase project)
const supabaseUrl = 'https://wcubybptmqnpfxvekmhv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjdWJ5YnB0bXFucGZ4dmVrbWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg2MTEsImV4cCI6MjA4NDA0NDYxMX0.rxa0Ir7iFKX_Ylzg2N2dSAsKtYG5vTsjP_g1QmdNQZs';

// =====================================================
// INITIALIZE CLIENTS
// =====================================================

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);
const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// MIGRATION FUNCTIONS
// =====================================================

// Store Firebase ID -> Supabase UUID mappings for edges
const nodeIdMap = new Map();

async function migrateCollection(firebaseCollection, supabaseTable, transform = (doc) => doc) {
  console.log(`\n📦 Migrating ${firebaseCollection} -> ${supabaseTable}...`);
  
  try {
    // Fetch from Firebase
    const snapshot = await getDocs(collection(firestore, firebaseCollection));
    const docs = snapshot.docs.map(doc => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
    
    console.log(`   Found ${docs.length} documents in Firebase`);
    
    if (docs.length === 0) {
      console.log(`   ⏭️  Skipping (no data)`);
      return { success: true, count: 0 };
    }
    
    // Transform data for Supabase
    const transformed = docs.map(doc => transform(doc));
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from(supabaseTable)
      .insert(transformed)
      .select();
    
    if (error) {
      console.error(`   ❌ Error:`, error.message);
      return { success: false, error: error.message };
    }
    
    console.log(`   ✅ Migrated ${data.length} records`);
    return { success: true, count: data.length, data };
  } catch (err) {
    console.error(`   ❌ Exception:`, err.message);
    return { success: false, error: err.message };
  }
}

async function migrateBuildings() {
  return migrateCollection('buildings', 'buildings', (doc) => ({
    name: doc.name || 'Unnamed Building',
    description: doc.description || '',
    latitude: doc.latitude || 0,
    longitude: doc.longitude || 0,
    rooms: doc.rooms || [],
    images: doc.images || []
  }));
}

async function migrateNodes() {
  console.log(`\n📦 Migrating nodes...`);
  
  try {
    const snapshot = await getDocs(collection(firestore, 'nodes'));
    const docs = snapshot.docs.map(doc => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
    
    console.log(`   Found ${docs.length} nodes in Firebase`);
    
    if (docs.length === 0) {
      console.log(`   ⏭️  Skipping (no data)`);
      return { success: true, count: 0 };
    }
    
    // Insert nodes and track ID mappings
    for (const doc of docs) {
      const { data, error } = await supabase
        .from('nodes')
        .insert({ lng: doc.lng || doc.longitude, lat: doc.lat || doc.latitude })
        .select()
        .single();
      
      if (error) {
        console.error(`   ❌ Error inserting node:`, error.message);
        continue;
      }
      
      // Store mapping: Firebase ID -> Supabase UUID
      nodeIdMap.set(doc.firebaseId, data.id);
    }
    
    console.log(`   ✅ Migrated ${nodeIdMap.size} nodes`);
    return { success: true, count: nodeIdMap.size };
  } catch (err) {
    console.error(`   ❌ Exception:`, err.message);
    return { success: false, error: err.message };
  }
}

async function migrateEdges() {
  console.log(`\n📦 Migrating edges...`);
  
  try {
    const snapshot = await getDocs(collection(firestore, 'edges'));
    const docs = snapshot.docs.map(doc => ({
      firebaseId: doc.id,
      ...doc.data()
    }));
    
    console.log(`   Found ${docs.length} edges in Firebase`);
    
    if (docs.length === 0) {
      console.log(`   ⏭️  Skipping (no data)`);
      return { success: true, count: 0 };
    }
    
    let migrated = 0;
    let skipped = 0;
    
    for (const doc of docs) {
      // Get the Firebase IDs (could be 'from'/'to' or 'from_node'/'to_node')
      const fromId = doc.from || doc.from_node;
      const toId = doc.to || doc.to_node;
      
      // Map to Supabase UUIDs
      const fromUUID = nodeIdMap.get(fromId);
      const toUUID = nodeIdMap.get(toId);
      
      if (!fromUUID || !toUUID) {
        console.log(`   ⚠️  Skipping edge: missing node mapping (from: ${fromId}, to: ${toId})`);
        skipped++;
        continue;
      }
      
      const { error } = await supabase
        .from('edges')
        .insert({
          from_node: fromUUID,
          to_node: toUUID,
          weight: doc.weight || 1.0
        });
      
      if (error) {
        console.error(`   ❌ Error inserting edge:`, error.message);
        skipped++;
        continue;
      }
      
      migrated++;
    }
    
    console.log(`   ✅ Migrated ${migrated} edges (skipped ${skipped})`);
    return { success: true, count: migrated };
  } catch (err) {
    console.error(`   ❌ Exception:`, err.message);
    return { success: false, error: err.message };
  }
}

async function migrateEvacuationZones() {
  return migrateCollection('evacuationZones', 'evacuation_zones', (doc) => ({
    name: doc.name || 'Unnamed Zone',
    points: doc.points || [],
    color: doc.color || '#22c55e'
  }));
}

async function migrateBlockages() {
  return migrateCollection('blockages', 'blockages', (doc) => ({
    name: doc.name || 'Unnamed Blockage',
    points: doc.points || [],
    active: doc.active !== false
  }));
}

async function migrateEmergencyContacts() {
  return migrateCollection('emergencyContacts', 'emergency_contacts', (doc) => ({
    name: doc.name || 'Unknown',
    phone: doc.phone || '',
    category: doc.category || 'emergency',
    order: doc.order || 0
  }));
}

async function migrateAnnouncements() {
  return migrateCollection('announcements', 'announcements', (doc) => ({
    title: doc.title || 'Untitled',
    body: doc.body || '',
    image_url: doc.imageUrl || doc.image_url || null,
    active: doc.active !== false,
    created_at: doc.createdAt?.toDate?.() || doc.created_at || new Date()
  }));
}

async function migrateNotifications() {
  return migrateCollection('notifications', 'notifications', (doc) => ({
    title: doc.title || 'Notification',
    body: doc.body || '',
    type: doc.type || 'general',
    sent_by: doc.sentBy || doc.sent_by || 'admin',
    created_at: doc.timestamp?.toDate?.() || doc.created_at || new Date()
  }));
}

// =====================================================
// MAIN MIGRATION
// =====================================================

async function runMigration() {
  console.log('🚀 Starting Firebase to Supabase Migration');
  console.log('==========================================\n');
  
  const results = {};
  
  // Migrate in order (nodes before edges due to foreign keys)
  results.buildings = await migrateBuildings();
  results.nodes = await migrateNodes();
  results.edges = await migrateEdges(); // Must be after nodes
  results.evacuationZones = await migrateEvacuationZones();
  results.blockages = await migrateBlockages();
  results.emergencyContacts = await migrateEmergencyContacts();
  results.announcements = await migrateAnnouncements();
  results.notifications = await migrateNotifications();
  
  // Summary
  console.log('\n==========================================');
  console.log('📊 MIGRATION SUMMARY');
  console.log('==========================================');
  
  let totalMigrated = 0;
  let hasErrors = false;
  
  for (const [table, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    const count = result.count || 0;
    console.log(`${status} ${table}: ${count} records`);
    totalMigrated += count;
    if (!result.success) hasErrors = true;
  }
  
  console.log('------------------------------------------');
  console.log(`📦 Total records migrated: ${totalMigrated}`);
  
  if (hasErrors) {
    console.log('\n⚠️  Some migrations had errors. Check logs above.');
  } else {
    console.log('\n🎉 Migration completed successfully!');
  }
}

// Run the migration
runMigration().catch(console.error);
