import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface StoreOwner {
  name: string
  email: string
  shopDomain: string
}

interface AdminStats {
  totalPurchases: number
  totalRevenue: number
  activeSubscriptions: number
  uniqueShops: number
  storeOwners: StoreOwner[]
  recentSubscriptions: any[]
  customBlockRequests: any[]
}

// Helper function to get real store owner info from Shopify
async function getStoreOwnerInfo(shop: string): Promise<StoreOwner | null> {
  try {
    // Get the session for this shop
    const session = await prisma.session.findFirst({
      where: { shop: shop },
      orderBy: { updatedAt: 'desc' }
    })

    if (!session?.accessToken) {
      console.log(`No session found for shop: ${shop}`)
      return null
    }

    const shopQuery = `
      query {
        shop {
          name
          email
          myshopifyDomain
        }
      }
    `

    const response = await fetch(`https://${shop}/admin/api/2023-01/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': session.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: shopQuery
      })
    })

    const result = await response.json()
    
    if (result.data?.shop) {
      return {
        name: result.data.shop.name || shop.replace('.myshopify.com', '').replace('-', ' '),
        email: result.data.shop.email || 'No email provided',
        shopDomain: shop
      }
    }
  } catch (error) {
    console.error('Error fetching store owner info for:', shop, error)
  }
  
  return null
}

export async function GET(request: NextRequest) {
  try {
    // Verify password in header or query
    const password = request.headers.get('authorization')?.replace('Bearer ', '') || 
                    request.nextUrl.searchParams.get('password')
    
    if (password !== 'Adedayo01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get block purchases (this has the price and shop info we need)
    const blockPurchases = await prisma.blockPurchase.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    // Get subscriptions 
    const subscriptions = await prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    // Get custom block requests
    const customBlockRequests = await prisma.customBlockRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    // Calculate statistics
    const totalPurchases = blockPurchases.length
    const totalRevenue = blockPurchases.reduce((sum: number, p: any) => sum + p.price, 0)
    const activeSubscriptions = subscriptions.filter((s: any) => s.status === 'active').length
    
    // Get unique shops
    const uniqueShops = new Set([
      ...blockPurchases.map((p: any) => p.shop),
      ...subscriptions.map((s: any) => s.shop)
    ])

    // Get store owner information for unique shops
    const storeOwners: StoreOwner[] = []
    const uniqueShopsList = Array.from(uniqueShops).slice(0, 20) // Limit to first 20 shops
    
    // Fetch real store owner info from Shopify for each shop
    const storeOwnerPromises = uniqueShopsList.map(async (shop) => {
      const ownerInfo = await getStoreOwnerInfo(shop.toString())
      return ownerInfo
    })
    
    const storeOwnerResults = await Promise.all(storeOwnerPromises)
    
    // Filter out null results and add to storeOwners array
    storeOwnerResults.forEach(owner => {
      if (owner) {
        storeOwners.push(owner)
      }
    })

    const stats: AdminStats = {
      totalPurchases,
      totalRevenue,
      activeSubscriptions,
      uniqueShops: uniqueShops.size,
      storeOwners,
      recentSubscriptions: subscriptions.slice(0, 20),
      customBlockRequests: customBlockRequests.slice(0, 20)
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Admin dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin data' },
      { status: 500 }
    )
  }
}
