import { NextRequest, NextResponse } from 'next/server';
import { createLocalUser } from '@/lib/auth-local';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, phone } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`Attempting signup for email: ${email}`);

    const profile = await createLocalUser(email, password, fullName, phone || '');

    console.log('Signup successful:', profile.email);

    return NextResponse.json({
      success: true,
      userId: profile.id,
      email: profile.email,
      profile,
    });

  } catch (error: any) {
    console.error('Error in POST /api/auth/signup:', error);
    return NextResponse.json(
      {
        error: error.message || 'Signup failed',
        details: String(error),
      },
      { status: 400 }
    );
  }
}