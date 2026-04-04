import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing email or password' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Step 1: Sign in with Supabase Auth to get the session
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw new Error('Invalid email or password');
    }

    const userId = authData.user.id;

    // Step 2: Fetch profile from profiles table using service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      // Profile missing — create it on the fly
      const { data: newProfile } = await supabaseAdmin
        .from('profiles')
        .upsert([{
          id: userId,
          email: authData.user.email,
          full_name: authData.user.user_metadata?.full_name || '',
          phone_number: authData.user.user_metadata?.phone_number || '',
          wallet_balance: 0,
          is_admin: false,
        }])
        .select()
        .single();

      return NextResponse.json({
        success: true,
        user: newProfile,
        session: authData.session,
      });
    }

    console.log('Signin successful:', profile.email);

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        phone_number: profile.phone_number,
        wallet_balance: profile.wallet_balance,
        is_admin: profile.is_admin,
      },
      session: authData.session,
    });

  } catch (error: any) {
    console.error('Error in POST /api/auth/signin:', error);
    return NextResponse.json(
      {
        error: error.message || 'Authentication failed',
        details: String(error),
      },
      { status: 401 }
    );
  }
}