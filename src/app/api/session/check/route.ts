import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');
    
    if (!shop) {
      return NextResponse.json({
        success: false,
        error: 'missing_shop',
        message: 'Shop parameter is required'
      }, { status: 400 });
    }
    
    console.log('Checking session for shop:', shop);
    
    // Check if shop exists in database
    const shopRecord = await prisma.shop.findUnique({
      where: { domain: shop }
    });
    
    if (!shopRecord) {
      console.log('Shop not found in database:', shop);
      return NextResponse.json({
        success: false,
        requiresInstallation: true,
        message: 'App not installed for this shop',
        embedded: false
      });
    }
    
    // Check if we have a valid access token
    const hasValidSession = !!shopRecord.accessToken;
    
    // Check if this is an embedded app request
    const idToken = request.headers.get('X-Shopify-ID-Token');
    const isEmbedded = !!idToken;
    
    // Check for active subscription
    let subscription = null;
    let hasSubscription = false;
    
    try {
      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          shop: shop,
          status: 'active'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (activeSubscription) {
        hasSubscription = true;
        subscription = {
          id: activeSubscription.id,
          planType: activeSubscription.planType,
          status: activeSubscription.status,
          currentPeriodEnd: activeSubscription.currentPeriodEnd
        };
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      // Don't fail the whole request if subscription check fails
    }
    
    return NextResponse.json({
      success: hasValidSession,
      requiresInstallation: !hasValidSession,
      hasSubscription,
      subscription,
      embedded: isEmbedded,
      shop,
      scope: shopRecord.scope || ''
    });
    
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({
      success: false,
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Failed to check session'
    }, { status: 500 });
  }
} 