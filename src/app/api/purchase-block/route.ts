import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession, generateBillingOAuthUrl } from '../../../lib/shopify-session';
import { prisma } from '../../../lib/shopify-session';

// Block configuration - this should ideally come from the database
const BLOCK_PRICING = {
  'individual': 29,
  'pick-and-mix': 75,
  'single-block': 29,
  'three-blocks': 75
};

export async function POST(request: NextRequest) {
  try {
    console.log('=== PURCHASE BLOCK API ===');
    
    const sessionResult = await getShopifySession(request);
    
    if (sessionResult.error) {
      console.log('Session error:', sessionResult.message);
      
      // If JWT token expired, tell frontend to get fresh token
      if (sessionResult.needsFreshToken) {
        console.log('JWT token expired, frontend needs fresh token');
        return NextResponse.json({
          error: 'SESSION_TOKEN_EXPIRED',
          message: 'Session token expired. Please refresh and try again.',
          shop: sessionResult.shop
        }, { status: 401 });
      }
      
      // If embedded app needs OAuth for billing
      if (sessionResult.needsOAuth && sessionResult.isEmbedded) {
        console.log('Embedded app needs OAuth for billing permissions');
        const authUrl = generateBillingOAuthUrl(sessionResult.shop || 'unknown');
        console.log('Generated OAuth URL:', authUrl);
        return NextResponse.json({
          error: 'EMBEDDED_NEEDS_OAUTH',
          authUrl: authUrl,
          message: 'App needs billing permissions. Please complete OAuth flow.',
          shop: sessionResult.shop
        }, { status: 401 });
      }
      
      return NextResponse.json({
        error: 'missing_session',
        authUrl: generateBillingOAuthUrl(sessionResult.shop || 'unknown'),
        message: sessionResult.message
      }, { status: 401 });
    }
    
    console.log('Session found for shop:', sessionResult.shop);
    console.log('Has access token:', !!sessionResult.accessToken);
    console.log('Is embedded:', sessionResult.isEmbedded);
    
    // Parse request body
    const body = await request.json();
    const { blockIds, purchaseType } = body;
    
    if (!blockIds || !Array.isArray(blockIds) || blockIds.length === 0) {
      return NextResponse.json({
        error: 'invalid_request',
        message: 'Block IDs are required'
      }, { status: 400 });
    }
    
    console.log('Processing purchase:', {
      blockIds,
      purchaseType,
      shop: sessionResult.shop,
      isEmbedded: sessionResult.isEmbedded
    });
    
    // Check if access token has billing permissions
    console.log('Checking billing permissions for scope:', sessionResult.scope);
    const hasBillingScope = sessionResult.scope?.includes('write_payment_terms');
    
    if (!hasBillingScope) {
      console.log('Access token missing billing scopes. Current scope:', sessionResult.scope);
      console.log('Expected scope to include: write_payment_terms');
      console.log('Redirecting to OAuth with billing permissions');
      return NextResponse.json({
        error: 'EMBEDDED_NEEDS_OAUTH',
        authUrl: generateBillingOAuthUrl(sessionResult.shop || 'unknown'),
        message: 'App needs billing permissions. Please complete OAuth flow.',
        shop: sessionResult.shop,
        currentScope: sessionResult.scope,
        requiredScope: 'write_payment_terms'
      }, { status: 401 });
    }
    
    console.log('Billing permissions verified - proceeding with purchase');
    
    // Calculate price
    let price = 0;
    let name = 'Block Purchase';
    
    if (blockIds.length === 1) {
      price = BLOCK_PRICING['single-block'];
      name = 'Single Block Purchase';
    } else if (blockIds.length === 3) {
      price = BLOCK_PRICING['three-blocks'];
      name = 'Pick & Mix Bundle (3 Blocks)';
    } else {
      price = blockIds.length * BLOCK_PRICING['individual'];
      name = `${blockIds.length} Block Purchase`;
    }
    
    console.log('Creating one-time purchase:', { name, price, shop: sessionResult.shop });

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
    
    const variables = {
      name,
      price: { amount: price.toString(), currencyCode: 'USD' },
      returnUrl: `${process.env.SHOPIFY_APP_URL}/billing/success?shop=${sessionResult.shop}&type=purchase&blocks=${blockIds.join(',')}`,
      test: process.env.SHOPIFY_BILLING_TEST_MODE === 'true'
    };

    console.log('Shopify purchase variables:', variables);

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
      
      // Handle both string and array error formats
      let errorMessage = 'Shopify API error';
      if (typeof result.errors === 'string') {
        errorMessage = result.errors;
      } else if (Array.isArray(result.errors)) {
        errorMessage = result.errors.map((e: any) => e.message || e).join(', ');
      }
      
      return NextResponse.json({
        error: 'billing_api_error', 
        message: errorMessage,
        needsRealOAuth: errorMessage.includes('Invalid API key or access token')
      }, { status: 400 });
    }

    const purchaseData = result.data?.appPurchaseOneTimeCreate;
    
    if (purchaseData?.userErrors && purchaseData.userErrors.length > 0) {
      console.error('Purchase creation errors:', purchaseData.userErrors);
      return NextResponse.json(
        { error: 'Failed to create purchase: ' + purchaseData.userErrors[0].message },
        { status: 400 }
      );
    }

    if (!purchaseData?.confirmationUrl) {
      console.error('No confirmation URL returned');
      return NextResponse.json({ 
        error: 'No confirmation URL returned',
        data: purchaseData
      }, { status: 500 });
    }

    console.log('Purchase created successfully:', {
      purchaseId: purchaseData.appPurchaseOneTime?.id,
      confirmationUrl: purchaseData.confirmationUrl,
      isTest: purchaseData.appPurchaseOneTime?.test
    });

    return NextResponse.json({
      success: true,
      confirmationUrl: purchaseData.confirmationUrl,
      purchaseId: purchaseData.appPurchaseOneTime?.id,
      isTest: purchaseData.appPurchaseOneTime?.test
    });
    
  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json({
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
