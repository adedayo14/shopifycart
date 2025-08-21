import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession } from '@/lib/shopify-admin';
import { registerWebhooks, listWebhooks } from '@/lib/shopify-webhooks';

export async function POST(request: NextRequest) {
  try {
    console.log('Setting up webhooks...');

    // Get Shopify session
    let session;
    try {
      session = await getShopifySession(request);
      console.log('Session retrieved for shop:', session?.shop);
    } catch (error) {
      console.error('Session error:', error);
      return NextResponse.json(
        { error: 'Failed to get Shopify session' },
        { status: 401 }
      );
    }

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'No valid Shopify session found' },
        { status: 401 }
      );
    }

    // List existing webhooks first
    console.log('Checking existing webhooks...');
    const existingWebhooks = await listWebhooks(session.shop, session.accessToken);
    console.log('Existing webhooks:', existingWebhooks);

    // Register new webhooks
    console.log('Registering new webhooks...');
    const results = await registerWebhooks(session.shop, session.accessToken);

    // List webhooks again to confirm
    const updatedWebhooks = await listWebhooks(session.shop, session.accessToken);

    return NextResponse.json({
      success: true,
      message: 'Webhooks setup completed',
      results,
      existingWebhooks,
      updatedWebhooks
    });

  } catch (error) {
    console.error('Webhook setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup webhooks', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('Listing webhooks...');

    // Get Shopify session
    let session;
    try {
      session = await getShopifySession(request);
      console.log('Session retrieved for shop:', session?.shop);
    } catch (error) {
      console.error('Session error:', error);
      return NextResponse.json(
        { error: 'Failed to get Shopify session' },
        { status: 401 }
      );
    }

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'No valid Shopify session found' },
        { status: 401 }
      );
    }

    // List existing webhooks
    const webhooks = await listWebhooks(session.shop, session.accessToken);

    return NextResponse.json({
      success: true,
      webhooks,
      shop: session.shop
    });

  } catch (error) {
    console.error('Webhook listing error:', error);
    return NextResponse.json(
      { error: 'Failed to list webhooks', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 