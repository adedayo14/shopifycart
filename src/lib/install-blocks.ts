import blocksConfig from '../config/blocks';

// Generate metafields for all blocks in the config
const BLOCK_METAFIELDS = blocksConfig.reduce((acc, block) => {
  acc[block.id] = {
    namespace: 'trifoli_blocks',
    key: `${block.id.replace(/-/g, '_')}_access`
  };
  return acc;
}, {} as Record<string, { namespace: string; key: string }>);

async function setBlockMetafields(shop: string, accessToken: string, availableBlocks: string[]) {
  try {
    console.log('Setting individual block metafields:', { shop, availableBlocks });
    
    // Get the app's GID first
    const appQuery = `
      query {
        currentAppInstallation {
          id
        }
      }
    `;
    
    const appResponse = await fetch(`https://${shop}/admin/api/2023-01/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: appQuery
      })
    });
    
    const appResult = await appResponse.json();
    console.log('App query response:', appResult);
    
    if (appResult.errors || !appResult.data?.currentAppInstallation?.id) {
      return {
        success: false,
        error: 'Could not get app installation ID: ' + JSON.stringify(appResult.errors || 'No app ID')
      };
    }
    
    const appId = appResult.data.currentAppInstallation.id;
    
    // Create metafields for each block
    const metafieldsToSet: any[] = [];
    
    Object.keys(BLOCK_METAFIELDS).forEach(blockId => {
      const metafield = BLOCK_METAFIELDS[blockId as keyof typeof BLOCK_METAFIELDS];
      const hasAccess = availableBlocks.includes(blockId);
      
      metafieldsToSet.push({
        ownerId: appId,
        namespace: metafield.namespace,
        key: metafield.key,
        value: hasAccess.toString(),
        type: 'boolean'
      });
    });
    
    // Set all metafields at once
    const mutation = `
      mutation CreateAppMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
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
      metafields: metafieldsToSet
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
    console.log('Metafields mutation response:', JSON.stringify(result, null, 2));
    
    if (result.errors) {
      return {
        success: false,
        error: 'GraphQL errors: ' + JSON.stringify(result.errors)
      };
    }
    
    if (result.data?.metafieldsSet?.userErrors?.length > 0) {
      return {
        success: false,
        error: 'User errors: ' + JSON.stringify(result.data.metafieldsSet.userErrors)
      };
    }
    
    return {
      success: true,
      data: result.data?.metafieldsSet?.metafields
    };
  } catch (error) {
    console.error('Error setting block metafields:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function installBlocksForShop(shop: string, accessToken: string): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    console.log('Installing blocks for shop:', shop);

    // Get all purchased blocks and subscription status from database
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      // Check for active subscription first - look in subscription table
      const activeSubscription = await prisma.subscription.findFirst({
        where: { 
          shop: shop,
          status: 'active'
        },
        orderBy: { createdAt: 'desc' }
      });

      let availableBlocks: string[] = []; // Initialize empty

      if (activeSubscription) {
        // User has subscription - give access to ALL blocks from config
        console.log('User has active subscription - granting access to all blocks');
        const allBlocks = blocksConfig.map(block => block.id);
        availableBlocks = allBlocks;
      } else {
        // No subscription - check individual purchases
        const [purchasedBlocks, blockPurchases] = await Promise.all([
          prisma.purchase.findMany({
            where: { 
              shopDomain: shop,
              purchaseType: { not: 'subscription' }, // Individual purchases only
              status: 'completed'
            },
            select: { blockId: true }
          }),
          prisma.blockPurchase.findMany({
            where: { 
              shop: shop,
              status: 'completed'
            },
            select: { blockId: true }
          })
        ]);

        // Add individually purchased blocks
        const individualBlocks = [
          ...purchasedBlocks.map((p: any) => p.blockId),
          ...blockPurchases.map((p: any) => p.blockId)
        ];

        // Always include free blocks from config
        const freeBlocks = blocksConfig.filter(block => block.price === 0).map(block => block.id);

        availableBlocks = Array.from(new Set([
          ...freeBlocks, // Include all free blocks from config
          ...individualBlocks
        ]));

        console.log('User has individual purchases:', individualBlocks);
      }

      console.log('Final available blocks for shop:', availableBlocks);

      // Set the app metafields for each block
      const metafieldResult = await setBlockMetafields(shop, accessToken, availableBlocks);

      await prisma.$disconnect();

      return {
        success: metafieldResult.success,
        error: metafieldResult.error,
        data: {
          shop,
          availableBlocks,
          hasSubscription: !!activeSubscription,
          metafields: metafieldResult.data
        }
      };

    } catch (dbError) {
      console.error('Database error installing blocks:', dbError);
      await prisma.$disconnect();
      return {
        success: false,
        error: 'Database error: ' + (dbError instanceof Error ? dbError.message : 'Unknown error')
      };
    }

  } catch (error) {
    console.error('Error in installBlocksForShop:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
