import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'vcs_supabase_url';
const STORAGE_ANON_KEY = 'vcs_supabase_anon_key';

export function getStoredSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ANON_KEY) || '' : '';

  return {
    url: storedUrl || envUrl,
    anonKey: storedKey || envKey
  };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
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
  if (!url || !anonKey || !url.startsWith('http')) {
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
  const url = urlInput || getStoredSupabaseConfig().url;
  const anonKey = keyInput || getStoredSupabaseConfig().anonKey;

  if (!url || !anonKey) {
    return { success: false, message: 'URL and Anon Key are required.' };
  }

  try {
    const testClient = createClient(url, anonKey);
    const { error } = await testClient.from('categories').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        return { 
          success: true, 
          message: 'Connected to Supabase! (Note: Database tables need to be created via migration).' 
        };
      }
      return { success: false, message: `Database error: ${error.message}` };
    }

    return { success: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Supabase.' };
  }
}
