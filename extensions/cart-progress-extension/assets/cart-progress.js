// Cart Updates Handler - Fixes line parameter and FREE display
// File: extensions/cart-progress-extension/assets/cart-updates.js

console.log('[ProgressBar] Cart progress script loaded!');

(function() {
  'use strict';

  /*********************************************************
   * Progress Bar Manager (instant, no "Calculating" state)
   *********************************************************/
  const ProgressBarManager = {
    initialized: false,
    init() {
      if (this.initialized) return;
      this.initialized = true;
      console.log('[ProgressBar] Initializing progress bars...');
      this.cacheElements();
      this.detectCartDrawer();
      this.bindCartEvents();
      this.refresh(); // instant first paint
      // Poll as fallback (500ms) in case theme doesn't emit events
      this.poller = setInterval(() => this.refresh(), 500);
    },
    cacheElements() {
      this.instances = Array.from(document.querySelectorAll('[data-cart-progress]'));
      console.log(`[ProgressBar] Found ${this.instances.length} progress bar instances:`, this.instances.map(el => ({
        id: el.dataset.blockId,
        context: this.getElementContext(el)
      })));
    },
    detectCartDrawer() {
      const drawers = document.querySelectorAll('[data-cart-drawer], .cart-drawer, #CartDrawer, .drawer, [class*="cart-drawer"], [id*="cart-drawer"]');
      if (drawers.length > 0) {
        console.log('[ProgressBar] Detected cart drawer elements:', Array.from(drawers).map(el => ({ tag: el.tagName, id: el.id, class: el.className })));
      }
    },
    getElementContext(element) {
      const contexts = [];
      let current = element;
      while (current && current !== document.body) {
        if (current.classList.contains('cart-drawer') || 
            current.hasAttribute('data-cart-drawer') ||
            current.id.includes('cart') ||
            current.id.includes('drawer') ||
            current.className.includes('drawer')) {
          contexts.push(`${current.tagName}${current.id ? '#' + current.id : ''}${current.className ? '.' + current.className.split(' ').join('.') : ''}`);
        }
        current = current.parentElement;
      }
      return contexts.length > 0 ? contexts.join(' > ') : 'page';
    },
    bindCartEvents() {
      ['cart:updated','cart:changed','ajaxCart:updated','cart:refresh'].forEach(evt => {
        document.addEventListener(evt, () => this.refresh());
      });
      document.addEventListener('shopify:section:load', () => {
        this.initialized = false;
        this.init();
      });
      
      // Watch for dynamically loaded cart drawers
      this.setupDrawerObserver();
    },
    setupDrawerObserver() {
      const observer = new MutationObserver((mutations) => {
        let shouldReinitialize = false;
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              if (node.matches('[data-cart-progress]') || 
                  node.querySelector('[data-cart-progress]') ||
                  node.matches('[data-cart-drawer], .cart-drawer, #CartDrawer, .drawer') ||
                  node.className.includes('drawer') ||
                  node.id.includes('drawer')) {
                console.log('[ProgressBar] Cart drawer or progress bar detected in DOM:', node);
                shouldReinitialize = true;
              }
            }
          });
        });
        
        if (shouldReinitialize) {
          setTimeout(() => {
            this.cacheElements();
            this.refresh();
          }, 100);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    },
    async refresh() {
      try {
        const res = await fetch('/cart.js', { cache: 'no-cache' });
        if (!res.ok) return;
        const cart = await res.json();
        this.updateAll(cart);
      } catch (e) {
        console.warn('[ProgressBar] refresh error', e);
      }
    },
    isGiftItem(item, giftVariantIds) {
      return giftVariantIds.includes(String(item.variant_id)) || (item.properties && item.properties._auto_gift === 'true');
    },
    formatMoney(cents, symbol) {
      const value = (cents / 100);
      // Show no decimals if .00, else keep 2
      return symbol + (value % 1 === 0 ? value.toFixed(0) : value.toFixed(2));
    },
    updateAll(cart) {
      this.instances.forEach(root => this.updateInstance(root, cart));
    },
    updateInstance(root, cart) {
      const symbol = root.dataset.currencySymbol || '£';
      const progressMode = root.dataset.progressMode || 'continuous';
      const freeThreshold = parseFloat(root.dataset.freeThreshold || '0') || 0;
      const giftThreshold = parseFloat(root.dataset.giftThreshold || '0') || 0;
      const giftVariantId = root.dataset.giftVariantId;
      const messages = {
        freeProgress: root.dataset.messageFreeShipping || 'Add [AMOUNT] more for FREE shipping!',
        freeAchieved: root.dataset.messageFreeAchieved || '✅ FREE shipping unlocked!',
        giftProgress: root.dataset.messageGift || 'Add [AMOUNT] more for your FREE gift!',
        giftAchieved: root.dataset.messageGiftAchieved || '🎁 Free gift added!',
        initial: root.dataset.messageInitial || 'Add items to unlock rewards',
        complete: root.dataset.messageComplete || '🎉 All rewards unlocked!'
      };

      // Collect gift variant ids currently configured
      const giftVariantIds = [];
      document.querySelectorAll('[data-cart-progress]').forEach(pb => {
        if (pb.dataset.giftVariantId) giftVariantIds.push(pb.dataset.giftVariantId);
      });

      // Subtotal excluding gift items (prevents gaming)
      let subtotalCents = 0;
      cart.items.forEach(item => {
        if (!this.isGiftItem(item, giftVariantIds)) subtotalCents += item.line_price;
      });

      const freeCents = freeThreshold * 100;
      const giftCents = giftThreshold * 100;
      
      // Calculate progress based on mode
      let percent = 0;
      if (progressMode === 'sequential') {
        // Sequential: Fill to 100% for shipping, then restart for gift
        if (freeCents > 0 && subtotalCents < freeCents) {
          percent = Math.min(100, Math.round(subtotalCents * 100 / freeCents));
        } else if (freeCents > 0 && giftCents > 0 && subtotalCents >= freeCents && subtotalCents < giftCents) {
          const giftProgressCents = subtotalCents - freeCents;
          const giftNeededCents = giftCents - freeCents;
          percent = Math.min(100, Math.round(giftProgressCents * 100 / giftNeededCents));
        } else {
          percent = 100;
        }
      } else if (progressMode === 'highest_only') {
        // Focus mode: Only show progress toward highest goal, ignore intermediate milestones
        const highest = Math.max(freeCents, giftCents, 0);
        percent = highest > 0 ? Math.min(100, Math.round(subtotalCents * 100 / highest)) : 0;
      } else {
        // Continuous and milestone_markers mode
        const highest = Math.max(freeCents, giftCents, 0);
        percent = highest > 0 ? Math.min(100, Math.round(subtotalCents * 100 / highest)) : 0;
      }

      // Update fill and handle milestone markers
      const fill = root.querySelector('.cart-progress-fill');
      if (fill) {
        // Force color if theme overrides
        const color = root.dataset.progressColor || fill.style.getPropertyValue('--progress-color') || '#000';
        const trackColor = root.dataset.trackColor || '#e5e5e5';
        
        // Apply colors with !important via inline styles to override theme
        fill.style.setProperty('--progress-color', color);
        fill.style.cssText = `
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          height: 100% !important;
          background: ${color} !important;
          border-radius: 0 !important;
          z-index: 10 !important;
          opacity: 1 !important;
          visibility: visible !important;
          display: block !important;
          width: ${percent}% !important;
        `;
        
        fill.setAttribute('data-width', percent);
        if (percent > 0) fill.classList.add('has-progress'); else fill.classList.remove('has-progress');
        
        // Also enforce track color
        const track = fill.parentElement;
        if (track && track.classList.contains('cart-progress-track')) {
          track.style.cssText = `
            width: 100% !important;
            height: 8px !important;
            background: ${trackColor} !important;
            border-radius: 0 !important;
            position: relative !important;
            z-index: 1 !important;
          `;
        }
        
        // Handle milestone markers for milestone_markers mode
        if (progressMode === 'milestone_markers') {
          this.updateMilestoneMarkers(root, freeCents, giftCents, subtotalCents);
        } else {
          // Clear markers in other modes
          const milestonesContainer = root.querySelector('.cart-progress-milestones');
          if (milestonesContainer) milestonesContainer.innerHTML = '';
        }
      }

      // Update header elements based on display mode
      const headerDisplay = root.dataset.headerDisplay || 'cart_and_percentage';
      
      const countEl = root.querySelector('[data-cart-count]');
      if (countEl && (headerDisplay === 'cart_and_percentage' || headerDisplay === 'cart_only')) {
        countEl.textContent = cart.item_count;
      }
      
      const percentageEl = root.querySelector('[data-progress-percentage]');
      if (percentageEl && (headerDisplay === 'cart_and_percentage' || headerDisplay === 'percentage_only')) {
        percentageEl.textContent = percent + '%';
      }

      // Determine achievements
      const freeAchieved = freeCents > 0 && subtotalCents >= freeCents;
      const giftAchieved = giftCents > 0 && subtotalCents >= giftCents;

      // Build message based on mode and achievements
      let message = messages.initial;
      if (cart.item_count === 0) {
        message = messages.initial;
      } else if ((freeCents === 0) && (giftCents === 0)) {
        message = messages.initial;
      } else if (progressMode === 'sequential') {
        // Sequential mode messaging
        if (freeAchieved && giftAchieved) {
          message = messages.complete;
        } else if (!freeAchieved && freeCents > 0) {
          const remainingFree = Math.max(0, freeCents - subtotalCents);
          const rem = this.formatMoney(remainingFree, symbol);
          if (messages.freeProgress.includes('[AMOUNT]') || messages.freeProgress.includes('{amount}')) {
            message = messages.freeProgress.replace('[AMOUNT]', rem).replace('{amount}', rem);
          } else {
            message = messages.freeProgress + ' (' + rem + ' left)';
          }
        } else if (freeAchieved && !giftAchieved && giftCents > 0) {
          const remainingGift = Math.max(0, giftCents - subtotalCents);
          const rem = this.formatMoney(remainingGift, symbol);
          if (messages.giftProgress.includes('[AMOUNT]') || messages.giftProgress.includes('{amount}')) {
            message = messages.giftProgress.replace('[AMOUNT]', rem).replace('{amount}', rem);
          } else {
            message = messages.giftProgress + ' (' + rem + ' left)';
          }
        } else if (freeAchieved && giftCents === 0) {
          message = messages.freeAchieved;
        } else if (giftAchieved && freeCents === 0) {
          message = messages.giftAchieved;
        }
      } else if (progressMode === 'highest_only') {
        // Focus mode: Only mention the highest/final reward
        const highestIsFree = freeCents >= giftCents;
        if (freeAchieved && giftAchieved) {
          message = messages.complete;
        } else if (highestIsFree && !freeAchieved) {
          const remainingFree = Math.max(0, freeCents - subtotalCents);
          const rem = this.formatMoney(remainingFree, symbol);
          if (messages.freeProgress.includes('[AMOUNT]') || messages.freeProgress.includes('{amount}')) {
            message = messages.freeProgress.replace('[AMOUNT]', rem).replace('{amount}', rem);
          } else {
            message = messages.freeProgress + ' (' + rem + ' left)';
          }
        } else if (!highestIsFree && !giftAchieved) {
          const remainingGift = Math.max(0, giftCents - subtotalCents);
          const rem = this.formatMoney(remainingGift, symbol);
          if (messages.giftProgress.includes('[AMOUNT]') || messages.giftProgress.includes('{amount}')) {
            message = messages.giftProgress.replace('[AMOUNT]', rem).replace('{amount}', rem);
          } else {
            message = messages.giftProgress + ' (' + rem + ' left)';
          }
        } else if (highestIsFree && freeAchieved) {
          message = messages.freeAchieved;
        } else if (!highestIsFree && giftAchieved) {
          message = messages.giftAchieved;
        }
      } else {
        // Continuous and milestone_markers mode messaging
        if (freeAchieved && giftAchieved) {
          message = messages.complete;
        } else if (freeAchieved && !giftAchieved && giftCents > 0) {
          const remainingGift = Math.max(0, giftCents - subtotalCents);
          const rem = this.formatMoney(remainingGift, symbol);
          let giftProgress = messages.giftProgress;
          if (giftProgress.includes('[AMOUNT]') || giftProgress.includes('{amount}')) {
            giftProgress = giftProgress.replace('[AMOUNT]', rem).replace('{amount}', rem);
          } else {
            giftProgress = giftProgress + ' (' + rem + ' left)';
          }
          message = messages.freeAchieved + ' ' + giftProgress;
        } else if (!freeAchieved && freeCents > 0) {
          const remainingFree = Math.max(0, freeCents - subtotalCents);
          const rem = this.formatMoney(remainingFree, symbol);
          if (messages.freeProgress.includes('[AMOUNT]') || messages.freeProgress.includes('{amount}')) {
            message = messages.freeProgress.replace('[AMOUNT]', rem).replace('{amount}', rem);
          } else {
            message = messages.freeProgress + ' (' + rem + ' left)';
          }
        } else if (giftCents > 0 && !giftAchieved) {
          const remainingGift = Math.max(0, giftCents - subtotalCents);
          const rem = this.formatMoney(remainingGift, symbol);
          if (messages.giftProgress.includes('[AMOUNT]') || messages.giftProgress.includes('{amount}')) {
            message = messages.giftProgress.replace('[AMOUNT]', rem).replace('{amount}', rem);
          } else {
            message = messages.giftProgress + ' (' + rem + ' left)';
          }
        } else if (giftAchieved && !freeAchieved && freeCents === 0) {
          message = messages.giftAchieved;
        }
      }

      const msgEl = root.querySelector('.cart-progress-message');
      if (msgEl) {
        msgEl.textContent = message;
        // Apply custom message color
        const messageColor = root.dataset.messageColor || '#121212';
        msgEl.style.color = messageColor;
      }
    },

    getAchievementSymbol(symbolType) {
      const symbols = {
        'checkmark': '✓',
        'check_emoji': '✅',
        'star': '⭐',
        'target': '🎯', 
        'trophy': '🏆',
        'none': ''
      };
      return symbols[symbolType] || '✓';
    },

    updateMilestoneMarkers(root, freeCents, giftCents, subtotalCents) {
      const milestonesContainer = root.querySelector('.cart-progress-milestones');
      if (!milestonesContainer) {
        console.warn('[ProgressBar] No milestones container found');
        return;
      }

      // Get custom colors and symbol settings
      const milestoneColor = root.dataset.milestoneColor || '#666666';
      const milestoneAchievedColor = root.dataset.milestoneAchievedColor || '#22c55e';
      const achievementSymbol = root.dataset.achievementSymbol || 'checkmark';
      const showSymbolCircle = root.dataset.showSymbolCircle !== 'false';
      
      const symbolContent = this.getAchievementSymbol(achievementSymbol);

      // Clear existing markers
      milestonesContainer.innerHTML = '';

      const highest = Math.max(freeCents, giftCents, 0);
      if (highest === 0) {
        console.warn('[ProgressBar] No thresholds set for milestones');
        return;
      }

      console.log('[ProgressBar] Creating milestones:', { freeCents, giftCents, highest, subtotalCents, milestoneColor, milestoneAchievedColor, achievementSymbol, showSymbolCircle, symbolContent });

      // Add markers for each threshold
      if (freeCents > 0) {
        const freePosition = (freeCents / highest) * 100;
        const freeAchieved = subtotalCents >= freeCents;
        const marker = document.createElement('div');
        
        // Base classes
        let markerClasses = `milestone-marker ${freeAchieved ? 'achieved' : ''}`;
        
        // Add circle/no-circle class for achieved markers
        if (freeAchieved) {
          if (achievementSymbol === 'none' || !symbolContent) {
            markerClasses += ' symbol-none';
          } else {
            markerClasses += showSymbolCircle ? ' show-circle' : ' no-circle';
          }
        }
        
        marker.className = markerClasses;
        marker.style.cssText = `
          position: absolute !important;
          top: ${freeAchieved ? '-7px' : '-6px'} !important;
          left: ${freePosition}% !important;
          transform: translateX(-50%) !important;
          width: 2px !important;
          height: ${freeAchieved ? '22px' : '20px'} !important;
          background: ${freeAchieved ? milestoneAchievedColor : milestoneColor} !important;
          border-radius: 1px !important;
          z-index: 15 !important;
          display: block !important;
        `;
        
        // Set the symbol content and colors via CSS custom properties
        if (freeAchieved && symbolContent) {
          marker.style.setProperty('--symbol-content', `"${symbolContent}"`);
          marker.style.setProperty('--symbol-bg-color', milestoneAchievedColor);
          marker.style.setProperty('--symbol-text-color', showSymbolCircle ? 'white' : milestoneAchievedColor);
        }
        
        marker.setAttribute('data-label', '🚚 Free Shipping');
        milestonesContainer.appendChild(marker);
        console.log('[ProgressBar] Added free shipping marker at', freePosition + '%');
      }

      if (giftCents > 0 && giftCents !== freeCents) {
        const giftPosition = (giftCents / highest) * 100;
        const giftAchieved = subtotalCents >= giftCents;
        const marker = document.createElement('div');
        
        // Base classes
        let markerClasses = `milestone-marker ${giftAchieved ? 'achieved' : ''}`;
        
        // Add circle/no-circle class for achieved markers
        if (giftAchieved) {
          if (achievementSymbol === 'none' || !symbolContent) {
            markerClasses += ' symbol-none';
          } else {
            markerClasses += showSymbolCircle ? ' show-circle' : ' no-circle';
          }
        }
        
        marker.className = markerClasses;
        marker.style.cssText = `
          position: absolute !important;
          top: ${giftAchieved ? '-7px' : '-6px'} !important;
          left: ${giftPosition}% !important;
          transform: translateX(-50%) !important;
          width: 2px !important;
          height: ${giftAchieved ? '22px' : '20px'} !important;
          background: ${giftAchieved ? milestoneAchievedColor : milestoneColor} !important;
          border-radius: 1px !important;
          z-index: 15 !important;
          display: block !important;
        `;
        
        // Set the symbol content and colors via CSS custom properties
        if (giftAchieved && symbolContent) {
          marker.style.setProperty('--symbol-content', `"${symbolContent}"`);
          marker.style.setProperty('--symbol-bg-color', milestoneAchievedColor);
          marker.style.setProperty('--symbol-text-color', showSymbolCircle ? 'white' : milestoneAchievedColor);
        }
        
        marker.setAttribute('data-label', '🎁 Free Gift');
        milestonesContainer.appendChild(marker);
        console.log('[ProgressBar] Added gift marker at', giftPosition + '%');
      }
    }
  };
  
  // Expose ProgressBarManager globally for auto-inject
  window.ProgressBarManager = ProgressBarManager;

  /*********************************************************
   * Cart Recommendations Manager
   *********************************************************/
  const CartRecommendationsManager = {
    initialized: false,
    
    init() {
      if (this.initialized) return;
      this.initialized = true;
      console.log('[Recommendations] Initializing recommendations...');
      this.cacheElements();
      this.bindEvents();
      this.handleAutoHide();
    },
    
    cacheElements() {
      this.instances = Array.from(document.querySelectorAll('[data-cart-recommendations]'));
      console.log(`[Recommendations] Found ${this.instances.length} recommendation instances`);
    },
    
    bindEvents() {
      // Toggle functionality
      document.addEventListener('click', (e) => {
        if (e.target.matches('[data-toggle-recommendations]') || e.target.closest('[data-toggle-recommendations]')) {
          this.handleToggle(e);
        }
        
        // Add to cart functionality
        if (e.target.matches('.rec-add-btn') || e.target.closest('.rec-add-btn')) {
          this.handleAddToCart(e);
        }
        
        // Variant selection
        if (e.target.matches('.color-swatch')) {
          this.handleColorSelection(e);
        }
      });
      
      // Size selection
      document.addEventListener('change', (e) => {
        if (e.target.matches('.size-select')) {
          this.handleSizeSelection(e);
        }
      });
      
      // Cart update events to hide products already in cart
      ['cart:updated', 'cart:changed', 'ajaxCart:updated'].forEach(eventName => {
        document.addEventListener(eventName, () => {
          this.handleAutoHide();
        });
      });
    },
    
    handleToggle(e) {
      e.preventDefault();
      const button = e.target.closest('[data-toggle-recommendations]');
      const container = button.closest('[data-cart-recommendations]');
      const content = container.querySelector('[data-recommendations-content]');
      const isExpanded = button.getAttribute('aria-expanded') === 'true';
      
      button.setAttribute('aria-expanded', !isExpanded);
      
      if (isExpanded) {
        content.style.maxHeight = '0';
        content.style.opacity = '0';
        content.classList.add('collapsed');
      } else {
        content.style.maxHeight = '500px';
        content.style.opacity = '1';
        content.classList.remove('collapsed');
      }
      
      console.log(`[Recommendations] Toggled: ${!isExpanded ? 'expanded' : 'collapsed'}`);
    },
    
    async handleAddToCart(e) {
      e.preventDefault();
      const button = e.target.closest('.rec-add-btn');
      
      if (button.disabled || button.classList.contains('loading')) return;
      
      const variantId = button.dataset.variantId;
      const productTitle = button.dataset.productTitle;
      const productItem = button.closest('.recommendation-item');
      
      if (!variantId) {
        console.error('[Recommendations] No variant ID found');
        return;
      }
      
      // Update button state
      this.setButtonLoading(button, true);
      
      try {
        // Get updated variant ID from selections
        const selectedVariantId = this.getSelectedVariantId(productItem) || variantId;
        
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            id: selectedVariantId,
            quantity: 1
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[Recommendations] Added to cart:', result);
        
        // Trigger cart update events
        document.dispatchEvent(new CustomEvent('cart:updated'));
        document.dispatchEvent(new CustomEvent('cart:changed'));
        
        // Show success feedback
        this.showSuccessFeedback(button, productTitle);
        
        // Auto-hide if enabled
        setTimeout(() => {
          this.handleAutoHide();
        }, 100);
        
      } catch (error) {
        console.error('[Recommendations] Add to cart error:', error);
        this.showErrorFeedback(button);
      } finally {
        this.setButtonLoading(button, false);
      }
    },
    
    getSelectedVariantId(productItem) {
      const productId = productItem.dataset.productId;
      const selectedOptions = {};
      
      // Get color selection
      const selectedColor = productItem.querySelector('.color-swatch.selected');
      if (selectedColor) {
        selectedOptions[selectedColor.dataset.optionName] = selectedColor.dataset.optionValue;
      }
      
      // Get size selection
      const sizeSelect = productItem.querySelector('.size-select');
      if (sizeSelect) {
        selectedOptions[sizeSelect.dataset.optionName] = sizeSelect.value;
      }
      
      // If no options selected, return null to use default
      if (Object.keys(selectedOptions).length === 0) {
        return null;
      }
      
      // This would need product variant data to match options to variant IDs
      // For now, return null to use the default variant
      console.log('[Recommendations] Selected options:', selectedOptions);
      return null;
    },
    
    handleColorSelection(e) {
      const swatch = e.target.closest('.color-swatch');
      const container = swatch.closest('.color-swatches');
      
      // Remove selected class from siblings
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      
      // Add selected class to clicked swatch
      swatch.classList.add('selected');
      
      console.log('[Recommendations] Color selected:', swatch.dataset.optionValue);
    },
    
    handleSizeSelection(e) {
      const select = e.target;
      console.log('[Recommendations] Size selected:', select.value);
    },
    
    async handleAutoHide() {
      this.instances.forEach(async (instance) => {
        const autoHide = instance.dataset.autoHide === 'true';
        if (!autoHide) return;
        
        try {
          const response = await fetch('/cart.js');
          const cart = await response.json();
          const cartVariantIds = cart.items.map(item => String(item.variant_id));
          
          instance.querySelectorAll('.recommendation-item').forEach(item => {
            const variantId = item.dataset.variantId;
            if (cartVariantIds.includes(variantId)) {
              item.style.display = 'none';
              console.log('[Recommendations] Hiding product already in cart:', variantId);
            } else {
              item.style.display = '';
            }
          });
        } catch (error) {
          console.warn('[Recommendations] Auto-hide error:', error);
        }
      });
    },
    
    setButtonLoading(button, loading) {
      const textSpan = button.querySelector('.btn-text');
      const loadingSpan = button.querySelector('.btn-loading');
      
      if (loading) {
        button.classList.add('loading');
        button.disabled = true;
        if (textSpan) textSpan.style.display = 'none';
        if (loadingSpan) loadingSpan.style.display = 'flex';
      } else {
        button.classList.remove('loading');
        button.disabled = false;
        if (textSpan) textSpan.style.display = '';
        if (loadingSpan) loadingSpan.style.display = 'none';
      }
    },
    
    showSuccessFeedback(button, productTitle) {
      const originalText = button.querySelector('.btn-text').textContent;
      const textSpan = button.querySelector('.btn-text');
      
      textSpan.textContent = 'Added!';
      button.style.background = '#22c55e';
      
      setTimeout(() => {
        textSpan.textContent = originalText;
        button.style.background = '';
      }, 2000);
    },
    
    showErrorFeedback(button) {
      const originalText = button.querySelector('.btn-text').textContent;
      const textSpan = button.querySelector('.btn-text');
      
      textSpan.textContent = 'Error';
      button.style.background = '#dc2626';
      
      setTimeout(() => {
        textSpan.textContent = originalText;
        button.style.background = '';
      }, 2000);
    }
  };
  
  // Expose globally for auto-inject
  window.CartRecommendationsManager = CartRecommendationsManager;
  
  // Initialize progress bar manager ASAP
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ProgressBarManager.init());
  } else {
    ProgressBarManager.init();
  }
  
  // Additional initialization for cart drawers that might load later
  setTimeout(() => {
    ProgressBarManager.cacheElements();
    ProgressBarManager.refresh();
    CartRecommendationsManager.init();
  }, 1000);
  
  // Watch for cart drawer opening events
  ['cart:open', 'drawer:open', 'cart:show', 'drawer:show'].forEach(eventName => {
    document.addEventListener(eventName, () => {
      console.log(`[ProgressBar] Cart drawer opened (${eventName})`);
      setTimeout(() => {
        ProgressBarManager.cacheElements();
        ProgressBarManager.refresh();
        CartRecommendationsManager.init();
      }, 200);
    });
  });

  window.CartUpdates = {
    giftVariantIds: [],
    initialized: false,
    updateTimer: null,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      console.log('[CartUpdates] Initializing...');
      
      // Get gift variant IDs from progress bars
      this.getGiftVariantIds();
      
  // Initial processing (also triggers progress refresh via event dispatch)
  this.processCart();
      
      // Start monitoring
      this.startMonitoring();
      
      // Bind events
      this.bindEvents();
    },

    getGiftVariantIds() {
      const progressBars = document.querySelectorAll('[data-cart-progress]');
      progressBars.forEach(bar => {
        const variantId = bar.dataset.giftVariantId;
        if (variantId && !this.giftVariantIds.includes(variantId)) {
          this.giftVariantIds.push(variantId);
        }
      });
      console.log('[CartUpdates] Gift variant IDs:', this.giftVariantIds);
    },

    async processCart() {
      try {
        const response = await fetch('/cart.js', { cache: 'no-cache' });
        const cart = await response.json();
        
        // Process each cart item
        cart.items.forEach(item => {
          if (this.isGiftItem(item)) {
            this.processGiftItem(item);
          }
        });
        
        // Update DOM
        this.updateCartDisplay(cart);
        
      } catch (error) {
        console.error('[CartUpdates] Error processing cart:', error);
      }
    },

    isGiftItem(item) {
      return this.giftVariantIds.includes(String(item.variant_id)) ||
             (item.properties && item.properties._auto_gift === 'true');
    },

    processGiftItem(item) {
      console.log('[CartUpdates] Processing gift item:', item.title);
      
      // Find all possible selectors for this item
      const selectors = [
        `[data-variant-id="${item.variant_id}"]`,
        `[data-key="${item.key}"]`,
        `[data-cart-item-key="${item.key}"]`,
        `[data-line-item-key="${item.key}"]`,
        `tr[data-product-id="${item.product_id}"]`,
        `.cart-item:has([href*="${item.handle}"])`,
        `.cart__item:has([href*="${item.handle}"])`,
        `[data-product-handle="${item.handle}"]`
      ];
      
      // Try each selector
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            this.styleGiftElement(element, item);
          });
        } catch (e) {
          // Skip invalid selectors
        }
      });
      
      // Also check for items by product title
      this.findItemByTitle(item);
    },

    findItemByTitle(item) {
      // Find items by matching title text
      const allItems = document.querySelectorAll('.cart-item, .cart__item, tr, [data-cart-item]');
      
      allItems.forEach(element => {
        const titleElement = element.querySelector('a, .product-title, .cart-item__name, h3, h4');
        if (titleElement && titleElement.textContent.includes(item.title)) {
          this.styleGiftElement(element, item);
        }
      });
    },

    styleGiftElement(element, item) {
      if (!element || element.dataset.giftStyled === 'true') return;
      
      element.dataset.giftStyled = 'true';
      element.setAttribute('data-auto-gift', 'true');
      element.classList.add('free-gift-item');
      
      // Style the container
      element.style.cssText += `
        background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%) !important;
        border: 2px solid #22c55e !important;
        border-radius: 8px !important;
        padding: 8px !important;
        margin: 4px 0 !important;
        position: relative !important;
      `;
      
      // Add FREE badge if not exists
      if (!element.querySelector('.free-gift-badge')) {
        const badge = document.createElement('div');
        badge.className = 'free-gift-badge';
        badge.innerHTML = '🎁 FREE GIFT';
        badge.style.cssText = `
          position: absolute;
          top: -10px;
          right: 10px;
          background: #22c55e;
          color: white;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
          z-index: 100;
          letter-spacing: 0.5px;
        `;
        element.appendChild(badge);
      }
      
      // Update all price displays to FREE
      this.updatePriceDisplays(element, item);
      
      // Lock quantity inputs
      this.lockQuantityInputs(element, item);
    },

    updatePriceDisplays(element, item) {
      // Find ALL price elements with various selectors
      const priceSelectors = [
        '.price',
        '.cart-item__price',
        '.cart__price',
        '.line-item__price',
        '.product-price',
        '.money',
        '[class*="price"]',
        'td:last-child:not(:has(button))',
        '.cart-item__totals',
        'span:has-text("£"):not(:has(*))',
        'div:has-text("£"):not(:has(div))'
      ];
      
      priceSelectors.forEach(selector => {
        try {
          const priceElements = element.querySelectorAll(selector);
          priceElements.forEach(priceEl => {
            // Check if this looks like a price
            const text = priceEl.textContent.trim();
            if (text.includes('£') || text.includes('$') || text.match(/\d+\.\d{2}/)) {
              this.replacePriceWithFree(priceEl);
            }
          });
        } catch (e) {
          // Skip invalid selectors
        }
      });
      
      // Special handling for table cells in the TOTAL column
      if (element.tagName === 'TR') {
        const cells = element.querySelectorAll('td');
        const lastCell = cells[cells.length - 1];
        if (lastCell && !lastCell.querySelector('button')) {
          this.replacePriceWithFree(lastCell);
        }
      }
    },

    replacePriceWithFree(priceElement) {
      if (priceElement.dataset.freeApplied === 'true') return;
      priceElement.dataset.freeApplied = 'true';
      
      const originalText = priceElement.textContent.trim();
      
      // Don't replace if it's already showing FREE
      if (originalText.includes('FREE')) return;
      
      // Create the FREE display
      priceElement.innerHTML = `
        <span style="text-decoration: line-through; color: #999; font-size: 0.85em; margin-right: 8px;">
          ${originalText}
        </span>
        <span style="color: #22c55e; font-weight: bold; font-size: 1.1em;">
          FREE
        </span>
      `;
    },

    lockQuantityInputs(element, item) {
      // Find quantity inputs
      const inputs = element.querySelectorAll(
        'input[type="number"], input[name*="quantity"], input[name*="updates"], .qty-input'
      );
      
      inputs.forEach(input => {
        // Get the configured gift quantity
        const giftQty = this.getGiftQuantity();
        
        input.value = giftQty;
        input.setAttribute('readonly', 'readonly');
        input.setAttribute('data-gift-locked', 'true');
        input.setAttribute('data-line-key', item.key);
        
        input.style.cssText += `
          background: #f0fdf4 !important;
          border: 1px solid #22c55e !important;
          color: #22c55e !important;
          font-weight: bold !important;
          cursor: not-allowed !important;
        `;
      });
      
      // Disable quantity buttons
      const buttons = element.querySelectorAll(
        'button[class*="qty"], button[class*="quantity"], .quantity__button, [data-quantity-selector]'
      );
      
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.cssText += `
          opacity: 0.5 !important;
          cursor: not-allowed !important;
          pointer-events: none !important;
        `;
      });
    },

    getGiftQuantity() {
      // Get quantity from progress bar settings
      const progressBar = document.querySelector('[data-cart-progress]');
      return progressBar ? parseInt(progressBar.dataset.giftQuantity) || 1 : 1;
    },

    updateCartDisplay(cart) {
      // Calculate total without gift items
      let adjustedTotal = 0;
      
      cart.items.forEach(item => {
        if (!this.isGiftItem(item)) {
          adjustedTotal += item.line_price;
        }
      });
      
      // Update total display if gifts are free
      const hasGifts = cart.items.some(item => this.isGiftItem(item));
      if (hasGifts) {
        const totalElements = document.querySelectorAll(
          '.cart__footer-total, .totals__total-value, [data-cart-total], .cart-total'
        );
        
        totalElements.forEach(el => {
          if (!el.dataset.originalTotal) {
            el.dataset.originalTotal = el.textContent;
          }
          
          // You can optionally show adjusted total here
          // el.textContent = this.formatMoney(adjustedTotal);
        });
      }
    },

    formatMoney(cents) {
      return '£' + (cents / 100).toFixed(2);
    },

    startMonitoring() {
      // Monitor for cart changes every 500ms
      setInterval(() => {
        this.processCart();
      }, 500);
    },

    bindEvents() {
      // Prevent quantity changes on gift items
      document.addEventListener('click', (e) => {
        if (e.target.matches('button[class*="qty"], button[class*="quantity"]')) {
          const giftItem = e.target.closest('[data-auto-gift="true"]');
          if (giftItem) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }
      });
      
      // Intercept quantity input changes
      document.addEventListener('change', async (e) => {
        if (e.target.matches('input[name*="quantity"], input[name*="updates"]')) {
          const giftItem = e.target.closest('[data-auto-gift="true"]');
          if (giftItem) {
            e.preventDefault();
            e.target.value = this.getGiftQuantity();
            return false;
          }
          
          // For non-gift items, fix the line parameter issue
          const lineKey = e.target.dataset.lineKey || 
                         e.target.name.match(/\[(.*?)\]/)?.[1] ||
                         e.target.closest('[data-key]')?.dataset.key;
          
          if (lineKey) {
            await this.updateCartQuantity(lineKey, e.target.value);
          }
        }
      });
      
      // Cart update events
      ['cart:updated', 'cart:changed', 'ajaxCart:updated'].forEach(eventName => {
        document.addEventListener(eventName, () => {
          setTimeout(() => this.processCart(), 80);
        });
      });
    },

    async updateCartQuantity(lineKey, quantity) {
      try {
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            id: lineKey,
            quantity: parseInt(quantity)
          })
        });
        
        if (response.ok) {
          const cart = await response.json();
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
          this.processCart();
        }
      } catch (error) {
        console.error('[CartUpdates] Error updating quantity:', error);
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      CartUpdates.init();
      CartRecommendationsManager.init();
    });
  } else {
    CartUpdates.init();
    CartRecommendationsManager.init();
  }

  // Reinitialize on dynamic content loads
  document.addEventListener('shopify:section:load', () => {
    CartUpdates.initialized = false;
    CartUpdates.init();
  });

})();