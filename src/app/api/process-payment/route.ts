import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { blockId, shop, amount, paymentMethod } = await request.json()

    // Validate input
    if (!blockId || !shop || !amount) {
      return NextResponse.json(
        { error: 'Missing required payment parameters' }, 
        { status: 400 }
      )
    }

    // Get block details
    const block = await prisma.block.findUnique({
      where: { id: blockId }
    })

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    // In production, this is where you would:
    // 1. Process payment with Shopify Billing API, Stripe, or other payment processor
    // 2. Verify payment status
    // 3. Handle webhooks for payment confirmation
    // 4. Create purchase record only after successful payment

    // For demo purposes, simulate successful payment processing
    if (paymentMethod === 'demo') {
      // Check if this block is already purchased to prevent duplicates
      const existingPurchase = await prisma.blockPurchase.findFirst({
        where: {
          shop,
          blockId: block.id
        }
      });
      
      if (existingPurchase) {
        return NextResponse.json({ 
          success: false,
          error: 'ALREADY_PURCHASED',
          message: `You have already purchased "${block.name}".`,
          purchase: existingPurchase
        }, { status: 409 });
      }
      
      // Create completed purchase record
      const purchase = await prisma.blockPurchase.create({
        data: {
          shop,
          blockId: block.id,
          blockName: block.name,
          price: amount,
          status: 'completed',
          chargeId: `demo_charge_${Date.now()}`,
          email: `owner@${shop}` // Mock email for demo
        }
      })

      return NextResponse.json({ 
        success: true,
        purchase,
        message: `Payment successful! You have purchased "${block.name}" for $${amount}.`
      })
    }

    // In production, handle real payment methods here
    switch (paymentMethod) {
      case 'shopify':
        // Integrate with Shopify Billing API
        // const chargeResult = await shopifyBilling.createCharge(...)
        break
      
      case 'stripe':
        // Integrate with Stripe API
        // const paymentIntent = await stripe.paymentIntents.create(...)
        break
      
      default:
        return NextResponse.json(
          { error: 'Unsupported payment method' }, 
          { status: 400 }
        )
    }

    return NextResponse.json(
      { error: 'Payment method not implemented' }, 
      { status: 501 }
    )

  } catch (error) {
    console.error('Payment processing error:', error)
    return NextResponse.json(
      { error: 'Payment processing failed' }, 
      { status: 500 }
    )
  }
}
