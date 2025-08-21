import { NextRequest, NextResponse } from 'next/server';
import { refreshAllSubscriberMetafields, refreshMetafieldsForShop } from '../../../lib/refresh-metafields';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN AUTO-REFRESH-METAFIELDS ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in auto-refresh-metafields');
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== AUTO-REFRESH METAFIELDS API ===');
    
    const body = await request.json().catch(() => ({}));
    let shop = body.shop;
    
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    // Normalize shop domain
    shop = shop.trim().toLowerCase();
    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }

    // Get session token from authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No authorization header, skipping auto-refresh');
      return NextResponse.json({
        success: true,
        message: 'No session token - auto-refresh skipped'
      });
    }

    console.log('Auto-refreshing metafields for shop:', shop);

    // Get access token from session  
    const { getShopifySession } = await import('../../../lib/shopify-session');
    
    // Create a mock request object for getShopifySession
    const mockRequest = new Request('http://localhost', {
      headers: {
        'Authorization': authHeader,
        'X-Shopify-Shop-Domain': shop
      }
    });
    
    const sessionResult = await getShopifySession(mockRequest);
    
    if (sessionResult.error || !('accessToken' in sessionResult) || !sessionResult.accessToken) {
      console.log('No valid session found, skipping auto-refresh');
      return NextResponse.json({
        success: true,
        message: 'No valid session - auto-refresh skipped'
      });
    }

    console.log('Found session, auto-refreshing blocks...');
    
    // Auto-refresh blocks using the new function
    const refreshed = await refreshMetafieldsForShop(shop);
    
    if (refreshed) {
      console.log('✅ Successfully auto-refreshed blocks for:', shop);
      return NextResponse.json({
        success: true,
        message: 'Blocks metafields auto-refreshed successfully',
        shop: shop,
        refreshed: true
      });
    } else {
      console.log('Auto-refresh skipped (cooldown or no changes needed)');
      return NextResponse.json({
        success: true,
        message: 'Auto-refresh skipped (recent refresh or no changes needed)',
        shop: shop,
        refreshed: false
      });
    }

  } catch (error) {
    console.error('Error in auto-refresh-metafields API:', error);
    // Return success even on error to avoid breaking the main app flow
    return NextResponse.json({
      success: true,
      message: 'Auto-refresh completed with errors (non-critical)',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: 'Use POST method to auto-refresh metafields' },
    { status: 405 }
  );
}
