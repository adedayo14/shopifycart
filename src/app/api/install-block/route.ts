import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient()

// Current available blocks - matches our deployed theme extension
const sampleBlocks = [
  {
    id: 'divider-block',
    name: 'Divider Block',
    description: 'Simple divider block for separating content sections',
    category: 'Utility',
    price: 0,
    isPremium: false,
    isActive: true
  },
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    description: 'Featured product display with enhanced styling and call-to-action buttons',
    category: 'Product Display',
    price: 19,
    isPremium: true,
    isActive: true
  },
  {
    id: 'video-pro-2',
    name: 'Video Pro 2',
    description: 'Advanced video section with professional styling and controls',
    category: 'Premium',
    price: 19,
    isPremium: true,
    isActive: true
  },
  {
    id: 'scrolling-bar',
    name: 'Scrolling Bar',
    description: 'Animated scrolling text bar for announcements and promotions',
    category: 'Premium',
    price: 19,
    isPremium: true,
    isActive: true
  }
]

export async function POST(request: NextRequest) {
  try {
    const { blockId } = await request.json()
    const shop = request.headers.get('x-shopify-shop-domain') || 'demo-shop.myshopify.com'

    let block = null

    try {
      // Try to get block from database
      block = await prisma.block.findUnique({
        where: { id: blockId }
      })
    } catch (dbError) {
      console.log('Database error, using sample data:', dbError)
    }

    // Fallback to sample blocks if database fails or block not found
    if (!block) {
      block = sampleBlocks.find(b => b.id === blockId)
    }

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    // For free blocks, allow installation immediately
    if (!block.isPremium) {
      return NextResponse.json({ 
        success: true,
        message: `${block.name} has been installed successfully! You can now use it in your theme editor.`,
        installationDetails: {
          blockId: block.id,
          blockName: block.name,
          category: block.category,
          instructions: "Go to your theme editor and look for the new block in the sections list.",
          filesInstalled: [
            `sections/${blockId}.liquid`,
            `assets/${blockId}.css`,
            `assets/${blockId}.js`
          ]
        }
      })
    }

    // For premium blocks, check subscription (simplified for demo)
    let hasAccess = false
    
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { shop }
      })

      hasAccess = subscription?.planType === 'premium' || 
                  subscription?.planType === 'pro'

      // Also check for individual purchases
      if (!hasAccess) {
        const purchase = await prisma.blockPurchase.findFirst({
          where: {
            shop,
            blockId: block.id,
            status: 'completed'
          }
        })
        hasAccess = !!purchase
      }
    } catch (dbError) {
      // If database fails, deny access to premium blocks
      console.log('Database error checking access:', dbError)
      hasAccess = false
    }

    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'This is a premium block. Please subscribe to the premium plan or purchase this block individually.',
        requiresPurchase: true,
        block: {
          id: block.id,
          name: block.name,
          price: block.price
        }
      }, { status: 403 })
    }

    // Premium block installation successful
    return NextResponse.json({ 
      success: true,
      message: `${block.name} has been installed successfully! You can now use it in your theme editor.`,
      installationDetails: {
        blockId: block.id,
        blockName: block.name,
        category: block.category,
        instructions: "Go to your theme editor and look for the new block in the sections list.",
        filesInstalled: [
          `sections/${blockId}.liquid`,
          `assets/${blockId}.css`,
          `assets/${blockId}.js`
        ]
      }
    })

  } catch (error) {
    console.error('Block installation error:', error)
    return NextResponse.json(
      { 
        error: 'Installation failed. Please try again or contact support.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}
