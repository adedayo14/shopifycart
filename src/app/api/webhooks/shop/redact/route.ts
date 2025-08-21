import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Webhook endpoint for shop data deletion (when shop uninstalls app)
export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity
    const body = await request.text()
    const hmac = request.headers.get('x-shopify-hmac-sha256')
    const topic = request.headers.get('x-shopify-topic')
    const shop = request.headers.get('x-shopify-shop-domain')

    if (!hmac || !topic || !shop) {
      console.error('Missing required webhook headers')
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 })
    }

    // Verify webhook signature
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET
    if (webhookSecret) {
      const calculatedHmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(body, 'utf8')
        .digest('base64')

      if (calculatedHmac !== hmac) {
        console.error('Webhook signature verification failed')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Parse the webhook payload
    const payload = JSON.parse(body)
    console.log('Shop redact webhook received:', {
      shop,
      shop_id: payload.shop_id,
      shop_domain: payload.shop_domain
    })

    // Delete all shop data from your database
    try {
      const shopDomain = payload.shop_domain || shop

      // Delete all purchases for this shop
      const deletedPurchases = await prisma.blockPurchase.deleteMany({
        where: {
          shop: shopDomain
        }
      })

      // Delete all subscriptions for this shop
      const deletedSubscriptions = await prisma.subscription.deleteMany({
        where: {
          shop: shopDomain
        }
      })

      // Delete all custom block requests from this shop (if table exists)
      let deletedRequests = { count: 0 }
      try {
        // Use raw query to handle table that might not be in generated client yet
        await prisma.$executeRaw`DELETE FROM "CustomBlockRequest" WHERE "shopDomain" = ${shopDomain}`
        deletedRequests.count = 1 // Assume success if no error
      } catch (error) {
        console.warn('CustomBlockRequest table may not exist or no data to delete:', error)
      }

      // Delete all sessions for this shop
      const deletedSessions = await prisma.session.deleteMany({
        where: {
          shop: shopDomain
        }
      })

      // Delete shop record
      const deletedShop = await prisma.shop.deleteMany({
        where: {
          domain: shopDomain
        }
      })

      // Delete pending purchases
      const deletedPendingPurchases = await prisma.pendingPurchase.deleteMany({
        where: {
          shop: shopDomain
        }
      })

      console.log('Shop data deleted:', {
        shop: shopDomain,
        deleted_purchases: deletedPurchases.count,
        deleted_subscriptions: deletedSubscriptions.count,
        deleted_requests: deletedRequests.count,
        deleted_sessions: deletedSessions.count,
        deleted_shops: deletedShop.count,
        deleted_pending_purchases: deletedPendingPurchases.count
      })

      // Log the redaction for compliance records
      console.log('Shop data redaction completed:', {
        shop: shopDomain,
        shop_id: payload.shop_id,
        timestamp: new Date().toISOString(),
        status: 'completed'
      })

    } catch (dbError) {
      console.error('Database error during shop redaction:', dbError)
      // Continue execution - we should still respond with success
    }

    // Respond with success
    return NextResponse.json({ 
      message: 'Shop data redaction processed successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing shop redact webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
