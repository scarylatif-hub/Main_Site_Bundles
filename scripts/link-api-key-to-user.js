#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseArgs(argv) {
  const args = { apiKey: '', email: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part === '--api-key' || part === '-k') {
      args.apiKey = argv[i + 1] || '';
      i += 1;
    } else if (part === '--email' || part === '-e') {
      args.email = argv[i + 1] || '';
      i += 1;
    }
  }

  return args;
}

async function main() {
  const { apiKey, email } = parseArgs(process.argv.slice(2));

  if (!apiKey || !email) {
    console.error('Usage: node scripts/link-api-key-to-user.js --api-key <your-api-key> --email ayibonteemmanuel3@gmail.com');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, full_name, wallet_balance')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (profileError || !profile) {
    console.error('Profile not found for email:', email);
    console.error(profileError?.message || '');
    process.exit(1);
  }

  const apiKeyHash = sha256Hex(apiKey.trim());
  const placeholderPasswordHash = sha256Hex(`api-client:${profile.id}:${Date.now()}`);

  const { data: existingClient, error: existingError } = await admin
    .from('clients')
    .select('id, email, api_key_hash, is_active')
    .eq('email', profile.email)
    .maybeSingle();

  if (existingError) {
    console.error('Failed to check existing client record:', existingError.message);
    process.exit(1);
  }

  if (existingClient) {
    const { error: updateError } = await admin
      .from('clients')
      .update({
        name: profile.full_name || profile.email,
        api_key_hash: apiKeyHash,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingClient.id);

    if (updateError) {
      console.error('Failed to update existing client:', updateError.message);
      process.exit(1);
    }

    console.log('Updated existing client record for this user.');
  } else {
    const { data: createdClient, error: insertError } = await admin
      .from('clients')
      .insert({
        name: profile.full_name || profile.email,
        email: profile.email,
        password_hash: placeholderPasswordHash,
        api_key_hash: apiKeyHash,
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError || !createdClient) {
      console.error('Failed to create client record:', insertError?.message || 'Unknown error');
      process.exit(1);
    }

    await admin
      .from('api_balances')
      .upsert({ client_id: createdClient.id, balance: 0, updated_at: new Date().toISOString() }, { onConflict: 'client_id' });

    console.log('Created a new client record and linked it to this user.');
  }

  console.log('');
  console.log('Linked API key to user profile:');
  console.log('  email:', profile.email);
  console.log('  profile_id:', profile.id);
  console.log('  wallet_balance:', Number(profile.wallet_balance || 0));
  console.log('');
  console.log('This uses the main wallet balance path, so purchases/deposits will affect the existing main-site balance.');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
