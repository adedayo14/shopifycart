import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession } from '../../../../lib/shopify-session';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN SYNC BLOCKS ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in sync blocks');
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== SYNC PURCHASED BLOCKS API ===');
    
    // Get session to get shop info
    const sessionResult = await getShopifySession(request);
    
    if (sessionResult.error) {
      console.error('Session error in sync blocks:', sessionResult.message);
      return NextResponse.json(
        { error: 'Session validation failed' },
        { status: 401 }
      );
    }
    
    const shop = sessionResult.shop!;
    console.log('Syncing purchased blocks for shop:', shop);
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Get all purchased blocks for this shop
      const [purchases, blockPurchases] = await Promise.all([
        prisma.purchase.findMany({
          where: { 
            shopDomain: shop,
            status: 'completed'
          },
          select: { blockId: true }
        }),
        prisma.blockPurchase.findMany({
          where: { 
            shop: shop,
            status: 'completed'
          },
          select: { blockId: true }
        })
      ]);
      
      // Combine and deduplicate block IDs
      const allBlockIds = [
        ...purchases.map(p => p.blockId),
        ...blockPurchases.map(p => p.blockId)
      ];
      
      const uniqueBlockIds = Array.from(new Set(allBlockIds));
      
      console.log('Found purchased blocks:', uniqueBlockIds);
      
      await prisma.$disconnect();
      
      if (uniqueBlockIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No purchased blocks found to sync',
          installedBlocks: 0
        });
      }
      
      // Install the blocks to theme
      console.log('Installing blocks to theme...');
      const installResponse = await fetch(`${process.env.SHOPIFY_APP_URL}/api/install-blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionResult.accessToken}`,
          'X-Shopify-Shop-Domain': shop
        },
        body: JSON.stringify({
          shop,
          blockIds: uniqueBlockIds
        })
      });
      
      const installResult = await installResponse.json();
      console.log('Block installation result:', installResult);
      
      return NextResponse.json({
        success: true,
        message: `Successfully synced ${uniqueBlockIds.length} purchased blocks`,
        purchasedBlocks: uniqueBlockIds,
        installResult
      });
      
    } catch (dbError) {
      console.error('Database error in sync blocks:', dbError);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to fetch purchased blocks' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Sync blocks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync blocks' },
      { status: 500 }
    );
  }
}
