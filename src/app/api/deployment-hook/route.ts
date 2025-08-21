import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import blocksConfig from '../../../config/blocks';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Deployment hook to refresh all subscribers automatically
export async function POST(request: NextRequest) {
  try {
    console.log('=== DEPLOYMENT HOOK ===');
    
    // Verify deployment hook (simple auth)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.DEPLOYMENT_HOOK_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Deployment hook triggered - refreshing all active subscribers...');

    // Get all active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active'
      },
      select: {
        shop: true
      }
    });

    console.log(`Found ${activeSubscriptions.length} active subscriptions`);

    // Get ALL block IDs from config
    const allBlockIds = blocksConfig.map(block => block.id);
    
    let successCount = 0;
    let errorCount = 0;

    // Install all blocks for each active subscriber
    for (const subscription of activeSubscriptions) {
      try {
        console.log(`Installing blocks for shop: ${subscription.shop}`);
        
        const installResponse = await fetch(`${process.env.SHOPIFY_APP_URL}/api/install-blocks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop: subscription.shop,
            blockIds: allBlockIds
          }),
        });

        if (installResponse.ok) {
          successCount++;
          console.log(`✅ Successfully refreshed blocks for ${subscription.shop}`);
        } else {
          errorCount++;
          console.error(`❌ Failed to refresh blocks for ${subscription.shop}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error refreshing blocks for ${subscription.shop}:`, error);
      }
    }

    console.log(`Deployment refresh complete: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: 'Deployment hook completed',
      stats: {
        totalSubscriptions: activeSubscriptions.length,
        successCount,
        errorCount,
        blocksInstalled: allBlockIds.length
      }
    });

  } catch (error) {
    console.error('Deployment hook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
