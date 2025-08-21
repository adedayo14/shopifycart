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
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'product-showcase',
    name: 'Product Showcase',
    description: 'Featured product display with enhanced styling and call-to-action buttons',
    category: 'Product Display',
    price: 19,
    isPremium: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'video-pro-2',
    name: 'Video Pro 2',
    description: 'Advanced video section with professional styling and controls',
    category: 'Premium',
    price: 19,
    isPremium: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'scrolling-bar',
    name: 'Scrolling Bar',
    description: 'Animated scrolling text bar for announcements and promotions',
    category: 'Premium',
    price: 19,
    isPremium: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    
    let blocks = []
    
    try {
      // Try to get blocks from database
      let whereClause: any = { isActive: true }
      
      if (category && category !== 'all') {
        whereClause.category = category
      }

      blocks = await prisma.block.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      })
      
      // If no blocks in database, use sample blocks
      if (blocks.length === 0) {
        blocks = sampleBlocks.filter(block => {
          if (category && category !== 'all') {
            return block.category === category && block.isActive
          }
          return block.isActive
        })
      }
    } catch (dbError) {
      console.log('Database error, using sample blocks:', dbError)
      // If database error, use sample blocks
      blocks = sampleBlocks.filter(block => {
        if (category && category !== 'all') {
          return block.category === category && block.isActive
        }
        return block.isActive
      })
    }

    return NextResponse.json({ blocks })
  } catch (error) {
    console.error('Error fetching blocks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blocks' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const block = await prisma.block.create({
      data: body
    })

    return NextResponse.json({ block })
  } catch (error) {
    console.error('Error creating block:', error)
    return NextResponse.json(
      { error: 'Failed to create block' }, 
      { status: 500 }
    )
  }
}
