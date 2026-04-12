// This file previously contained direct PostgreSQL connection helpers.
// After reloading PostgREST schema cache (NOTIFY pgrst, 'reload schema'),
// all queries now go through supabaseAdmin which handles the connection.
// This file is kept for backward compatibility of imports.

export { supabaseAdmin as db } from './supabase.js';
