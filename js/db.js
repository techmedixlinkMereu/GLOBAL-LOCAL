// ─────────────────────────────────────────────────────────────────
// TechMedixLink · js/db.js
// Single Supabase client instance — import { sb } from './db.js'
// ─────────────────────────────────────────────────────────────────

export const sb = supabase.createClient(
  TECHMEDIX_CONFIG.supabase.url,
  TECHMEDIX_CONFIG.supabase.anonKey
);
