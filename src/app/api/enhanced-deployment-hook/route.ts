import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import blocksConfig from '../../../config/blocks';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Enhanced deployment hook to sync ALL blocks for ALL active subscribers
export async function POST(request: NextRequest) {
  try {
    console.log('=== ENHANCED DEPLOYMENT HOOK ===');
    
    // Verify deployment hook (simple auth)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.DEPLOYMENT_HOOK_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Enhanced deployment hook triggered - syncing ALL blocks for ALL active subscribers...');

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

    // Get ALL block IDs from config (including newly added blocks)
    const allBlockIds = blocksConfig.map(block => block.id);
    console.log(`Found ${allBlockIds.length} blocks in config:`, allBlockIds);
    
    let successCount = 0;
    let errorCount = 0;
    let blocksInstalled = 0;

    // Install all blocks for each active subscriber
    for (const subscription of activeSubscriptions) {
      try {
        console.log(`🔄 Syncing ALL blocks for shop: ${subscription.shop}`);
        
        const installResponse = await fetch(`${process.env.SHOPIFY_APP_URL}/api/install-blocks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop: subscription.shop,
            blockIds: allBlockIds // Send ALL blocks to active subscribers
          }),
        });

        if (installResponse.ok) {
          const result = await installResponse.json();
          successCount++;
          blocksInstalled += result.results?.length || allBlockIds.length;
          console.log(`✅ Successfully synced ${allBlockIds.length} blocks for ${subscription.shop}`);
        } else {
          const errorText = await installResponse.text();
          errorCount++;
          console.error(`❌ Failed to sync blocks for ${subscription.shop}:`, errorText);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error syncing blocks for ${subscription.shop}:`, error);
      }
    }

    console.log(`🎉 Enhanced deployment sync complete: ${successCount} success, ${errorCount} errors, ${blocksInstalled} total blocks installed`);

    return NextResponse.json({
      success: true,
      message: 'Enhanced deployment hook completed - ALL blocks synced for ALL active subscribers',
      stats: {
        totalSubscriptions: activeSubscriptions.length,
        successCount,
        errorCount,
        blocksInstalled,
        totalBlocksInConfig: allBlockIds.length,
        blockIds: allBlockIds
      }
    });

  } catch (error) {
    console.error('Enhanced deployment hook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
