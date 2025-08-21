// Auto-sync utility for blocks - ensures all active subscribers get new blocks
import blocksConfig from '../config/blocks';

export async function autoSyncAllBlocksForActiveSubscribers() {
  try {
    console.log('🔄 Auto-syncing ALL blocks for ALL active subscribers...');
    
    const response = await fetch(`${process.env.SHOPIFY_APP_URL}/api/enhanced-deployment-hook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEPLOYMENT_HOOK_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Auto-sync completed:', result);
      return { success: true, result };
    } else {
      const error = await response.text();
      console.error('❌ Auto-sync failed:', error);
      return { success: false, error };
    }
  } catch (error) {
    console.error('❌ Auto-sync error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function ensureBlockAccessForSubscriber(shop: string, forceSync = false) {
  try {
    console.log(`🔍 Ensuring block access for ${shop}...`);
    
    // Get all current block IDs
    const allBlockIds = blocksConfig.map(block => block.id);
    
    // Install all blocks for this shop
    const response = await fetch(`${process.env.SHOPIFY_APP_URL}/api/install-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shop,
        blockIds: allBlockIds
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Block access ensured for ${shop}:`, result);
      return { success: true, result };
    } else {
      const error = await response.text();
      console.error(`❌ Failed to ensure block access for ${shop}:`, error);
      return { success: false, error };
    }
  } catch (error) {
    console.error(`❌ Error ensuring block access for ${shop}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function syncNewBlocksForAllActiveSubscribers() {
  console.log('🆕 Syncing new blocks for all active subscribers...');
  return await autoSyncAllBlocksForActiveSubscribers();
}

// Helper to get current block count and detect when new blocks are added
export function getCurrentBlockInfo() {
  const allBlocks = blocksConfig.length;
  const paidBlocks = blocksConfig.filter(b => b.price > 0).length;
  const freeBlocks = blocksConfig.filter(b => b.price === 0).length;
  
  return {
    total: allBlocks,
    paid: paidBlocks,
    free: freeBlocks,
    blockIds: blocksConfig.map(b => b.id)
  };
}
