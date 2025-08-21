import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession } from '../../../lib/shopify-session';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN INSTALL-BLOCKS V2 ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in install-blocks v2');
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== INSTALL BLOCKS V2 API ===');
    
    // Support both JSON body and query parameters
    let shop: string | null = null;
    let blockIds: string[] | undefined = undefined;
    
    // Try to get from query params first
    shop = request.nextUrl.searchParams.get('shop');
    
    // If no query params, try JSON body
    if (!shop) {
      try {
        const body = await request.json();
        shop = body.shop;
        blockIds = body.blockIds;
      } catch (e) {
        console.log('No JSON body provided, using query params only');
      }
    }
    
    console.log('Installing blocks v2:', { shop, blockIds });
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }
    
    // Get access token - try session first, then database fallback
    let accessToken = null;
    
    const sessionResult = await getShopifySession(request);
    
    if (!sessionResult.error && 'accessToken' in sessionResult && sessionResult.accessToken) {
      accessToken = sessionResult.accessToken;
      console.log('Got access token from session');
    } else {
      // Fallback: get access token from database
      const { PrismaClient } = await import('@prisma/client');
      const tempPrisma = new PrismaClient();
      
      try {
        const shopSession = await tempPrisma.session.findFirst({
          where: { 
            shop: shop,
            accessToken: { not: '' }
          },
          orderBy: { updatedAt: 'desc' }
        });
        
        if (shopSession?.accessToken) {
          accessToken = shopSession.accessToken;
          console.log('Got access token from database');
        }
      } catch (dbError) {
        console.error('Error getting access token from database:', dbError);
      } finally {
        await tempPrisma.$disconnect();
      }
    }
    
    if (!accessToken) {
      console.error('No access token available for shop:', shop);
      return NextResponse.json(
        { error: 'Unable to install blocks - no access token' },
        { status: 401 }
      );
    }
    
    console.log('Installing blocks for shop:', shop);

    // Use the shared installation function
    const { installBlocksForShop } = await import('../../../lib/install-blocks');
    const result = await installBlocksForShop(shop, accessToken);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Blocks installed successfully',
        data: result.data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Install blocks v2 API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to install blocks' },
      { status: 500 }
    );
  }
}


