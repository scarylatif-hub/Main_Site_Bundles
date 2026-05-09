import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin-config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/maintenance
 * Get current maintenance mode status
 */
export async function GET() {
  try {
    console.log('[Maintenance Mode] GET request received');

    const admin = createAdminClient();

    const { data, error } = await admin
      .from('maintenance_mode')
      .select('*')
      .single();

    console.log('[Maintenance Mode] Fetch result - error:', error?.code, 'data:', !!data);

    if (error) {
      // If no row exists, return default disabled state
      if (error.code === 'PGRST116') {
        console.log('[Maintenance Mode] Table not found (PGRST116), returning default');
        return NextResponse.json({
          is_enabled: false,
          message: null,
        });
      }
      console.log('[Maintenance Mode] Fetch error:', error);
      throw error;
    }

    console.log('[Maintenance Mode] Success:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Maintenance Mode] Error fetching maintenance mode:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance mode', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/maintenance
 * Update maintenance mode status
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Maintenance Mode] POST request received');

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log('[Maintenance Mode] User:', user?.email);

    if (!user || !isAdminEmail(user.email)) {
      console.log('[Maintenance Mode] Unauthorized - user:', user?.email, 'isAdmin:', isAdminEmail(user?.email));
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const body = await request.json();
    const { is_enabled, message } = body;

    console.log('[Maintenance Mode] Request body:', { is_enabled, message });

    if (typeof is_enabled !== 'boolean') {
      console.log('[Maintenance Mode] Invalid is_enabled type:', typeof is_enabled);
      return NextResponse.json(
        { error: 'is_enabled must be a boolean' },
        { status: 400 }
      );
    }

    // Check if row exists
    const { data: existing, error: checkError } = await admin
      .from('maintenance_mode')
      .select('id')
      .single();

    console.log('[Maintenance Mode] Check existing row - error:', checkError?.code, 'data:', !!existing);

    const updateData = {
      is_enabled,
      message: message || null,
      updated_at: new Date().toISOString(),
    };

    // If table doesn't exist, return helpful error
    if (checkError && checkError.code === 'PGRST116') {
      console.log('[Maintenance Mode] Table not found (PGRST116)');
      return NextResponse.json(
        { error: 'Maintenance mode table not found. Please run the database migration in Supabase SQL Editor.' },
        { status: 500 }
      );
    }

    if (checkError) {
      console.log('[Maintenance Mode] Check error:', checkError);
      throw checkError;
    }

    let result;
    if (existing) {
      console.log('[Maintenance Mode] Updating existing row');
      // Update existing row
      const { data, error } = await admin
        .from('maintenance_mode')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.log('[Maintenance Mode] Update error:', error);
        throw error;
      }
      result = data;
    } else {
      console.log('[Maintenance Mode] Inserting new row');
      // Insert new row
      const { data, error } = await admin
        .from('maintenance_mode')
        .insert(updateData)
        .select()
        .single();

      if (error) {
        console.log('[Maintenance Mode] Insert error:', error);
        throw error;
      }
      result = data;
    }

    console.log('[Maintenance Mode] Success:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Maintenance Mode] Error updating maintenance mode:', error);
    return NextResponse.json(
      { error: 'Failed to update maintenance mode', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
