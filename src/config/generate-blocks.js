const fs = require('fs');
const path = require('path');

// Manual overrides for block descriptions and categories
const BLOCK_OVERRIDES = {
  'collapsible-info-block': {
    description: 'Expandable FAQ sections and product details with smooth animations - perfect for reducing page clutter while providing detailed information',
    category: 'Content'
  },
  'countdown-banner': {
    description: 'Urgency-driving countdown timers for sales, launches, and special events - boost conversions with time-sensitive offers',
    category: 'Layout'
  },
  'display-deck': {
    description: 'Swipeable product carousel with elegant transitions - showcase multiple products in minimal space',
    category: 'Content'
  },
  'divider-block': {
    description: 'Clean, customizable dividers to separate content sections with style',
    category: 'Utility'
  },
  'dynamic-duo-card': {
    description: 'Split-screen product comparisons and before/after showcases - highlight product benefits and drive conversions',
    category: 'Content'
  },
  'faqpro': {
    description: 'Professional FAQ sections with search, categories, and smooth animations - reduce support tickets and improve UX',
    category: 'Content'
  },
  'featured-products': {
    description: 'Customizable product grids with hover effects and quick-view options - increase product discovery and sales',
    category: 'Product Display'
  },
  'fullscreen-image': {
    description: 'Full-width hero images with overlay text and call-to-action buttons - create stunning visual impact',
    category: 'Media'
  },
  'hero-advertisement': {
    description: 'High-converting hero banners with multiple layouts and CTA buttons - grab attention and drive action',
    category: 'Content'
  },
  'image-banner': {
    description: 'Responsive banner sections with text overlays and action buttons - perfect for promotions and announcements',
    category: 'Media'
  },
  'ingredient-info-block': {
    description: 'Interactive ingredient lists with tooltips and detailed descriptions - build trust for beauty and wellness products',
    category: 'Content'
  },
  'my-top-4-gallery': {
    description: 'Curated product galleries with custom titles and pricing - showcase bestsellers and featured collections',
    category: 'Content'
  },
  'padding-block': {
    description: 'Adjustable spacing blocks for perfect layout control',
    category: 'Content'
  },
  'product-gallery': {
    description: 'Interactive product showcases with zoom, multiple views, and purchase options - enhance product presentation',
    category: 'Product Display'
  },
  'product-showcase': {
    description: 'Beautiful product display with customizable layouts and hover effects',
    category: 'Product Display'
  },
  'product-spotlight': {
    description: 'Individual product highlights with detailed descriptions and prominent buy buttons - boost specific product sales',
    category: 'Product Display'
  },
  'scrolling-bar': {
    description: 'Eye-catching scrolling announcement bar for promotions and updates',
    category: 'Layout'
  },
  'scrolling-collection': {
    description: 'Horizontal scrolling product collections with smooth navigation - display multiple products without vertical space',
    category: 'Layout'
  },
  'single-product-highlight': {
    description: 'Focused single product presentations with detailed specs and multiple CTAs - perfect for landing pages',
    category: 'Product Display'
  },
  'test-scrolling-block': {
    description: 'Test scrolling block for verifying automated deployment system - demonstrates seamless block addition workflow',
    category: 'Layout'
  },
  'three-column-display': {
    description: 'Organized three-column layouts for features, benefits, or product categories - improve content structure',
    category: 'Content'
  },
  'video-hero': {
    description: 'Full-width background videos with overlay content - create immersive brand experiences',
    category: 'Media'
  },
  'video-pro-2': {
    description: 'Professional video player with autoplay, mute controls, and responsive design',
    category: 'Media'
  },
  'category-image-hover': {
    description: 'Interactive category showcases with hover-reveal product images - create engaging category browsing experiences',
    category: 'Product Display'
  }
  // Add more overrides here when you create new blocks
};

// Function to parse block metadata from .liquid files
function parseBlockMetadata(filePath, blockId) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract schema JSON from the liquid file
    const schemaMatch = content.match(/{% schema %}\s*({[\s\S]*?})\s*{% endschema %}/);
    if (!schemaMatch) {
      console.warn(`No schema found in ${blockId}.liquid`);
      return null;
    }
    
    const schema = JSON.parse(schemaMatch[1]);
    
    // Check for manual override first
    const override = BLOCK_OVERRIDES[blockId];
    
    let description, category;
    
    if (override) {
      description = override.description;
      category = override.category;
    } else {
      // Extract description from comment at top of file
      const commentMatch = content.match(/{% comment %}([\s\S]*?){% endcomment %}/);
      description = schema.name || blockId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      if (commentMatch) {
        const commentContent = commentMatch[1].trim();
        const lines = commentContent.split('\n').map(line => line.trim());
        // Look for a description line (usually the second line after the title)
        if (lines.length > 1) {
          description = lines.find(line => line && !line.includes(schema.name || blockId)) || description;
        }
      }
      
      // Determine category from schema or block name
      category = 'Content';
      const blockName = schema.name?.toLowerCase() || blockId;
      if (blockName.includes('product')) category = 'Product Display';
      else if (blockName.includes('video') || blockName.includes('image')) category = 'Media';
      else if (blockName.includes('testimonial') || blockName.includes('review')) category = 'Social Proof';
      else if (blockName.includes('scroll') || blockName.includes('banner') || blockName.includes('bar')) category = 'Layout';
      else if (blockName.includes('divider') || blockName.includes('utility')) category = 'Utility';
    }
    
    // All blocks are $19 except divider-block and padding-block which are free
    const price = (blockId === 'divider-block' || blockId === 'padding-block') ? 0 : 29;
    
    return {
      id: blockId,
      name: schema.name || blockId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: description,
      category: category,
      price: price,
      isActive: true
    };
  } catch (error) {
    console.error(`Error parsing ${blockId}.liquid:`, error.message);
    return null;
  }
}

// Function to scan blocks directory and generate config
function generateBlocksConfig() {
  const blocksDir = path.join(__dirname, '../../extensions/theme-extension/blocks');
  
  if (!fs.existsSync(blocksDir)) {
    console.error('Blocks directory not found:', blocksDir);
    return [];
  }
  
  const files = fs.readdirSync(blocksDir);
  const liquidFiles = files.filter(file => file.endsWith('.liquid'));
  
  console.log('Found block files:', liquidFiles);
  
  const blocks = [];
  
  for (const file of liquidFiles) {
    const blockId = file.replace('.liquid', '');
    const filePath = path.join(blocksDir, file);
    
    const blockMeta = parseBlockMetadata(filePath, blockId);
    if (blockMeta) {
      blocks.push(blockMeta);
      console.log(`✓ Parsed: ${blockMeta.name} (${blockMeta.category})`);
    }
  }
  
  return blocks;
}

// Generate the configs
const blocks = generateBlocksConfig();

// Check if we have new blocks by comparing with existing config
let hasNewBlocks = false;
let existingBlocks = [];

try {
  const existingConfigPath = path.join(__dirname, 'blocks.js');
  if (fs.existsSync(existingConfigPath)) {
    delete require.cache[require.resolve('./blocks.js')];
    existingBlocks = require('./blocks.js');
    
    // Check if we have more blocks now
    if (blocks.length > existingBlocks.length) {
      hasNewBlocks = true;
      console.log(`\n🆕 NEW BLOCKS DETECTED! ${existingBlocks.length} → ${blocks.length}`);
      
      // Find the new blocks
      const existingIds = existingBlocks.map(b => b.id);
      const newBlocks = blocks.filter(b => !existingIds.includes(b.id));
      
      newBlocks.forEach(block => {
        console.log(`   ✨ NEW: ${block.name}`);
      });
    }
  } else {
    hasNewBlocks = blocks.length > 0;
  }
} catch (error) {
  console.log('Could not check for existing blocks, treating as new');
  hasNewBlocks = true;
}

// Write TypeScript config
const tsConfig = `// Auto-generated from extensions/theme-extension/blocks/*.liquid files
// DO NOT EDIT MANUALLY - Run 'npm run generate-blocks' to regenerate

export interface BlockMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  isActive: boolean;
}

const blocks: BlockMeta[] = ${JSON.stringify(blocks, null, 2)};

export default blocks;
`;

// Write JavaScript config
const jsConfig = `// Auto-generated from extensions/theme-extension/blocks/*.liquid files
// DO NOT EDIT MANUALLY - Run 'npm run generate-blocks' to regenerate

module.exports = ${JSON.stringify(blocks, null, 2)};
`;

// Write the files
fs.writeFileSync(path.join(__dirname, 'blocks.ts'), tsConfig);
fs.writeFileSync(path.join(__dirname, 'blocks.js'), jsConfig);

console.log(`\n✅ Generated blocks config with ${blocks.length} blocks:`);
blocks.forEach(block => {
  console.log(`   • ${block.name} (${block.price === 0 ? 'Free' : '$' + block.price})`);
});

console.log('\n📁 Updated files:');
console.log('   • src/config/blocks.ts');
console.log('   • src/config/blocks.js');

// If we have new blocks, automatically refresh metafields for all subscribers
if (hasNewBlocks) {
  console.log('\n🔄 NEW BLOCKS DETECTED - Auto-refreshing subscriber metafields...');
  
  try {
    const { refreshAllSubscriberMetafields } = require('../../refresh-subscriber-metafields.js');
    
    // Run the refresh asynchronously
    refreshAllSubscriberMetafields().then(() => {
      console.log('✅ Metafield refresh completed automatically!');
      console.log('🎉 New blocks are now available to subscribers immediately!');
    }).catch(error => {
      console.error('❌ Error during automatic metafield refresh:', error.message);
      console.log('💡 You can manually refresh by running: node refresh-subscriber-metafields.js');
    });
    
  } catch (error) {
    console.error('❌ Could not auto-refresh metafields:', error.message);
    console.log('💡 You can manually refresh by running: node refresh-subscriber-metafields.js');
  }
}

module.exports = { generateBlocksConfig, blocks };
