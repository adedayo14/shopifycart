import { NextRequest, NextResponse } from 'next/server'
import { registerMandatoryWebhooks } from '@/lib/webhooks'

// API endpoint to register mandatory compliance webhooks
export async function POST(request: NextRequest) {
  try {
    const { shop, accessToken } = await request.json()

    if (!shop || !accessToken) {
      return NextResponse.json(
        { error: 'Shop and accessToken are required' },
        { status: 400 }
      )
    }

    console.log(`Registering compliance webhooks for shop: ${shop}`)
    const results = await registerMandatoryWebhooks(shop, accessToken)

    const successful = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: failed === 0,
      message: `Registered ${successful} webhooks, ${failed} failed`,
      results,
      webhooks_registered: successful,
      webhooks_failed: failed
    })

  } catch (error) {
    console.error('Error registering webhooks:', error)
    return NextResponse.json(
      { error: 'Failed to register webhooks' },
      { status: 500 }
    )
  }
}

// GET endpoint to check webhook status
export async function GET(request: NextRequest) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.APP_URL || 'https://shopifyapp-weld.vercel.app'

  const webhooks = [
    {
      topic: 'customers/data_request',
      endpoint: `${baseUrl}/api/webhooks/customers/data_request`,
      description: 'Handles customer data requests (GDPR compliance)'
    },
    {
      topic: 'customers/redact', 
      endpoint: `${baseUrl}/api/webhooks/customers/redact`,
      description: 'Handles customer data deletion (GDPR compliance)'
    },
    {
      topic: 'shop/redact',
      endpoint: `${baseUrl}/api/webhooks/shop/redact`, 
      description: 'Handles shop data deletion (when app is uninstalled)'
    }
  ]

  return NextResponse.json({
    message: 'Compliance webhooks configured',
    base_url: baseUrl,
    webhooks,
    webhook_secret_configured: !!process.env.SHOPIFY_WEBHOOK_SECRET,
    next_steps: [
      'Add SHOPIFY_WEBHOOK_SECRET to environment variables',
      'Register these webhooks in Shopify Partner Dashboard',
      'Or call POST /api/register-webhooks with shop and accessToken'
    ]
  })
}
