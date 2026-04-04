import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Create a user using Supabase Auth (passwords handled by Supabase, not profiles table)
 */
export async function createLocalUser(
  email: string,
  password: string,
  fullName: string,
  phoneNumber: string
) {
  const supabase = getSupabaseAdmin();

  // Step 1: Create user in Supabase Auth (this handles password securely)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm email so user can login immediately
    user_metadata: {
      full_name: fullName,
      phone_number: phoneNumber,
    },
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      throw new Error('An account with this email already exists');
    }
    throw new Error(`Failed to create user: ${authError.message}`);
  }

  const userId = authData.user.id;

  // Step 2: Upsert profile (trigger should handle this, but we do it manually as backup)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert([
      {
        id: userId,
        email,
        full_name: fullName,
        phone_number: phoneNumber,
        wallet_balance: 0,
        is_admin: false,
      },
    ])
    .select()
    .single();

  if (profileError) {
    // Auth user was created but profile failed — still return auth user info
    console.error('Profile creation error:', profileError.message);
    return {
      id: userId,
      email,
      full_name: fullName,
      phone_number: phoneNumber,
      wallet_balance: 0,
      is_admin: false,
    };
  }

  return profile;
}

/**
 * Authenticate a user using Supabase Auth
 */
export async function authenticateLocalUser(email: string, password: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error('Invalid email or password');
  }

  return data.user;
}