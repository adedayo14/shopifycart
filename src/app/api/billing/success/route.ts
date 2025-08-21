import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession } from '../../../../lib/shopify-session';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN BILLING SUCCESS ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in billing success');
  }
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('=== BILLING SUCCESS API ===');
    
    const body = await request.json();
    const { shop, charge_id, blocks, plan } = body;
    
    console.log('Processing billing success:', { shop, charge_id, blocks, plan });
    
    if (!shop) {
      return NextResponse.json(
        { error: 'Shop parameter is required' },
        { status: 400 }
      );
    }
    
    if (!charge_id) {
      return NextResponse.json(
        { error: 'Charge ID is required' },
        { status: 400 }
      );
    }
    
    // For billing success, we need to get the access token from the database
    // since this comes from Shopify redirect, not from an authenticated session
    console.log('Getting access token for shop:', shop);
    
    let accessToken = null;
    
    // Try to get session first (in case it exists)
    const sessionResult = await getShopifySession(request);
    
    if (!sessionResult.error && 'accessToken' in sessionResult && sessionResult.accessToken) {
      accessToken = sessionResult.accessToken;
      console.log('Got access token from session');
    } else {
      // Fallback: get access token from database
      const { PrismaClient } = await import('@prisma/client');
      const tempPrisma = new PrismaClient();
      
      try {
        // Look for any valid session for this shop
        const shopSession = await tempPrisma.session.findFirst({
          where: { 
            shop: shop,
            accessToken: { not: '' }
          },
          orderBy: { updatedAt: 'desc' }
        });
        
        if (shopSession?.accessToken) {
          accessToken = shopSession.accessToken;
          console.log('Got access token from database');
        }
      } catch (dbError) {
        console.error('Error getting access token from database:', dbError);
      } finally {
        await tempPrisma.$disconnect();
      }
    }
    
    if (!accessToken) {
      console.error('No access token available for shop:', shop);
      return NextResponse.json(
        { error: 'Unable to verify purchase - no access token' },
        { status: 401 }
      );
    }
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      if (blocks && charge_id) {
        // Handle block purchase
        const blockIds = blocks.split(',');
        console.log('Processing block purchase:', blockIds);
        
        // Verify the charge with Shopify first
        const verifyResult = await verifyShopifyCharge(shop, accessToken, charge_id);
        
        if (!verifyResult.success) {
          console.error('Charge verification failed:', verifyResult.error);
          return NextResponse.json(
            { error: 'Purchase verification failed' },
            { status: 400 }
          );
        }
        
        console.log('Charge verified successfully:', verifyResult.charge);
        
        // Save purchases to database
        const purchases = [];
        
        for (const blockId of blockIds) {
          // First try to save to Purchase table (with block relation)
          try {
            const purchase = await prisma.purchase.create({
              data: {
                shopDomain: shop,
                blockId: blockId,
                purchaseType: blockIds.length === 1 ? 'single-block' : 
                             blockIds.length === 3 ? 'pick-and-mix' : 'individual',
                status: 'completed',
                chargeId: charge_id
              }
            });
            purchases.push(purchase);
            console.log('Saved purchase to Purchase table:', purchase.id);
          } catch (purchaseError) {
            console.log('Purchase table failed, trying BlockPurchase table:', purchaseError);
            
            // Fallback to BlockPurchase table
            const blockPurchase = await prisma.blockPurchase.create({
              data: {
                shop: shop,
                blockId: blockId,
                blockName: `Block ${blockId}`, // You might want to get the actual name
                price: verifyResult.charge?.price || 0,
                status: 'completed',
                chargeId: charge_id
              }
            });
            purchases.push(blockPurchase);
            console.log('Saved purchase to BlockPurchase table:', blockPurchase.id);
          }
        }
        
        await prisma.$disconnect();
        
        // After successfully recording the purchase, install the blocks to the theme
        console.log('Installing purchased blocks to theme...');
        try {
          const { installBlocksForShop } = await import('../../../../lib/install-blocks');
          const installResult = await installBlocksForShop(shop, accessToken);
          console.log('Block installation result:', installResult);
          
        } catch (installError) {
          console.error('Failed to install blocks to theme:', installError);
          // Don't fail the whole request if installation fails
        }
        
        return NextResponse.json({
          success: true,
          message: `Successfully recorded ${blockIds.length} block purchase(s)`,
          purchases: purchases.length,
          charge: verifyResult.charge
        });
        
      } else if (plan && charge_id) {
        // Handle subscription purchase
        console.log('Processing subscription:', plan);
        
        // Verify the subscription charge with Shopify
        const verifyResult = await verifyShopifySubscription(shop, accessToken, charge_id);
        
        if (!verifyResult.success) {
          console.error('Subscription verification failed:', verifyResult.error);
          return NextResponse.json(
            { error: 'Subscription verification failed' },
            { status: 400 }
          );
        }
        
        console.log('Subscription verified:', verifyResult.charge);
        
        // Create subscription record in Subscription table
        try {
          const subscriptionData = {
            shop: shop,
            planType: plan, // 'annual-access' or 'monthly-access'
            status: 'active',
            chargeId: charge_id,
            currentPeriodStart: new Date(),
            currentPeriodEnd: plan === 'annual-access' 
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month from now
          };
          
          console.log('Creating subscription record:', subscriptionData);
          
          // First try to update existing subscription, then create new one
          const existingSubscription = await prisma.subscription.findFirst({
            where: { shop: shop }
          });
          
          let subscriptionRecord;
          if (existingSubscription) {
            console.log('Updating existing subscription:', existingSubscription.id);
            subscriptionRecord = await prisma.subscription.update({
              where: { id: existingSubscription.id },
              data: subscriptionData
            });
          } else {
            console.log('Creating new subscription record');
            subscriptionRecord = await prisma.subscription.create({
              data: subscriptionData
            });
          }
          
          console.log('✅ Subscription record created/updated:', subscriptionRecord.id);
          
        } catch (subscriptionError) {
          console.error('Error creating subscription record:', subscriptionError);
          // Don't fail the whole request, but log the error
        }
        
        // For subscription, give access to ALL paid blocks (price > 0)
        const blocksConfig = await import('../../../../config/blocks');
        const allBlockIds = blocksConfig.default
          .filter(block => block.price > 0 && block.isActive)
          .map(block => block.id); // All paid blocks from config
        
        console.log('Paid blocks from config:', allBlockIds);
        
        try {
          // Save subscription record to Purchase table with all blocks
          const subscriptionPurchases = [];
          
          for (const blockId of allBlockIds) {
            const purchase = await prisma.purchase.create({
              data: {
                shopDomain: shop,
                blockId: blockId,
                purchaseType: 'subscription',
                status: 'completed',
                chargeId: charge_id
              }
            }).catch(async (error) => {
              // Fallback to BlockPurchase table
              console.log(`Saving ${blockId} to BlockPurchase table:`, error.message);
              return await prisma.blockPurchase.create({
                data: {
                  shop: shop,
                  blockId: blockId,
                  blockName: blockId.split('-').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' '),
                  price: 0, // Included in subscription
                  status: 'completed',
                  chargeId: charge_id
                }
              });
            });
            
            subscriptionPurchases.push(purchase);
          }
          
          console.log(`Created ${subscriptionPurchases.length} subscription block records`);
          
          // AUTO-INSTALL: Install ALL blocks to theme metafields immediately
          console.log('🚀 AUTO-INSTALLING all blocks for subscription user...');
          
          try {
            // Import blocks config to get all block IDs
            const blocksConfig = await import('../../../../config/blocks');
            const allBlocks = blocksConfig.default.map(block => block.id);
            
            // Call install-blocks API internally 
            const installResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://shopifyapp-weld.vercel.app'}/api/install-blocks`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                shop: shop,
                blockIds: allBlocks
              })
            });
            
            const installResult = await installResponse.json();
            
            if (installResult.success) {
              console.log(`✅ AUTO-INSTALL SUCCESS: ${installResult.message}`);
              console.log('Installed blocks:', installResult.results?.filter(r => r.success).map(r => r.blockId));
            } else {
              console.error('❌ AUTO-INSTALL FAILED:', installResult.error);
            }
            
          } catch (installError) {
            console.error('❌ AUTO-INSTALL ERROR:', installError);
          }
          
        } catch (error) {
          console.error('Error saving subscription:', error);
        }
        
        await prisma.$disconnect();
        
        return NextResponse.json({
          success: true,
          message: `Successfully recorded ${plan} subscription`,
          charge: verifyResult.charge
        });
        
      } else {
        await prisma.$disconnect();
        return NextResponse.json(
          { error: 'Invalid billing parameters - missing blocks/plan or charge_id' },
          { status: 400 }
        );
      }
      
    } catch (dbError) {
      console.error('Database error in billing success:', dbError);
      await prisma.$disconnect();
      return NextResponse.json(
        { error: 'Failed to record purchase' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Billing success API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process billing success' },
      { status: 500 }
    );
  }
}

async function verifyShopifyCharge(shop: string, accessToken: string, chargeId: string) {
  try {
    console.log('Verifying Shopify charge:', { shop, chargeId });
    
    // First try to get the charge using the REST API which is more reliable for application charges
    const restUrl = `https://${shop}/admin/api/2023-01/application_charges/${chargeId}.json`;
    
    console.log('Trying REST API:', restUrl);
    
    const restResponse = await fetch(restUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      }
    });
    
    const restResult = await restResponse.json();
    console.log('REST API response:', restResult);
    
    if (restResult.application_charge) {
      const charge = restResult.application_charge;
      return {
        success: true,
        charge: {
          id: charge.id,
          name: charge.name,
          price: charge.price,
          status: charge.status,
          test: charge.test,
          createdAt: charge.created_at
        }
      };
    }
    
    // If REST API fails, try GraphQL with proper node ID format
    console.log('REST API failed, trying GraphQL...');
    
    // Format the charge ID as a proper GraphQL node ID
    const nodeId = `gid://shopify/AppPurchaseOneTime/${chargeId}`;
    
    const query = `
      query GetAppPurchaseOneTime($id: ID!) {
        node(id: $id) {
          ... on AppPurchaseOneTime {
            id
            name
            price {
              amount
              currencyCode
            }
            status
            test
            createdAt
          }
        }
      }
    `;
    
    const response = await fetch(`https://${shop}/admin/api/2023-01/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { id: nodeId }
      })
    });
    
    const result = await response.json();
    console.log('GraphQL charge verification response:', result);
    
    if (result.errors) {
      return {
        success: false,
        error: 'Shopify GraphQL API error: ' + JSON.stringify(result.errors)
      };
    }
    
    const charge = result.data?.node;
    if (!charge) {
      return {
        success: false,
        error: 'Charge not found with ID: ' + nodeId
      };
    }
    
    return {
      success: true,
      charge
    };
    
  } catch (error) {
    console.error('Error verifying Shopify charge:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function verifyShopifySubscription(shop: string, accessToken: string, chargeId: string) {
  try {
    console.log('Verifying Shopify subscription:', { shop, chargeId });
    
    // Try recurring application charge API for subscriptions
    const subscriptionUrl = `https://${shop}/admin/api/2023-01/recurring_application_charges/${chargeId}.json`;
    
    console.log('Trying subscription REST API:', subscriptionUrl);
    
    const response = await fetch(subscriptionUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      }
    });
    
    const result = await response.json();
    console.log('Subscription REST API response:', result);
    
    if (result.recurring_application_charge) {
      const charge = result.recurring_application_charge;
      return {
        success: true,
        charge: {
          id: charge.id,
          name: charge.name,
          price: charge.price,
          status: charge.status,
          test: charge.test,
          createdAt: charge.created_at
        }
      };
    }
    
    // If not found, return error
    return {
      success: false,
      error: 'Subscription charge not found with ID: ' + chargeId
    };
    
  } catch (error) {
    console.error('Error verifying Shopify subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
