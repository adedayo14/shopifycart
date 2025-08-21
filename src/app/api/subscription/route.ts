import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession } from '@/lib/shopify-session';
import { createSubscription } from '@/lib/shopify-billing';
import { GraphQLClient } from 'graphql-request';

export async function POST(request: NextRequest) {
  try {
    console.log('=== SUBSCRIPTION API CALLED ===');
    
    const body = await request.json();
    const { planType, shop } = body;
    
    console.log('Subscription request:', { planType, shop });

    // Get the Shopify session with real access token
    const session = await getShopifySession(request);
    
    if (!session?.accessToken) {
      console.error('No valid session or access token found');
      return NextResponse.json({ 
        error: 'No valid Shopify session found. Please reinstall the app.' 
      }, { status: 401 });
    }

    console.log('Using session for shop:', session.shop);

    // Create GraphQL client with the real access token
    const client = new GraphQLClient(`https://${session.shop}/admin/api/2023-10/graphql.json`, {
      headers: {
        'X-Shopify-Access-Token': session.accessToken,
        'Content-Type': 'application/json',
      },
    });

    // Create the subscription using real Shopify billing
    const subscriptionResult = await createSubscription(client, {
      name: `Trifoli Blocks - ${planType} Plan`,
      planType: planType,
      returnUrl: `${process.env.SHOPIFY_APP_URL}/billing/confirm?plan=${planType}&shop=${session.shop}`
    });

    console.log('Shopify subscription result:', subscriptionResult);

    if (subscriptionResult.appSubscriptionCreate?.userErrors?.length > 0) {
      const errors = subscriptionResult.appSubscriptionCreate.userErrors;
      console.error('Shopify subscription errors:', errors);
      return NextResponse.json({ 
        error: 'Subscription creation failed',
        details: errors.map((e: any) => e.message).join(', ')
      }, { status: 400 });
    }

    const subscription = subscriptionResult.appSubscriptionCreate?.appSubscription;
    const confirmationUrl = subscriptionResult.appSubscriptionCreate?.confirmationUrl;

    if (!confirmationUrl) {
      console.error('No confirmation URL returned from Shopify');
      return NextResponse.json({ 
        error: 'Failed to create subscription - no confirmation URL' 
      }, { status: 500 });
    }

    console.log('Subscription created successfully:', {
      subscriptionId: subscription?.id,
      confirmationUrl
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription?.id,
      confirmationUrl,
      message: 'Subscription created successfully'
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
