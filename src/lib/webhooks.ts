import { PrismaClient } from '@prisma/client'

// Webhook configuration for compliance
export const MANDATORY_WEBHOOKS = [
  {
    topic: 'customers/data_request',
    address: '/api/webhooks/customers/data_request',
    description: 'Handle customer data requests (GDPR)'
  },
  {
    topic: 'customers/redact',
    address: '/api/webhooks/customers/redact', 
    description: 'Handle customer data deletion (GDPR)'
  },
  {
    topic: 'shop/redact',
    address: '/api/webhooks/shop/redact',
    description: 'Handle shop data deletion (when app is uninstalled)'
  }
]

// Helper function to register webhooks programmatically
export async function registerMandatoryWebhooks(shop: string, accessToken: string) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.APP_URL || 'https://shopifyapp-weld.vercel.app'

  const results = []

  for (const webhook of MANDATORY_WEBHOOKS) {
    try {
      const response = await fetch(`https://${shop}/admin/api/2023-10/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: {
            topic: webhook.topic,
            address: `${baseUrl}${webhook.address}`,
            format: 'json'
          }
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        console.log(`✅ Registered webhook: ${webhook.topic}`)
        results.push({ topic: webhook.topic, status: 'success', data })
      } else {
        console.error(`❌ Failed to register webhook: ${webhook.topic}`, data)
        results.push({ topic: webhook.topic, status: 'error', error: data })
      }
    } catch (error) {
      console.error(`❌ Error registering webhook: ${webhook.topic}`, error)
      results.push({ topic: webhook.topic, status: 'error', error })
    }
  }

  return results
}

// Helper function to verify webhook signature
export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.warn('No webhook secret configured - skipping signature verification')
    return true // Allow webhooks in development
  }

  const crypto = require('crypto')
  const calculatedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64')

  return calculatedSignature === signature
}

// Helper function to log webhook events for compliance
export async function logWebhookEvent(
  topic: string,
  shop: string,
  payload: any,
  action: 'processed' | 'failed' = 'processed'
) {
  try {
    console.log(`Webhook Event Logged:`, {
      topic,
      shop,
      action,
      timestamp: new Date().toISOString(),
      payload_keys: Object.keys(payload)
    })
    
    // You could also store this in a dedicated compliance log table
    // const prisma = new PrismaClient()
    // await prisma.webhookLog.create({
    //   data: {
    //     topic,
    //     shop,
    //     action,
    //     payload: JSON.stringify(payload),
    //     timestamp: new Date()
    //   }
    // })
    
  } catch (error) {
    console.error('Failed to log webhook event:', error)
  }
}
