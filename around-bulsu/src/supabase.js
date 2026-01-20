import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wcubybptmqnpfxvekmhv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjdWJ5YnB0bXFucGZ4dmVrbWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0Njg2MTEsImV4cCI6MjA4NDA0NDYxMX0.rxa0Ir7iFKX_Ylzg2N2dSAsKtYG5vTsjP_g1QmdNQZs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const subscribeToTable = (tableName, callback, orderBy = null) => {
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

  const channel = supabase
    .channel(`${tableName}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      () => fetchData()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};
