import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession, prisma } from '../../../lib/shopify-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('=== SUBSCRIPTION STATUS API CALLED ===');
  
  try {

    const body = await request.json();
    let { shop, idToken } = body;
    console.log('Subscription status request (pre-normalize):', { shop, hasIdToken: !!idToken });
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('Environment check:', {
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? 'SET' : 'NOT SET',
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? 'SET' : 'NOT SET',
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
      NODE_ENV: process.env.NODE_ENV
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop parameter is required' }, { status: 400 });
    }

    // Normalize shop domain
    shop = shop.trim().toLowerCase();
    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }
    console.log('Subscription status request (normalized):', { shop });

    // Create a modified request with normalized shop in headers for session retrieval
    const modifiedRequest = new Request(request.url, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'X-Shopify-Shop-Domain': shop,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...body, shop })
    });

    console.log('Getting Shopify session for subscription status...');
    
    const sessionResult = await getShopifySession(request);
    
    if (sessionResult.error) {
      console.log('Session error:', sessionResult.message);
      
      // For embedded apps, assume they're installed even without valid OAuth session
      // This prevents the install loop for apps that are already embedded in admin
      if (sessionResult.isEmbedded || shop.includes('.myshopify.com')) {
        console.log('Embedded app or valid shop detected - treating as installed');
        return NextResponse.json({
          success: true,
          requiresInstallation: false,
          hasSubscription: false,
          subscription: null,
          embedded: true,
          needsOAuth: sessionResult.needsOAuth || false,
          message: 'App detected as embedded/installed'
        });
      }
      
      console.log('No valid session found, app may need installation');
      return NextResponse.json({ 
        success: false,
        requiresInstallation: true,
        hasSubscription: false,
        subscription: null,
        error: sessionResult.message
      });
    }
    
    console.log('Session found for shop:', sessionResult.shop);
    console.log('Has access token:', !!sessionResult.accessToken);
    console.log('Is embedded:', sessionResult.isEmbedded);

    // Check for subscription in database
    const subscription = await prisma.subscription.findFirst({
      where: { 
        shop: sessionResult.shop,
        status: 'active'
      }
    });

    console.log('Subscription found:', !!subscription);

    // Automatically install blocks for the store (ensures free block is always available)
    if (sessionResult.accessToken) {
      try {
        console.log('Auto-installing blocks for store on session check...');
        const { installBlocksForShop } = await import('../../../lib/install-blocks');
        const installResult = await installBlocksForShop(sessionResult.shop!, sessionResult.accessToken);
        console.log('Auto-install result:', installResult.success ? 'SUCCESS' : 'FAILED');
        if (!installResult.success) {
          console.warn('Auto-install failed:', installResult.error);
        }
      } catch (installError) {
        console.warn('Auto-install error (non-critical):', installError);
      }
    }

    return NextResponse.json({
      success: true,
      requiresInstallation: false,
      hasSubscription: !!subscription,
      subscription: subscription ? {
        id: subscription.id,
        planType: subscription.planType,
        status: subscription.status,
        createdAt: subscription.createdAt
      } : null,
      embedded: sessionResult.isEmbedded
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to check subscription status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
