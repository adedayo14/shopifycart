import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import blocksConfig from '../../../../config/blocks'

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient()

// Handle Shopify billing webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    // const signature = request.headers.get('x-shopify-hmac-sha256')
    
    // In production, verify webhook signature
    // const isValid = verifyShopifyWebhook(body, signature, process.env.SHOPIFY_WEBHOOK_SECRET)
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const webhook = JSON.parse(body)
    const { topic } = webhook
    
    console.log('Received webhook:', topic, webhook)

    switch (topic) {
      // Billing webhooks
      case 'app_subscriptions/update':
        await handleSubscriptionUpdate(webhook)
        break
      case 'app_purchases_one_time/update':
        await handleOneTimePurchaseUpdate(webhook)
        break
      
      // Compliance webhooks (GDPR requirements)
      case 'customers/data_request':
        await handleCustomerDataRequest(webhook)
        break
      case 'customers/redact':
        await handleCustomerDataErasure(webhook)
        break
      case 'shop/redact':
        await handleShopDataErasure(webhook)
        break
      
      default:
        console.log('Unhandled webhook topic:', topic)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' }, 
      { status: 500 }
    )
  }
}

async function handleSubscriptionUpdate(webhook: any) {
  try {
    const { shop_domain, id, status } = webhook
    
    if (!shop_domain || !id) {
      console.error('Missing required fields in subscription webhook')
      return
    }

    // Update subscription status in database
    await prisma.subscription.updateMany({
      where: { 
        shop: shop_domain,
        chargeId: id.toString()
      },
      data: {
        status: status.toLowerCase(), // active, cancelled, etc.
        updatedAt: new Date()
      }
    })

    // If subscription is active, automatically install ALL blocks
    if (status.toLowerCase() === 'active') {
      try {
        console.log(`Auto-installing all blocks for active subscriber: ${shop_domain}`)
        
        // Get access token from database
        const shopSession = await prisma.session.findFirst({
          where: { 
            shop: shop_domain,
            accessToken: { not: '' }
          },
          orderBy: { updatedAt: 'desc' }
        });

        if (shopSession?.accessToken) {
          // Get ALL block IDs from config
          const allBlockIds = blocksConfig.map(block => block.id);
          
          // Install blocks using the install-blocks functionality
          const installResponse = await fetch(`${process.env.SHOPIFY_APP_URL}/api/install-blocks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              shop: shop_domain,
              blockIds: allBlockIds
            })
          });

          const result = await installResponse.json();
          console.log(`Auto-install result for ${shop_domain}:`, result);
        } else {
          console.warn(`No access token found for shop: ${shop_domain}`);
        }
      } catch (error) {
        console.error(`Error auto-installing blocks for ${shop_domain}:`, error);
      }
    }

    console.log(`Updated subscription ${id} for ${shop_domain} to status: ${status}`)
  } catch (error) {
    console.error('Error handling subscription update:', error)
  }
}

async function handleOneTimePurchaseUpdate(webhook: any) {
  try {
    const { shop_domain, id, status } = webhook
    
    if (!shop_domain || !id) {
      console.error('Missing required fields in one-time purchase webhook')
      return
    }

    // Update purchase status in database
    await prisma.blockPurchase.updateMany({
      where: { 
        shop: shop_domain,
        chargeId: id.toString()
      },
      data: {
        status: status.toLowerCase(), // completed, refunded, etc.
        updatedAt: new Date()
      }
    })

    console.log(`Updated purchase ${id} for ${shop_domain} to status: ${status}`)
  } catch (error) {
    console.error('Error handling one-time purchase update:', error)
  }
}

// Compliance webhook handlers (GDPR requirements)
async function handleCustomerDataRequest(webhook: any) {
  try {
    const { shop_domain, customer } = webhook
    
    console.log(`Customer data request for shop: ${shop_domain}, customer: ${customer?.id}`)
    
    // In a real app, you would:
    // 1. Collect all customer data from your database
    // 2. Format it according to GDPR requirements
    // 3. Send it to Shopify or store it securely
    
    // For now, just log the request
    console.log('Customer data request received:', webhook)
  } catch (error) {
    console.error('Error handling customer data request:', error)
  }
}

async function handleCustomerDataErasure(webhook: any) {
  try {
    const { shop_domain, customer } = webhook
    
    console.log(`Customer data erasure for shop: ${shop_domain}, customer: ${customer?.id}`)
    
    // In a real app, you would:
    // 1. Delete all customer data from your database
    // 2. Anonymize any remaining data
    // 3. Confirm deletion to Shopify
    
    // For now, just log the request
    console.log('Customer data erasure received:', webhook)
  } catch (error) {
    console.error('Error handling customer data erasure:', error)
  }
}

async function handleShopDataErasure(webhook: any) {
  try {
    const { shop_domain } = webhook
    
    console.log(`Shop data erasure for shop: ${shop_domain}`)
    
    // In a real app, you would:
    // 1. Delete all shop data from your database
    // 2. Remove all subscriptions and purchases
    // 3. Clean up any remaining data
    
    // Delete all shop data
    await prisma.subscription.deleteMany({
      where: { shop: shop_domain }
    })
    
    await prisma.blockPurchase.deleteMany({
      where: { shop: shop_domain }
    })
    
    await prisma.session.deleteMany({
      where: { shop: shop_domain }
    })
    
    console.log(`Deleted all data for shop: ${shop_domain}`)
  } catch (error) {
    console.error('Error handling shop data erasure:', error)
  }
}

/* Uncomment for production use:
// Verify Shopify webhook signature
function verifyShopifyWebhook(body: string, signature: string | null, secret: string | undefined): boolean {
  if (!signature || !secret) return false
  
  const crypto = require('crypto')
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body, 'utf8')
  const expectedSignature = hmac.digest('base64')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
*/
