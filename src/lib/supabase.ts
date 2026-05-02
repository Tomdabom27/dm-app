import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Disable navigator.locks to prevent lock contention from
    // multiple client instances (hot reload, dev mode, etc.)
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});
