import { NextRequest, NextResponse } from 'next/server';
import blocksConfig from '../../../config/blocks';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN MY-BLOCKS ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in my-blocks');
  }
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('=== MY BLOCKS API STARTED ===');
    
    // Get shop from query params and session from headers
    let shop = request.nextUrl.searchParams.get('shop');
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '') || 
                        request.headers.get('X-Shopify-ID-Token');
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    // Normalize shop domain
    shop = shop.trim().toLowerCase();
    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }

    console.log('Fetching purchased blocks for shop:', shop);
    console.log('Session token present:', !!sessionToken);

    // We don't need strict session validation for viewing purchased blocks
    // Just proceed with database queries - no authentication required for read-only data

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // First, let's test database connectivity and check what tables exist
      console.log('Testing database connection...');
      
      // Auto-refresh blocks for better UX (prevents users from needing manual refresh)
      try {
        const { getShopifySession } = await import('../../../lib/shopify-session');
        const { autoRefreshBlocks } = await import('../../../lib/auto-refresh-blocks');
        
        const sessionResult = await getShopifySession(request);
        if (!sessionResult.error && 'accessToken' in sessionResult && sessionResult.accessToken) {
          console.log('Auto-refreshing blocks for better UX...');
          // Force refresh to ensure new blocks like reveal-banner appear immediately
          await autoRefreshBlocks(shop, sessionResult.accessToken, true);
        } else {
          console.log('No access token available for auto-refresh, continuing without refresh');
        }
      } catch (autoRefreshError) {
        console.log('Auto-refresh failed (non-critical):', autoRefreshError);
        // Continue without auto-refresh - this is not critical for viewing blocks
      }
      
      // Check if tables exist and get counts
      const [purchaseCount, blockPurchaseCount, blockCount] = await Promise.all([
        prisma.purchase.count().catch(e => {
          console.error('Purchase table error:', e.message);
          return 0;
        }),
        prisma.blockPurchase.count().catch(e => {
          console.error('BlockPurchase table error:', e.message);
          return 0;
        }),
        prisma.block.count().catch(e => {
          console.error('Block table error:', e.message);
          return 0;
        })
      ]);
      
      console.log(`Table counts - Purchase: ${purchaseCount}, BlockPurchase: ${blockPurchaseCount}, Block: ${blockCount}`);
      
      // Check both Purchase and BlockPurchase tables
      const [purchasedBlocks, blockPurchases] = await Promise.all([
        prisma.purchase.findMany({
          where: { shopDomain: shop },
          orderBy: { createdAt: 'desc' },
          include: {
            block: {
              select: {
                id: true,
                name: true,
                price: true,
                category: true
              }
            }
          }
        }).catch(e => {
          console.error('Error fetching purchases:', e);
          return [];
        }),
        prisma.blockPurchase.findMany({
          where: { shop: shop },
          orderBy: { createdAt: 'desc' }
        }).catch(e => {
          console.error('Error fetching block purchases:', e);
          return [];
        })
      ]);

      console.log(`Found ${purchasedBlocks.length} purchased blocks and ${blockPurchases.length} block purchases for shop: ${shop}`);

      // Check for active subscription first
      console.log('Checking for active subscription...');
      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          shop: shop,
          status: 'active'
        },
        orderBy: { updatedAt: 'desc' }
      });

      console.log('Active subscription found:', !!activeSubscription);

      // Combine and format results from both tables
      let allBlocks = [
        ...purchasedBlocks.map(purchase => ({
          id: purchase.id,
          blockId: purchase.blockId,
          blockName: purchase.block.name,
          price: purchase.block.price,
          category: purchase.block.category,
          purchaseType: purchase.purchaseType,
          status: purchase.status,
          purchasedAt: purchase.createdAt.toISOString(),
          source: 'purchase'
        })),
        ...blockPurchases.map(purchase => ({
          id: purchase.id,
          blockId: purchase.blockId,
          blockName: purchase.blockName,
          price: purchase.price,
          category: 'Block',
          purchaseType: 'individual',
          status: purchase.status,
          purchasedAt: purchase.createdAt.toISOString(),
          source: 'blockPurchase'
        }))
      ];

      // If user has active subscription, add ALL blocks from config
      if (activeSubscription) {
        console.log('User has active subscription - adding all blocks from config');
        
        // Import blocks config to get all available blocks
        const blocksConfig = (await import('../../../config/blocks')).default;
        
        blocksConfig.forEach(block => {
          // Only add if not already in the list
          const existing = allBlocks.find(b => b.blockId === block.id);
          if (!existing) {
            allBlocks.push({
              id: `subscription-${block.id}`,
              blockId: block.id,
              blockName: block.name,
              price: block.price,
              category: block.category,
              purchaseType: 'subscription',
              status: 'completed',
              purchasedAt: activeSubscription.createdAt.toISOString(),
              source: 'subscription'
            });
          }
        });
      }

      // Remove duplicates by blockId, keeping the most recent purchase
      const blockMap = new Map();
      allBlocks.forEach(block => {
        const existing = blockMap.get(block.blockId);
        if (!existing || new Date(block.purchasedAt) > new Date(existing.purchasedAt)) {
          blockMap.set(block.blockId, block);
        }
      });
      
      // Always include free blocks from config (even if not explicitly purchased)
      const freeBlocks = blocksConfig.filter(block => block.price === 0).map(block => block.id);
      freeBlocks.forEach(blockId => {
        if (!blockMap.has(blockId)) {
          const blockInfo = blocksConfig.find(b => b.id === blockId);
          // Add free block that user hasn't explicitly purchased
          blockMap.set(blockId, {
            id: `free-${blockId}`,
            blockId: blockId,
            blockName: blockInfo?.name || blockId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            price: 0,
            category: 'Free',
            purchaseType: 'free',
            status: 'completed',
            purchasedAt: new Date().toISOString(),
            source: 'free'
          });
        }
      });
      
      const uniqueBlocks = Array.from(blockMap.values());

      // Sort by purchase date (newest first)
      uniqueBlocks.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());

      // Calculate available blocks (activeSubscription already defined above)
      let availableBlocks: string[] = [];

      if (activeSubscription) {
        // User has subscription - give access to ALL blocks from config
        const blocksConfig = (await import('../../../config/blocks')).default;
        availableBlocks = blocksConfig.map(block => block.id);
      } else {
        // No subscription - check individual purchases plus free blocks
        const blocksConfig = (await import('../../../config/blocks')).default;
        const freeBlocks = blocksConfig.filter(block => block.price === 0).map(block => block.id);
        
        const individualBlocks = [
          ...purchasedBlocks.map(p => p.blockId),
          ...blockPurchases.map(p => p.blockId)
        ];

        availableBlocks = Array.from(new Set([
          ...freeBlocks, // Include all free blocks from config
          ...individualBlocks
        ]));
      }

      await prisma.$disconnect();

      return NextResponse.json({
        success: true,
        blocks: uniqueBlocks,
        count: uniqueBlocks.length,
        access: {
          hasActiveSubscription: !!activeSubscription,
          availableBlocks: availableBlocks,
          accessType: activeSubscription ? 'subscription' : 'individual',
          subscriptionDetails: activeSubscription ? {
            id: activeSubscription.id,
            createdAt: activeSubscription.createdAt
          } : null,
          message: activeSubscription ? 
            'You have a subscription with access to all blocks' : 
            `You have access to ${availableBlocks.length} block(s) through individual purchases`
        }
      });

    } catch (dbError) {
      console.error('Database error in my-blocks:', dbError);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to fetch purchased blocks' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('My blocks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch blocks' },
      { status: 500 }
    );
  }
}
