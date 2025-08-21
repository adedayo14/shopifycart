import { NextRequest, NextResponse } from 'next/server';
import { getShopifySession } from '../../../lib/shopify-session';
import blocksConfig from '../../../config/blocks';

// Fix environment variables in production - inline
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  const correctDatabaseUrl = 'postgres://neondb_owner:npg_K4EJuhNx6bps@ep-soft-unit-adlij0zf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('file:')) {
    console.log('=== FIXING DATABASE_URL IN INSTALL-BLOCKS ===');
    process.env.DATABASE_URL = correctDatabaseUrl;
    console.log('Fixed DATABASE_URL in install-blocks');
  }
}

export const dynamic = 'force-dynamic';

// Generate metafields for all blocks in the config
const BLOCK_METAFIELDS = blocksConfig.reduce((acc, block) => {
  acc[block.id] = `${block.id.replace(/-/g, '_')}_access`;
  return acc;
}, {} as Record<string, string>);

// Block access control - use single metafield with JSON value
const TRIFOLI_ACCESS_METAFIELD = {
  namespace: 'trifoli_blocks',
  key: 'purchased_blocks'
};

export async function POST(request: NextRequest) {
  try {
    console.log('=== INSTALL BLOCKS API ===');
    
    const body = await request.json();
    const { shop, blockIds } = body;
    
    console.log('Installing blocks:', { shop, blockIds });
    
    if (!shop || !blockIds || !Array.isArray(blockIds)) {
      return NextResponse.json(
        { error: 'Shop and blockIds are required' },
        { status: 400 }
      );
    }
    
    // Get access token - try session first, then database fallback
    let accessToken = null;
    
    const sessionResult = await getShopifySession(request);
    
    if (!sessionResult.error && 'accessToken' in sessionResult && sessionResult.accessToken) {
      accessToken = sessionResult.accessToken;
      console.log('Got access token from session');
    } else {
      // Fallback: get access token from database
      const { PrismaClient } = await import('@prisma/client');
      const tempPrisma = new PrismaClient();
      
      try {
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
        { error: 'Unable to install blocks - no access token' },
        { status: 401 }
      );
    }
    
    console.log('Installing blocks for shop:', shop);
    
    // Set metafields for each purchased block
    const results = [];
    
    for (const blockId of blockIds) {
      const metafieldKey = BLOCK_METAFIELDS[blockId as keyof typeof BLOCK_METAFIELDS];
      
      if (!metafieldKey) {
        console.warn('Unknown block ID:', blockId);
        continue;
      }
      
      try {
        const result = await setBlockMetafield(
          shop,
          accessToken,
          metafieldKey,
          true
        );
        
        results.push({
          blockId,
          metafieldKey,
          success: result.success,
          error: result.error
        });
        
        console.log(`Block ${blockId} metafield set:`, result);
        
      } catch (error) {
        console.error(`Error setting metafield for block ${blockId}:`, error);
        results.push({
          blockId,
          metafieldKey,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Always enable the free divider block
    try {
      const dividerResult = await setBlockMetafield(
        shop,
        accessToken,
        BLOCK_METAFIELDS['divider-block'],
        true
      );
      
      if (!results.find(r => r.blockId === 'divider-block')) {
        results.push({
          blockId: 'divider-block',
          metafieldKey: BLOCK_METAFIELDS['divider-block'],
          success: dividerResult.success,
          error: dividerResult.error
        });
      }
    } catch (error) {
      console.error('Error enabling free divider block:', error);
    }

    // Always enable the free padding block
    try {
      const paddingResult = await setBlockMetafield(
        shop,
        accessToken,
        BLOCK_METAFIELDS['padding-block'],
        true
      );
      
      if (!results.find(r => r.blockId === 'padding-block')) {
        results.push({
          blockId: 'padding-block',
          metafieldKey: BLOCK_METAFIELDS['padding-block'],
          success: paddingResult.success,
          error: paddingResult.error
        });
      }
    } catch (error) {
      console.error('Error enabling free padding block:', error);
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      success: true,
      message: `Successfully installed ${successCount} of ${results.length} blocks`,
      results
    });
    
  } catch (error) {
    console.error('Install blocks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to install blocks' },
      { status: 500 }
    );
  }
}

async function setBlockMetafield(shop: string, accessToken: string, metafieldKey: string, value: boolean) {
  try {
    console.log('Setting metafield:', { shop, metafieldKey, value });
    
    // Get the shop's GID first
    const shopQuery = `
      query {
        shop {
          id
        }
      }
    `;
    
    const shopResponse = await fetch(`https://${shop}/admin/api/2023-01/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: shopQuery
      })
    });
    
    const shopResult = await shopResponse.json();
    console.log('Shop query response:', shopResult);
    
    if (shopResult.errors || !shopResult.data?.shop?.id) {
      return {
        success: false,
        error: 'Could not get shop ID: ' + JSON.stringify(shopResult.errors || 'No shop ID')
      };
    }
    
    const shopId = shopResult.data.shop.id;
    
    // Now create or update the shop metafield using GraphQL
    const mutation = `
      mutation CreateShopMetafield($metafield: MetafieldsSetInput!) {
        metafieldsSet(metafields: [$metafield]) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    const variables = {
      metafield: {
        ownerId: shopId,
        namespace: 'trifoli_blocks',
        key: metafieldKey,
        value: value.toString(),
        type: 'boolean'
      }
    };
    
    const response = await fetch(`https://${shop}/admin/api/2023-01/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables
      })
    });
    
    const result = await response.json();
    console.log('Metafield mutation response:', result);
    
    if (result.errors) {
      return {
        success: false,
        error: 'GraphQL errors: ' + JSON.stringify(result.errors)
      };
    }
    
    const metafieldResult = result.data?.metafieldsSet;
    if (metafieldResult?.userErrors && metafieldResult.userErrors.length > 0) {
      return {
        success: false,
        error: 'Metafield errors: ' + JSON.stringify(metafieldResult.userErrors)
      };
    }
    
    return {
      success: true,
      metafield: metafieldResult?.metafields?.[0]
    };
    
  } catch (error) {
    console.error('Error setting metafield:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
