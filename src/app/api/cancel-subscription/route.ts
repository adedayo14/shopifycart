import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { cancelSubscription } from '@/lib/shopify-billing'

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json()
    const shop = request.headers.get('x-shopify-shop-domain') || 'demo-shop.myshopify.com'

    console.log(`Cancelling subscription: ${subscriptionId} for shop: ${shop}`)

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
    }

    try {
      // Cancel subscription using Shopify billing API (with test flag)
      console.log(`Cancelling Shopify subscription: ${subscriptionId}`)
      const cancelResult = await cancelSubscription(subscriptionId, true, shop) // prorate: true
      
      console.log('Cancellation result:', cancelResult)

      // Update subscription status in database
      const updatedSubscription = await prisma.subscription.updateMany({
        where: { 
          shop,
          chargeId: subscriptionId 
        },
        data: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      })

      console.log('Subscription cancelled in database:', updatedSubscription)

      return NextResponse.json({ 
        success: true,
        message: 'Subscription cancelled successfully',
        subscription: cancelResult,
        isTest: cancelResult.test
      })
    } catch (billingError) {
      console.error('Shopify billing cancellation error:', billingError)
      return NextResponse.json({
        error: 'Failed to cancel Shopify subscription',
        message: billingError instanceof Error ? billingError.message : 'Unknown billing error'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Cancellation error:', error)
    return NextResponse.json(
      { error: 'Failed to process cancellation' }, 
      { status: 500 }
    )
  }
}
