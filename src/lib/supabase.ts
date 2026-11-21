import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'vcs_supabase_url';
const STORAGE_ANON_KEY = 'vcs_supabase_anon_key';

export function getStoredSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

  const storedUrl = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_URL_KEY) || '').trim() : '';
  const storedKey = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_ANON_KEY) || '').trim() : '';

  // If env variables are provided and valid, prioritize them so all phones on the same server automatically sync
  if (envUrl && envUrl.startsWith('http') && envKey && envKey.length > 20) {
    return { url: envUrl, anonKey: envKey };
  }

  return {
    url: storedUrl || envUrl,
    anonKey: storedKey || envKey
  };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
    // Clear legacy mock data keys if they exist
    localStorage.removeItem('vcs_products_db');
    localStorage.removeItem('vcs_sales_db');
    localStorage.removeItem('vcs_purchases_db');
    localStorage.removeItem('vcs_expenses_db');
    localStorage.removeItem('vcs_customers_db');
    localStorage.removeItem('vcs_activity_db');
    localStorage.removeItem('vcs_exchanges_db');
    // Invalidate client instance so next call creates new
    cachedClient = null;
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http') && anonKey.length > 20);
}

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey || !url.startsWith('http') || anonKey.length <= 20) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    return cachedClient;
  } catch (err) {
    console.error('Error creating Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(urlInput?: string, keyInput?: string): Promise<{ success: boolean; message: string }> {
  const url = (urlInput || getStoredSupabaseConfig().url).trim();
  const anonKey = (keyInput || getStoredSupabaseConfig().anonKey).trim();

  if (!url || !anonKey) {
    return { success: false, message: 'Supabase URL and Anon Key are required.' };
  }

  try {
    const testClient = createClient(url, anonKey);
    const { error } = await testClient.from('products').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        return { 
          success: true, 
          message: 'Connected to Supabase! (Database tables need to be created via migration script).' 
        };
      }
      return { success: false, message: `Database error: ${error.message}` };
    }

    return { success: true, message: 'Successfully connected to Supabase cloud database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Supabase.' };
  }
}
