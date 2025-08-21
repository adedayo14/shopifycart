import { NextRequest, NextResponse } from 'next/server';
import { beginAuth } from '@/lib/shopify-admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');

  if (!shop) {
    return NextResponse.json({ error: 'Shop parameter required' }, { status: 400 });
  }

  try {
    const authUrl = await beginAuth(shop as string, '');
    return NextResponse.redirect(authUrl.url);
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Failed to start OAuth' }, { status: 500 });
  }
} 
