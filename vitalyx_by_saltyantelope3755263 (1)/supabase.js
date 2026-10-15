import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://zxbgkscgkfcpyraoaygc.supabase.co";
export const VITALYX_REDIRECT_URL = "https://vitalyx--saltyantelope3755263.on.websim.com";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1w20SwOXE4PXcLHW3v40Gw_5N6BJdHn";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});
