import { NextRequest, NextResponse } from 'next/server';
import { beginAuth } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { shop, host } = await request.json();
    
    console.log('Shopify install API called with shop:', shop, 'host:', host);
    console.log('Environment check:', {
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? 'SET' : 'NOT SET',
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? 'SET' : 'NOT SET',
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
      NODE_ENV: process.env.NODE_ENV
    });
    
    if (!shop) {
      console.error('No shop parameter provided');
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }

    if (!host) {
      console.log('No host parameter provided, generating direct OAuth URL');
      // Generate direct OAuth URL for non-embedded installation
      const shopifyApiKey = process.env.SHOPIFY_API_KEY;
      const appUrl = process.env.SHOPIFY_APP_URL;
      const scopes = process.env.SCOPES || 'write_products,write_themes';
      
      if (!shopifyApiKey || !appUrl) {
        console.error('Missing required environment variables');
        return NextResponse.json(
          { error: 'App configuration error' },
          { status: 500 }
        );
      }
      
      // Generate direct OAuth URL
      const state = `${shop}:direct`;
      const redirectUri = `${appUrl}/api/auth/callback`;
      const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${shopifyApiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
      
      console.log('Direct OAuth URL generated:', authUrl);
      console.log('Environment variables used:', {
        shopifyApiKey: shopifyApiKey ? 'SET' : 'NOT SET',
        appUrl: appUrl,
        scopes: scopes,
        redirectUri: `${appUrl}/api/auth/callback`
      });
      
      return NextResponse.json({
        success: true,
        authUrl: authUrl,
        message: 'Redirecting to Shopify for app installation'
      });
    }

    console.log('Installing app for shop:', shop);

    // Begin OAuth flow for app installation
    // Pass shop and host to beginAuth so state is shop:host
    const authRoute = await beginAuth(shop, host);
    
    console.log('Auth route generated:', authRoute);
    
    return NextResponse.json({
      success: true,
      authUrl: authRoute.url,
      message: 'Redirecting to Shopify for app installation'
    });
  } catch (error) {
    console.error('Install error:', error);
    return NextResponse.json(
      { error: 'Installation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check installation status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const blockId = searchParams.get('blockId')
    const shop = searchParams.get('shop')

    if (!blockId) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 })
    }

    // In a real implementation, this would check if the block is actually installed in the theme
    return NextResponse.json({
      installed: false, // Would check actual theme files via Shopify API
      block: blockId,
      shop: shop || 'demo-store'
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 })
  }
}
