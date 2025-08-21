import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Webhook endpoint for customer data requests (GDPR compliance)
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
    console.log('Customer data request webhook received:', {
      shop,
      customer_id: payload.customer?.id,
      orders_requested: payload.orders_requested?.length || 0
    })

    // TODO: Implement your data request logic here
    // This is where you would:
    // 1. Collect all customer data from your database
    // 2. Format it according to the data request
    // 3. Provide it to the customer (usually via email or secure download)

    // Example of data you might need to collect:
    const customerData = {
      customer_id: payload.customer?.id,
      email: payload.customer?.email,
      orders: payload.orders_requested || [],
      // Add any custom data you store about the customer
      custom_data: {
        // Example: purchases from your app
        // block_purchases: await getCustomerBlockPurchases(payload.customer?.id),
        // subscription_data: await getCustomerSubscriptionData(payload.customer?.id)
      }
    }

    // Log the data request for compliance records
    console.log('Customer data request processed:', {
      shop,
      customer_id: payload.customer?.id,
      timestamp: new Date().toISOString(),
      data_provided: Object.keys(customerData)
    })

    // Respond with success
    return NextResponse.json({ 
      message: 'Customer data request processed successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing customer data request webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}
