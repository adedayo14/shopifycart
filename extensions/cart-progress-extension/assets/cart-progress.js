// File: extensions/cart-progress-extension/assets/cart-progress.js
// Modern Cart Progress & Recommendations System

(function() {
  'use strict';

  const SELECTORS = {
    container: '#cart-progress-root',
    progressBar: '#progress-bar-container',
    progressMessage: '#cart-progress-message',
    progressFill: '.progress-fill',
    cartItems: '.cart-items-section',
    recommendations: '#recommendations-section',
    recommendationsToggle: '.recommendations-toggle',
    recommendationsContent: '.recommendations-content',
    qtyBtns: '.qty-btn',
    qtyInputs: '.qty-input',
    removeBtns: '.item-remove',
    addToCartBtns: '.add-to-cart-btn',
    colorSwatches: '.color-swatch',
    sizeSelects: '.size-select',
    checkoutBtn: '.checkout-btn',
    subtotalAmount: '.subtotal-amount'
  };

  const MESSAGES = {
    shipping: 'Spend {amount} more to earn free shipping!',
    gift: 'Add {amount} more to unlock your free gift!',
    discount: 'Add {amount} more to unlock {code} discount!',
    complete: 'All rewards unlocked! 🎉'
  };

  // Utility functions
  function formatMoney(cents, symbol = '£') {
    return symbol + (cents / 100).toFixed(2);
  }

  function parseNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Main Cart Progress & Recommendations Controller
  const CartController = {
    init() {
      this.container = document.querySelector(SELECTORS.container);
      if (!this.container) return;

      this.progressBar = this.container.querySelector(SELECTORS.progressBar);
      this.progressMessage = this.container.querySelector(SELECTORS.progressMessage);
      this.progressFill = this.container.querySelector(SELECTORS.progressFill);
      this.subtotalEl = this.container.querySelector(SELECTORS.subtotalAmount);
      
      this.loadSettings();
      this.bindEvents();
      this.fetchCart();
      this.initRecommendations();
    },

    loadSettings() {
      if (!this.progressBar) return;
      
      const dataset = this.progressBar.dataset;
      this.settings = {
        freeShippingThreshold: parseNumber(dataset.freeThreshold),
        giftThreshold: parseNumber(dataset.giftThreshold),
        discountThreshold: parseNumber(dataset.discountThreshold),
        discountCode: dataset.discountCode || '',
        giftProductId: dataset.giftProductId || '',
        hideWhenComplete: dataset.hideWhenComplete === 'true',
        currencySymbol: dataset.currencySymbol || '£'
      };
    },

    bindEvents() {
      // Cart quantity controls
      this.container.addEventListener('click', this.handleCartActions.bind(this));
      this.container.addEventListener('change', this.handleQuantityChange.bind(this));
      
      // Recommendations toggle
      const toggle = this.container.querySelector(SELECTORS.recommendationsToggle);
      if (toggle) {
        toggle.addEventListener('click', this.toggleRecommendations.bind(this));
      }

      // Global cart events
      document.addEventListener('cart:updated', () => this.fetchCart());
      
      // Periodic refresh for cart sync
      setInterval(() => this.fetchCart(), 30000);
    },

    handleCartActions(event) {
      const target = event.target.closest('button');
      if (!target) return;

      const key = target.dataset.key;
      const variantId = target.dataset.variantId;

      if (target.classList.contains('qty-increase')) {
        this.updateQuantity(key, 1, true);
      } else if (target.classList.contains('qty-decrease')) {
        this.updateQuantity(key, -1, true);
      } else if (target.classList.contains('item-remove')) {
        this.removeItem(key);
      } else if (target.classList.contains('add-to-cart-btn')) {
        this.addToCart(variantId, target);
      }
    },

    handleQuantityChange(event) {
      if (!event.target.classList.contains('qty-input')) return;
      
      const input = event.target;
      const key = input.dataset.key;
      const newQty = parseInt(input.value) || 1;
      
      this.updateQuantity(key, newQty, false);
    },

    async updateQuantity(key, change, isRelative = true) {
      try {
        const currentQty = isRelative ? 
          parseInt(this.container.querySelector(`[data-key="${key}"] .qty-input`).value) || 1 : 
          change;
        
        const newQty = isRelative ? Math.max(1, currentQty + change) : Math.max(1, change);
        
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: newQty })
        });

        if (response.ok) {
          const cart = await response.json();
          this.updateCartDisplay(cart);
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
        }
      } catch (error) {
        console.error('Failed to update quantity:', error);
      }
    },

    async removeItem(key) {
      try {
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: 0 })
        });

        if (response.ok) {
          const cart = await response.json();
          this.updateCartDisplay(cart);
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
        }
      } catch (error) {
        console.error('Failed to remove item:', error);
      }
    },

    async addToCart(variantId, button) {
      if (!variantId) return;
      
      const originalText = button.textContent;
      button.textContent = 'Adding...';
      button.disabled = true;

      try {
        // Get selected variant options
        const productContainer = button.closest('.recommendation-item');
        const selectedOptions = this.getSelectedVariantOptions(productContainer);
        
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: variantId,
            quantity: 1,
            properties: selectedOptions
          })
        });

        if (response.ok) {
          button.textContent = 'Added!';
          setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
          }, 1500);
          
          this.fetchCart();
          document.dispatchEvent(new CustomEvent('cart:updated'));
        } else {
          throw new Error('Failed to add to cart');
        }
      } catch (error) {
        console.error('Add to cart failed:', error);
        button.textContent = 'Error';
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1500);
      }
    },

    getSelectedVariantOptions(container) {
      const options = {};
      
      // Get selected color
      const selectedColor = container.querySelector('.color-swatch.selected');
      if (selectedColor) {
        options.Color = selectedColor.dataset.color;
      }
      
      // Get selected size
      const sizeSelect = container.querySelector('.size-select');
      if (sizeSelect && sizeSelect.value) {
        options.Size = sizeSelect.value;
      }
      
      return options;
    },

    async fetchCart() {
      try {
        const response = await fetch('/cart.js', { credentials: 'same-origin' });
        const cart = await response.json();
        this.updateCartDisplay(cart);
        this.handleGiftLogic(cart);
      } catch (error) {
        console.error('Failed to fetch cart:', error);
      }
    },

    updateCartDisplay(cart) {
      this.updateProgress(cart);
      this.updateSubtotal(cart);
      this.updateQuantityInputs(cart);
    },

    updateProgress(cart) {
      if (!this.progressBar || !this.settings) return;

      const total = (cart.total_price || 0) / 100;
      const { freeShippingThreshold, giftThreshold, discountThreshold, currencySymbol, discountCode } = this.settings;

      // Determine active thresholds and max for progress calculation
      const thresholds = [freeShippingThreshold, giftThreshold, discountThreshold].filter(t => t > 0);
      const maxThreshold = Math.max(...thresholds, 1);
      
      // Calculate progress percentage
      const progressPercent = Math.min((total / maxThreshold) * 100, 100);
      
      if (this.progressFill) {
        this.progressFill.style.width = `${progressPercent}%`;
      }
      
      this.progressBar.setAttribute('aria-valuenow', Math.round(progressPercent));

      // Update message based on current progress
      let message = '';
      const formatAmount = (amount) => formatMoney(Math.max(amount - total, 0) * 100, currencySymbol);

      if (freeShippingThreshold > 0 && total < freeShippingThreshold) {
        message = MESSAGES.shipping.replace('{amount}', formatAmount(freeShippingThreshold));
      } else if (giftThreshold > 0 && total < giftThreshold) {
        message = MESSAGES.gift.replace('{amount}', formatAmount(giftThreshold));
      } else if (discountThreshold > 0 && total < discountThreshold) {
        message = MESSAGES.discount
          .replace('{amount}', formatAmount(discountThreshold))
          .replace('{code}', discountCode);
      } else {
        message = MESSAGES.complete;
        
        if (this.settings.hideWhenComplete) {
          this.progressBar.closest('.progress-section')?.classList.add('cart-progress-hidden');
        }
      }

      if (this.progressMessage) {
        this.progressMessage.textContent = message;
      }
    },

    updateSubtotal(cart) {
      if (this.subtotalEl) {
        this.subtotalEl.textContent = formatMoney(cart.total_price || 0, this.settings.currencySymbol);
      }
    },

    updateQuantityInputs(cart) {
      cart.items?.forEach(item => {
        const input = this.container.querySelector(`[data-key="${item.key}"] .qty-input`);
        if (input && parseInt(input.value) !== item.quantity) {
          input.value = item.quantity;
        }
      });
    },

    handleGiftLogic(cart) {
      const { giftThreshold, giftProductId } = this.settings;
      if (!giftThreshold || !giftProductId) return;

      const total = (cart.total_price || 0) / 100;
      const hasGift = cart.items?.some(item => 
        item.variant_id?.toString() === giftProductId || 
        item.properties?._auto_gift === 'true'
      );

      if (total >= giftThreshold && !hasGift) {
        this.addGiftToCart(giftProductId);
      } else if (total < giftThreshold && hasGift) {
        const giftItem = cart.items.find(item => 
          item.variant_id?.toString() === giftProductId || 
          item.properties?._auto_gift === 'true'
        );
        if (giftItem) {
          this.removeItem(giftItem.key);
        }
      }
    },

    async addGiftToCart(variantId) {
      try {
        await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: variantId,
            quantity: 1,
            properties: { _auto_gift: 'true' }
          })
        });
        
        document.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (error) {
        console.error('Failed to add gift:', error);
      }
    },

    // Recommendations functionality
    initRecommendations() {
      this.bindRecommendationEvents();
      this.loadRecommendationSettings();
    },

    bindRecommendationEvents() {
      // Color swatch selection
      this.container.addEventListener('click', (event) => {
        if (event.target.closest('.color-swatch')) {
          this.handleColorSelection(event);
        }
      });

      // Size selection
      this.container.addEventListener('change', (event) => {
        if (event.target.classList.contains('size-select')) {
          this.handleSizeSelection(event);
        }
      });
    },

    handleColorSelection(event) {
      const swatch = event.target.closest('.color-swatch');
      const container = swatch.closest('.recommendation-item');
      
      // Remove selected class from other swatches in this container
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      
      // Add selected class to clicked swatch
      swatch.classList.add('selected');
      
      // Update variant if needed
      this.updateRecommendationVariant(container);
    },

    handleSizeSelection(event) {
      const container = event.target.closest('.recommendation-item');
      this.updateRecommendationVariant(container);
    },

    updateRecommendationVariant(container) {
      // This would typically involve finding the correct variant based on selected options
      // and updating the add-to-cart button's variant ID
      // Implementation depends on how product variants are structured
    },

    toggleRecommendations() {
      const toggle = this.container.querySelector(SELECTORS.recommendationsToggle);
      const content = this.container.querySelector(SELECTORS.recommendationsContent);
      
      if (!toggle || !content) return;

      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      const newState = !isExpanded;
      
      toggle.setAttribute('aria-expanded', newState);
      toggle.classList.toggle('collapsed', !newState);
      content.classList.toggle('collapsed', !newState);
    },

    loadRecommendationSettings() {
      // Load any recommendation-specific settings
      // This could include tracking, analytics, or display preferences
    }
  };

  // Initialize when DOM is ready
  function init() {
    CartController.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize on section loads (for theme editor)
  document.addEventListener('shopify:section:load', init);

  // Export for potential external use
  window.CartController = CartController;

})();