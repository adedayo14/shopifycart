import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession, generateBillingOAuthUrl } from '@/lib/shopify-session';

export async function POST(request: NextRequest) {
  try {
    const { blockIds, purchaseType, shop, host } = await request.json();
    
    console.log('Purchase request:', { blockIds, purchaseType, shop, host });

    if (!blockIds || !Array.isArray(blockIds) || blockIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Block IDs are required' 
      }, { status: 400 });
    }

    // Get session
    const sessionResult = await getShopifySession(request);
    
    if (sessionResult.error) {
      console.log('Session error:', sessionResult.message);
      
      // If JWT token expired, tell frontend to get fresh token
      if (sessionResult.needsFreshToken) {
        return NextResponse.json({
          error: 'SESSION_TOKEN_EXPIRED',
          message: 'Session token expired. Please refresh and try again.',
          shop: sessionResult.shop
        }, { status: 401 });
      }
      
      // If embedded app needs OAuth for billing
      if (sessionResult.needsOAuth && sessionResult.isEmbedded) {
        return NextResponse.json({
          error: 'EMBEDDED_NEEDS_OAUTH',
          authUrl: generateBillingOAuthUrl(sessionResult.shop || shop),
          message: 'Embedded app needs OAuth for billing'
        }, { status: 401 });
      }
      
      return NextResponse.json({
        error: 'missing_session',
        authUrl: generateBillingOAuthUrl(sessionResult.shop || shop),
        message: sessionResult.message
      }, { status: 401 });
    }

    console.log('Session found for shop:', sessionResult.shop);
    
    // Calculate total price
    const blockPrices: { [key: string]: number } = {
      'scrolling-bar': 19,
      'product-tabs': 24,
      'image-gallery': 29,
      'testimonial-slider': 22,
      'countdown-timer': 27,
      'size-chart': 21
    };

    const totalPrice = blockIds.reduce((sum: number, blockId: string) => {
      return sum + (blockPrices[blockId] || 0);
    }, 0);

    if (totalPrice === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid block selection' 
      }, { status: 400 });
    }

    // Create one-time purchase using Shopify GraphQL API
    const endpoint = `https://${sessionResult.shop}/admin/api/2023-01/graphql.json`;
    
    const mutation = `
      mutation appPurchaseOneTimeCreate($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
        appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
          confirmationUrl
          appPurchaseOneTime { 
            id 
            name
            status
            test
          }
          userErrors { 
            field 
            message 
          }
        }
      }
    `;

    const blockNames = blockIds.map((id: string) => 
      id.split('-').map((word: string) => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    ).join(', ');
    
    const variables = {
      name: `Trifoli Blocks - ${blockNames}`,
      price: { amount: totalPrice.toString(), currencyCode: 'USD' },
      returnUrl: `${process.env.SHOPIFY_APP_URL}/?shop=${encodeURIComponent(sessionResult.shop || '')}&host=${encodeURIComponent(host || '')}&purchased=${encodeURIComponent(blockIds.join(','))}`,
      test: process.env.SHOPIFY_BILLING_TEST_MODE === 'true'
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': sessionResult.accessToken || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const result = await response.json();
    console.log('Shopify GraphQL response:', result);

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      return NextResponse.json({
        error: 'Shopify API error', 
        details: result.errors.map((e: any) => e.message).join(', ')
      }, { status: 400 });
    }

    const purchaseData = result.data?.appPurchaseOneTimeCreate;
    
    if (purchaseData?.userErrors && purchaseData.userErrors.length > 0) {
      console.error('Purchase creation errors:', purchaseData.userErrors);
      return NextResponse.json({
        error: 'Failed to create purchase: ' + purchaseData.userErrors[0].message
      }, { status: 400 });
    }

    if (!purchaseData?.confirmationUrl) {
      console.error('No confirmation URL returned');
      return NextResponse.json({ 
        error: 'No confirmation URL returned'
      }, { status: 500 });
    }
      
    return NextResponse.json({
      success: true,
      confirmationUrl: purchaseData.confirmationUrl,
      chargeId: purchaseData.appPurchaseOneTime?.id,
      blocks: blockIds.map((id: string) => ({
        id,
        name: id.split('-').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        price: blockPrices[id]
      }))
    });

  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process purchase',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}