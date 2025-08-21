import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('=== CHECK METAFIELDS API ===');
    
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    console.log('Checking metafields for shop:', shop);

    // For testing purposes, we'll call the refresh-blocks API which will show us the current state
    const refreshResponse = await fetch(`${process.env.SHOPIFY_APP_URL}/api/refresh-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shop })
    });

    const result = await refreshResponse.json();
    
    return NextResponse.json({
      success: true,
      shop: shop,
      metafieldsStatus: result.success ? 'Successfully set' : 'Failed to set',
      details: result.message || result.error,
      blocksProcessed: result.blocksInstalled || 0
    });

  } catch (error) {
    console.error('Check metafields error:', error);
    return NextResponse.json(
      { error: 'Failed to check metafields', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
