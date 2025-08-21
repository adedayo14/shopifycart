import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession, generateBillingOAuthUrl } from '../../../lib/shopify-session';

export async function POST(request: NextRequest) {
  try {
    console.log('=== SUBSCRIBE API ===');
    
    // Get session using new JWT-aware session handler
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
        return NextResponse.json({
          error: 'EMBEDDED_NEEDS_OAUTH',
          authUrl: generateBillingOAuthUrl(sessionResult.shop || 'unknown'),
          message: 'Embedded app needs OAuth for billing'
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
    const { planType, shop } = body;
    
    if (!planType || !['monthly-access', 'annual-access'].includes(planType)) {
      return NextResponse.json({
        error: 'invalid_request',
        message: 'Valid plan type is required (monthly-access or annual-access)'
      }, { status: 400 });
    }
    
    console.log('Processing subscription:', {
      planType,
      shop: sessionResult.shop,
      isEmbedded: sessionResult.isEmbedded
    });
    
    // Check if access token has billing permissions
    const hasBillingScope = sessionResult.scope?.includes('write_payment_terms');
    
    if (!hasBillingScope) {
      console.log('Access token missing billing scopes, redirecting to OAuth');
      return NextResponse.json({
        error: 'EMBEDDED_NEEDS_OAUTH',
        authUrl: generateBillingOAuthUrl(sessionResult.shop || 'unknown'),
        message: 'Access token missing billing permissions'
      }, { status: 401 });
    }
    
    // Configure subscription details
    const price = planType === 'annual-access' ? '99.00' : '14.99';
    const interval = planType === 'annual-access' ? 'ANNUAL' : 'EVERY_30_DAYS';
    const name = planType === 'annual-access' ? 'Trifoli Annual Access' : 'Trifoli Monthly Access';
    
    console.log('Creating subscription:', { name, price, interval, shop: sessionResult.shop });

    // Only bypass Shopify billing in development mode (not test billing mode)
    const isDevelopmentMode = process.env.NODE_ENV === 'development' && process.env.SHOPIFY_BILLING_TEST_MODE !== 'true';
    
    if (isDevelopmentMode) {
      console.log('Development mode: Creating mock subscription for testing');
      
      // Create a mock subscription response
      const mockConfirmationUrl = `${process.env.SHOPIFY_APP_URL}/billing/success?shop=${sessionResult.shop}&plan=${planType}&test=true&mock=true`;
      
      return NextResponse.json({
        success: true,
        confirmationUrl: mockConfirmationUrl,
        subscriptionId: `mock_subscription_${Date.now()}`,
        isTest: true,
        isDevelopment: true
      });
    }

    // Create subscription using Shopify GraphQL API
    const endpoint = `https://${sessionResult.shop}/admin/api/2023-01/graphql.json`;
    
    const mutation = `
      mutation appSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean, $trialDays: Int) {
        appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, test: $test, trialDays: $trialDays) {
          confirmationUrl
          appSubscription { 
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

    const lineItems = [{
      plan: {
        appRecurringPricingDetails: {
          price: { amount: price, currencyCode: 'USD' },
          interval: interval,
        }
      }
    }];
    
    const variables = {
      name,
      lineItems,
      returnUrl: `${process.env.SHOPIFY_APP_URL}/billing/success?shop=${sessionResult.shop}&plan=${planType}`,
      test: process.env.SHOPIFY_BILLING_TEST_MODE === 'true',
      trialDays: 30 // 30-day trial
    };

    console.log('Shopify subscription variables:', variables);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': sessionResult.accessToken || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const result = await response.json();
    console.log('Shopify GraphQL response status:', response.status);
    console.log('Shopify GraphQL response:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('HTTP error from Shopify GraphQL:', response.status, response.statusText);
      
      // Handle 401 Unauthorized - need billing permissions
      if (response.status === 401) {
        console.log('HTTP 401 indicates missing billing permissions, redirecting to OAuth');
        return NextResponse.json({
          error: 'EMBEDDED_NEEDS_OAUTH',
          authUrl: generateBillingOAuthUrl(sessionResult.shop || 'unknown'),
          message: 'App needs billing permissions to create subscriptions'
        }, { status: 401 });
      }
      
      return NextResponse.json({
        error: 'BILLING_API_ERROR',
        message: `Shopify API returned ${response.status}: ${response.statusText}`,
        details: result
      }, { status: 400 });
    }

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      
      // Handle specific GraphQL error types
      const errors = Array.isArray(result.errors) ? result.errors : [result.errors];
      const errorMessages = errors.map((e: any) => e.message).join(', ');
      
      // Check for specific billing permission errors
      const hasPermissionError = errors.some((e: any) => 
        e.message && (
          e.message.includes('write_payment_terms') ||
          e.message.includes('billing') ||
          e.message.includes('payment') ||
          e.message.includes('subscription') ||
          e.message.includes('permission') ||
          e.message.includes('access denied')
        )
      );
      
      if (hasPermissionError) {
        console.log('GraphQL error indicates missing billing permissions, redirecting to OAuth');
        return NextResponse.json({
          error: 'EMBEDDED_NEEDS_OAUTH',
          authUrl: generateBillingOAuthUrl(sessionResult.shop || 'unknown'),
          message: 'App needs billing permissions to create subscriptions'
        }, { status: 401 });
      }
      
      // Handle app not published errors
      const hasAppNotPublishedError = errors.some((e: any) => 
        e.message && (
          e.message.includes('published') ||
          e.message.includes('public') ||
          e.message.includes('not available') ||
          e.message.includes('app must be published') ||
          e.message.includes('cannot create subscription')
        )
      );
      
      if (hasAppNotPublishedError) {
        console.log('App not published error detected, enabling test mode');
        
        // In this case, create a mock subscription for testing purposes
        const mockConfirmationUrl = `${process.env.SHOPIFY_APP_URL}/billing/success?shop=${sessionResult.shop}&plan=${planType}&test=true&unpublished=true`;
        
        return NextResponse.json({
          success: true,
          confirmationUrl: mockConfirmationUrl,
          subscriptionId: `test_subscription_${Date.now()}`,
          isTest: true,
          message: 'Test subscription created - app is not yet published for live billing'
        });
      }
      
      return NextResponse.json({
        error: 'BILLING_API_ERROR', 
        message: `Unable to create subscription: ${errorMessages}`,
        details: result.errors
      }, { status: 400 });
    }

    const subscriptionData = result.data?.appSubscriptionCreate;
    
    if (subscriptionData?.userErrors && subscriptionData.userErrors.length > 0) {
      console.error('Subscription creation errors:', subscriptionData.userErrors);
      return NextResponse.json(
        { error: 'Failed to create subscription: ' + subscriptionData.userErrors[0].message },
        { status: 400 }
      );
    }

    if (!subscriptionData?.confirmationUrl) {
      console.error('No confirmation URL returned');
      return NextResponse.json({ 
        error: 'No confirmation URL returned',
        data: subscriptionData
      }, { status: 500 });
    }

    console.log('Subscription created successfully:', {
      subscriptionId: subscriptionData.appSubscription?.id,
      confirmationUrl: subscriptionData.confirmationUrl,
      isTest: subscriptionData.appSubscription?.test
    });

    return NextResponse.json({
      success: true,
      confirmationUrl: subscriptionData.confirmationUrl,
      subscriptionId: subscriptionData.appSubscription?.id,
      isTest: subscriptionData.appSubscription?.test
    });
    
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
