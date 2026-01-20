import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wcubybptmqnpfxvekmhv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjdWJ5YnB0bXFucGZ4dmVrbWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg2MTEsImV4cCI6MjA4NDA0NDYxMX0.rxa0Ir7iFKX_Ylzg2N2dSAsKtYG5vTsjP_g1QmdNQZs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to subscribe to table changes (mimics Firebase onSnapshot)
export const subscribeToTable = (tableName, callback, orderBy = null) => {
  // Initial fetch
  const fetchData = async () => {
    let query = supabase.from(tableName).select('*');
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }
    const { data, error } = await query;
    if (!error) {
      callback(data || []);
    } else {
      console.error(`Error fetching ${tableName}:`, error);
    }
  };

  fetchData();

  // Real-time subscription
  const channel = supabase
    .channel(`${tableName}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      () => {
        fetchData(); // Refetch on any change
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
};

// Storage helper for image uploads
export const uploadImage = async (path, file) => {
  const fileName = `${Date.now()}_${file.name}`;
  const fullPath = `${path}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('images')
    .upload(fullPath, file, { upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(fullPath);

  return urlData.publicUrl;
};
