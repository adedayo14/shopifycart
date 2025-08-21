// Metafield refresh utilities for Shopify app
import { PrismaClient } from '@prisma/client';
import blocksConfig from '../config/blocks.js';

const prisma = new PrismaClient();

export async function refreshMetafieldsForShop(shopDomain: string) {
  try {
    console.log(`🔄 Refreshing metafields for shop: ${shopDomain}`);
    
    // Get the shop's latest session with access token
    const shopSession = await prisma.session.findFirst({
      where: { 
        shop: shopDomain,
        accessToken: { not: '' }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!shopSession?.accessToken) {
      console.log(`⚠️ No valid access token found for ${shopDomain}`);
      return false;
    }
    
    console.log('✅ Found valid access token, updating metafields...');
    
    // Get the app's GID
    const appQuery = `
      query {
        currentAppInstallation {
          id
        }
      }
    `;
    
    const appResponse = await fetch(`https://${shopDomain}/admin/api/2023-01/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopSession.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: appQuery
      })
    });
    
    const appResult = await appResponse.json();
    
    if (appResult.errors || !appResult.data?.currentAppInstallation?.id) {
      console.log(`❌ Could not get app installation ID for ${shopDomain}:`, appResult.errors);
      return false;
    }
    
    const appId = appResult.data.currentAppInstallation.id;
    console.log('✅ Got app ID');
    
    // Prepare metafields for all blocks
    const metafieldsToSet: Array<{
      ownerId: string;
      namespace: string;
      key: string;
      value: string;
      type: string;
    }> = [];
    
    // Handle blocks config format (array of blocks)
    if (Array.isArray(blocksConfig)) {
      blocksConfig.forEach((block) => {
        metafieldsToSet.push({
          ownerId: appId,
          namespace: 'trifoli_blocks',
          key: `${block.id}_access`,
          value: 'true',
          type: 'boolean'
        });
      });
    } else {
      // Fallback for other formats
      console.log('Warning: Unexpected blocks config format');
    }
    
    console.log(`📝 Setting ${metafieldsToSet.length} metafields...`);
    
    // Set all metafields in a single mutation
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

    const response = await fetch(`https://${shopDomain}/admin/api/2023-01/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopSession.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables
      })
    });
    
    const result = await response.json();
    
    if (result.data?.metafieldsSet?.userErrors?.length > 0) {
      console.log(`❌ Metafield errors for ${shopDomain}:`, result.data.metafieldsSet.userErrors);
      return false;
    } else {
      console.log(`✅ Successfully updated metafields for ${shopDomain}!`);
      console.log(`📋 ${result.data?.metafieldsSet?.metafields?.length || 0} metafields set`);
      return true;
    }
    
  } catch (error) {
    console.error(`❌ Error updating metafields for ${shopDomain}:`, error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

export async function refreshAllSubscriberMetafields() {
  try {
    console.log('🔄 Refreshing metafields for all active subscribers...');
    
    // Get all active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: { 
        status: 'active' 
      }
    });
    
    if (activeSubscriptions.length === 0) {
      console.log('ℹ️ No active subscriptions found');
      return [];
    }
    
    console.log(`📊 Found ${activeSubscriptions.length} active subscription(s)`);
    
    const results = [];
    
    for (const subscription of activeSubscriptions) {
      const success = await refreshMetafieldsForShop(subscription.shop);
      results.push({ shop: subscription.shop, success });
    }
    
    console.log('\n🎉 Metafield refresh complete for all subscribers!');
    console.log('📝 All new blocks should now be visible in theme editors immediately');
    
    return results;
    
  } catch (error) {
    console.error('❌ Error refreshing metafields:', error);
    return [];
  } finally {
    await prisma.$disconnect();
  }
}
