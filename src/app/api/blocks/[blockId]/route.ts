import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient()

// Sample blocks data as fallback
const sampleBlocks = [
  {
    id: 'countdown-banner',
    name: 'Countdown Banner',
    description: 'Eye-catching countdown timer for sales, events, and promotions',
    category: 'Marketing',
    price: 14.99,
    isPremium: true,
    isActive: true,
    previewUrl: '/previews/countdown-banner.png'
  },
  {
    id: 'video-hero',
    name: 'Video Hero',
    description: 'Professional video hero section with overlay text and call-to-action',
    category: 'Content',
    price: 14.99,
    isPremium: true,
    isActive: true,
    previewUrl: '/previews/video-hero.png'
  },
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    description: 'Beautiful product display with multiple layout options',
    category: 'Product Display',
    price: 14.99,
    isPremium: true,
    isActive: true,
    previewUrl: '/previews/product-showcase.png'
  }
]

export async function GET(
  request: NextRequest,
  { params }: { params: { blockId: string } }
) {
  try {
    const blockId = params.blockId

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

    return NextResponse.json({ 
      success: true,
      block 
    })

  } catch (error) {
    console.error('Error fetching block:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
