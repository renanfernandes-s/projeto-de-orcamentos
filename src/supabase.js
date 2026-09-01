import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fndasultizpvuullkugr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_H1TD4jin2DNIRCUicJQkVQ_X7laL-GK';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);