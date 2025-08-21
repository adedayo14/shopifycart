import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const shop = request.nextUrl.searchParams.get('shop');
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    console.log('=== DEBUG SUBSCRIPTION STATUS ===', shop);

    // Fix environment variables in production - inline
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
      const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
      
      if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
        console.log('=== FIXING DATABASE_URL IN DEBUG ===');
        process.env.DATABASE_URL = correctDatabaseUrl;
        console.log('Fixed DATABASE_URL in debug');
      }
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Check subscription status
      const activeSubscription = await prisma.subscription.findFirst({
        where: { 
          shop: shop,
          status: 'active'
        },
        orderBy: { createdAt: 'desc' }
      });

      // Check all subscriptions for this shop
      const allSubscriptions = await prisma.subscription.findMany({
        where: { shop: shop },
        orderBy: { createdAt: 'desc' }
      });

      // Check purchases
      const purchases = await prisma.purchase.findMany({
        where: { shopDomain: shop },
        orderBy: { createdAt: 'desc' }
      });

      // Check block purchases
      const blockPurchases = await prisma.blockPurchase.findMany({
        where: { shop: shop },
        orderBy: { createdAt: 'desc' }
      });

      // Get blocks config
      const blocksConfig = await import('../../../config/blocks');
      const allBlocks = blocksConfig.default.map((block: any) => block.id);

      await prisma.$disconnect();

      return NextResponse.json({
        shop,
        hasActiveSubscription: !!activeSubscription,
        activeSubscription,
        allSubscriptions,
        purchases,
        blockPurchases,
        allBlocksFromConfig: allBlocks,
        totalBlocks: allBlocks.length
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      await prisma.$disconnect();
      return NextResponse.json({
        error: 'Database error: ' + (dbError instanceof Error ? dbError.message : 'Unknown error')
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Debug subscription API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
