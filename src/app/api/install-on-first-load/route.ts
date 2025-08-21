import { NextRequest, NextResponse } from 'next/server';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN INSTALL-ON-FIRST-LOAD ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in install-on-first-load');
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== INSTALL ON FIRST LOAD API ===');
    
    const body = await request.json();
    const { shop } = body;
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    // Get access token from database
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const shopSession = await prisma.session.findFirst({
        where: { 
          shop: shop,
          accessToken: { not: '' }
        },
        orderBy: { updatedAt: 'desc' }
      });

      if (!shopSession?.accessToken) {
        await prisma.$disconnect();
        return NextResponse.json(
          { error: 'No access token found for shop' },
          { status: 401 }
        );
      }

      // Install blocks (this will set at least the free block)
      const { installBlocksForShop } = await import('../../../lib/install-blocks');
      const result = await installBlocksForShop(shop, shopSession.accessToken);

      await prisma.$disconnect();

      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Blocks installed successfully for new store' : 'Failed to install blocks',
        error: result.error,
        data: result.data
      });

    } catch (dbError) {
      console.error('Database error in install-on-first-load:', dbError);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Database error: ' + (dbError instanceof Error ? dbError.message : 'Unknown error') },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Install on first load API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to install on first load' },
      { status: 500 }
    );
  }
}
