import { NextRequest, NextResponse } from 'next/server'
import { getShopifySession, prisma } from '@/lib/shopify-session'
// import { cancelSubscription } from '@/lib/shopify-billing' // For production use

export const dynamic = 'force-dynamic';

// Get user's current subscription status
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const shop = url.searchParams.get('shop') || request.headers.get('x-shopify-shop-domain')

    console.log('=== SUBSCRIPTION MANAGEMENT API DEBUG ===');
    console.log('Shop from query params:', url.searchParams.get('shop'));
    console.log('Shop from headers:', request.headers.get('x-shopify-shop-domain'));
    console.log('Final shop value:', shop);
    console.log('Database URL available:', !!process.env.DATABASE_URL);

    if (!shop) {
      console.error('❌ No shop parameter provided');
      return NextResponse.json({ 
        error: 'Shop parameter is required',
        hasSubscription: false,
        subscription: null 
      }, { status: 400 })
    }

    // Get subscription from database
    console.log('🔍 Searching for subscription with shop:', shop);
    
    // First, let's see what shops are actually in the database
    const allSubscriptions = await prisma.subscription.findMany({
      select: { shop: true, planType: true, status: true }
    })
    console.log('📊 All subscriptions in database:', allSubscriptions);
    
    const subscription = await prisma.subscription.findFirst({
      where: { shop: shop }
    })

    console.log('📊 Database query result:', {
      found: !!subscription,
      id: subscription?.id,
      planType: subscription?.planType,
      status: subscription?.status,
      shop: subscription?.shop
    });

    if (!subscription) {
      console.log('❌ No subscription found in database for shop:', shop);
      return NextResponse.json({ 
        hasSubscription: false,
        subscription: null 
      })
    }

    console.log('✅ Subscription found, returning data');
    // In production, this would also check with Shopify to ensure subscription is still active
    return NextResponse.json({ 
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        planType: subscription.planType,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        chargeId: subscription.chargeId
      }
    })
  } catch (error) {
    console.error('❌ Subscription status error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set'
    });
    return NextResponse.json(
      { error: 'Failed to get subscription status', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// Cancel subscription
export async function DELETE(request: NextRequest) {
  try {
    const { subscriptionId, shop } = await request.json()
    
    console.log('Subscription cancellation request:', { subscriptionId, shop });
    
    if (!subscriptionId || !shop) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // In production, this would call Shopify's billing.cancel() function
    // const shopifyResult = await cancelSubscription(subscriptionId, true)
    // For now, we'll update the database and return a mock response
    
    // Get the subscription first
    const subscription = await prisma.subscription.findFirst({
      where: { shop: shop, status: 'active' }
    });

    if (!subscription) {
      return NextResponse.json({
        success: false,
        error: 'No active subscription found for this shop'
      }, { status: 404 });
    }

    const cancelledSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    })

    // Mock Shopify cancellation response
    const mockShopifyResponse = {
      id: subscriptionId,
      name: cancelledSubscription.planType,
      status: 'CANCELLED',
      currentPeriodEnd: cancelledSubscription.currentPeriodEnd,
      createdAt: cancelledSubscription.createdAt
    }

    return NextResponse.json({ 
      success: true,
      subscription: mockShopifyResponse,
      message: 'Subscription cancelled successfully. You will retain access until the end of your current billing period.'
    })
  } catch (error) {
    console.error('Cancellation error:', error)
    console.error('Cancellation error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to cancel subscription', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
}
