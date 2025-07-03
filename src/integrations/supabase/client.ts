import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = "https://kgaiqhszcjiquxcwxxbs.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnYWlxaHN6Y2ppcXV4Y3d4eGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3NjYyODksImV4cCI6MjA2NjM0MjI4OX0.OikYe9LLX-0eKhG4sPH7e1IOpNtWiZkRYPJdF2yJpb4"

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)