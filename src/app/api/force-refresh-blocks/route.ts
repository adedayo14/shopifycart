import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession } from '../../../lib/shopify-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== FORCE REFRESH BLOCKS API ===');
    
    // Get shop from query or session
    let shop = request.nextUrl.searchParams.get('shop');
    
    if (!shop) {
      // Try to get from session
      const sessionResult = await getShopifySession(request);
      if (!sessionResult.error && 'shop' in sessionResult && sessionResult.shop) {
        shop = sessionResult.shop;
      }
    }
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }
    
    console.log('Force refreshing blocks for shop:', shop);
    
    // Use the install-blocks-v2 logic
    const installResponse = await fetch(`${request.nextUrl.origin}/api/install-blocks-v2?shop=${shop}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = await installResponse.json();
    
    if (installResponse.ok) {
      return NextResponse.json({
        success: true,
        message: 'Blocks refreshed successfully',
        data: result
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to refresh blocks'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Force refresh blocks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh blocks' },
      { status: 500 }
    );
  }
}
