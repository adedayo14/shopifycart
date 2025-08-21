import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession } from '../../../lib/shopify-session';
import { PrismaClient } from '@prisma/client';
import blocksConfig from '../../../config/blocks';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Refresh block access for subscribers
export async function POST(request: NextRequest) {
  try {
    console.log('=== REFRESH BLOCKS API ===');
    
    const { shop } = await request.json();
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    console.log('Refreshing blocks for shop:', shop);

    // Check if shop has active subscription
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        shop: shop,
        status: 'active'
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!activeSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 403 }
      );
    }

    console.log('Found active subscription, installing all blocks...');

    // Get ALL block IDs from config
    const allBlockIds = blocksConfig.map(block => block.id);
    
    // Install all blocks
    const installResponse = await fetch(`${process.env.SHOPIFY_APP_URL}/api/install-blocks-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shop: shop,
        blockIds: allBlockIds
      })
    });

    const result = await installResponse.json();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully refreshed access to all ${allBlockIds.length} blocks`,
        blocksInstalled: allBlockIds.length
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to install blocks', details: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Refresh blocks error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh blocks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
