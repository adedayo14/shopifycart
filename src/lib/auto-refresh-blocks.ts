// Auto-refresh blocks system
// This will automatically refresh user blocks when they access the app

import { installBlocksForShop } from './install-blocks';
import blocksConfig from '../config/blocks';

// Cache to prevent too frequent refreshes (max once per hour per shop)
const refreshCache = new Map<string, number>();
const REFRESH_COOLDOWN = 60 * 60 * 1000; // 1 hour in milliseconds

// Track the current blocks config hash to detect new deployments
let currentBlocksHash: string | null = null;

function getBlocksConfigHash(): string {
  // Create a simple hash of all block IDs to detect config changes
  const blockIds = blocksConfig.map(b => b.id).sort().join(',');
  return btoa(blockIds).slice(0, 10); // Simple hash
}

export async function autoRefreshBlocks(shop: string, accessToken: string, forceRefresh = false): Promise<boolean> {
  try {
    const now = Date.now();
    const lastRefresh = refreshCache.get(shop);
    
    // Check if blocks config has changed (new deployment)
    const newBlocksHash = getBlocksConfigHash();
    const configChanged = currentBlocksHash !== null && currentBlocksHash !== newBlocksHash;
    
    if (configChanged) {
      console.log(`🚀 New blocks detected! Config hash changed: ${currentBlocksHash} → ${newBlocksHash}`);
      currentBlocksHash = newBlocksHash;
      forceRefresh = true; // Force refresh when new blocks are deployed
    } else if (currentBlocksHash === null) {
      currentBlocksHash = newBlocksHash;
    }
    
    // Skip if recently refreshed (unless forced or config changed)
    if (!forceRefresh && lastRefresh && (now - lastRefresh) < REFRESH_COOLDOWN) {
      console.log(`Blocks for ${shop} were recently refreshed, skipping auto-refresh`);
      return false;
    }

    const refreshReason = forceRefresh ? 'forced refresh' : configChanged ? 'new blocks detected' : 'regular refresh';
    console.log(`Auto-refreshing blocks for shop: ${shop} (${refreshReason})`);
    
    const result = await installBlocksForShop(shop, accessToken);
    
    if (result.success) {
      refreshCache.set(shop, now);
      console.log(`✅ Successfully auto-refreshed blocks for ${shop}`);
      if (configChanged) {
        console.log(`🎉 New blocks are now available in theme editor for ${shop}`);
      }
      return true;
    } else {
      console.error(`Failed to auto-refresh blocks for ${shop}:`, result.error);
      return false;
    }
    
  } catch (error) {
    console.error('Auto-refresh blocks error:', error);
    return false;
  }
}

//Clear old entries from cache periodically (runs when called)
export function cleanupRefreshCache() {
  const now = Date.now();
  refreshCache.forEach((timestamp, shop) => {
    if (now - timestamp > REFRESH_COOLDOWN * 2) { // Remove entries older than 2 hours
      refreshCache.delete(shop);
    }
  });
}
