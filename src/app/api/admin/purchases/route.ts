import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Simple password protection (you can make this more secure)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader !== 'Bearer admin123') {
      // For now, we'll skip auth in development
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Inline environment fix for database connection
    const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:ksIhKzSLxFDp@ep-weathered-lake-a52drvjh.us-east-2.aws.neon.tech/neondb?sslmode=require';
    process.env.DATABASE_URL = DATABASE_URL;

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Fetch all purchases with shop information
    const purchases = await prisma.blockPurchase.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      purchases: purchases.map(purchase => ({
        id: purchase.id,
        shop: purchase.shop,
        blockId: purchase.blockId,
        blockName: purchase.blockName,
        price: purchase.price,
        status: purchase.status,
        email: purchase.email,
        createdAt: purchase.createdAt.toISOString()
      }))
    });

  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin data' },
      { status: 500 }
    );
  }
}
