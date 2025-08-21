import { NextRequest, NextResponse } from 'next/server';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN MANUAL INSTALL ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in manual install');
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== MANUAL INSTALL BLOCKS TRIGGERED ===');
    
    // Get shop from query params or body
    const shop = request.nextUrl.searchParams.get('shop');
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    console.log('Manually installing blocks for shop:', shop);

    // Call our install-blocks-v2 API internally
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://shopifyapp-weld.vercel.app' 
      : 'http://localhost:3000';
    
    const installResponse = await fetch(`${baseUrl}/api/install-blocks-v2?shop=${shop}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const installResult = await installResponse.json();
    
    console.log('Install blocks v2 result:', installResult);

    return NextResponse.json({
      success: true,
      message: `Manually triggered block installation for ${shop}`,
      installResult
    });

  } catch (error) {
    console.error('Manual install blocks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to install blocks' },
      { status: 500 }
    );
  }
}
