import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== FORCE REFRESH TEST BLOCK ===');
    
    const body = await request.json().catch(() => ({}));
    const shop = body.shop || request.nextUrl.searchParams.get('shop');
    
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    // Call auto-refresh API to force install test block
    const refreshResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://shopifyapp-weld.vercel.app'}/api/auto-refresh-metafields`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shop: shop,
        forceRefresh: true
      })
    });
    
    const refreshResult = await refreshResponse.json();
    
    if (refreshResult.success) {
      return NextResponse.json({
        success: true,
        message: `✅ Successfully force-refreshed blocks for ${shop}. Test block should now be available in the online editor!`,
        details: refreshResult
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `Failed to refresh blocks: ${refreshResult.error}`,
        details: refreshResult
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Force refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
