// Block pricing configuration - Easy to modify pricing for all blocks
export const BLOCK_PRICING = {
  // Utility blocks - FREE
  "padding-block": { price: 0, category: "utility", complexity: "simple" },
  "divider-block": { price: 0, category: "utility", complexity: "simple" },
  
  // Premium blocks - $19 each
  "product-showcase": { price: 19, category: "product", complexity: "advanced" },
  "video-pro-2": { price: 19, category: "premium", complexity: "advanced" },
  "scrolling-bar": { price: 19, category: "premium", complexity: "advanced" },
  
  // Standard content blocks - $19 each (for future blocks)
  "image-banner": { price: 19, category: "content", complexity: "standard" },
  "countdown-banner": { price: 19, category: "content", complexity: "standard" },
  "fullscreen-image": { price: 19, category: "content", complexity: "standard" },
  "collapsible-info-block": { price: 19, category: "content", complexity: "standard" },
  "ingredient-info-block": { price: 19, category: "content", complexity: "standard" },
  
  // Layout blocks - $19 each (for future blocks)
  "three-column-display": { price: 19, category: "layout", complexity: "standard" },
  "display-deck": { price: 19, category: "layout", complexity: "standard" },
  "dynamic-duo-card": { price: 19, category: "layout", complexity: "standard" },
  "my-top-4-gallery": { price: 19, category: "layout", complexity: "standard" },
  "category-image-hover": { price: 19, category: "layout", complexity: "standard" },
  
  // Additional product display blocks - $19 each (for future blocks)
  "product-spotlight": { price: 19, category: "product", complexity: "advanced" },
  "single-product-highlight": { price: 19, category: "product", complexity: "advanced" },
  "featured-products": { price: 19, category: "product", complexity: "advanced" },
  "product-gallery": { price: 19, category: "product", complexity: "advanced" },
  "scrolling-collection": { price: 19, category: "product", complexity: "advanced" },
  
  // Premium/Complex blocks - $19 each (for future blocks)
  "hero-advertisement": { price: 19, category: "premium", complexity: "advanced" },
  "video-hero": { price: 19, category: "premium", complexity: "advanced" },
  "faqpro": { price: 19, category: "premium", complexity: "advanced" },
  
  // Default pricing for any blocks not listed above
  "default": { price: 29, category: "standard", complexity: "standard" }
};

// Subscription pricing - Simple monthly plan
export const SUBSCRIPTION_PRICING = {
  monthly: { price: 9.99, currency: "USD", interval: "EVERY_30_DAYS", description: "All blocks included - unlimited access" }
};

// Helper function to get price for a block
export function getBlockPrice(blockName) {
  return BLOCK_PRICING[blockName]?.price || BLOCK_PRICING.default.price;
}

// Helper function to get all blocks in a category
export function getBlocksByCategory(category) {
  return Object.entries(BLOCK_PRICING)
    .filter(([name, config]) => config.category === category && name !== 'default')
    .map(([name, config]) => ({ name, ...config }));
}

// Helper function to get all blocks by complexity
export function getBlocksByComplexity(complexity) {
  return Object.entries(BLOCK_PRICING)
    .filter(([name, config]) => config.complexity === complexity && name !== 'default')
    .map(([name, config]) => ({ name, ...config }));
}

// Helper function to check if block is free
export function isFreeBlock(blockName) {
  return getBlockPrice(blockName) === 0;
}

// Helper function to get total value of all blocks
export function getTotalBlocksValue() {
  return Object.values(BLOCK_PRICING)
    .filter((block, index) => Object.keys(BLOCK_PRICING)[index] !== 'default')
    .reduce((total, block) => total + block.price, 0);
}
