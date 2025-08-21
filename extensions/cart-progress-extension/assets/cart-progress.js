// Cart Progress Bar JavaScript
// This script handles the cart progress bar functionality and product recommendations

(function() {
  'use strict';

  const CartProgress = {
    init: function() {
      this.container = document.getElementById('progress-bar-container');
      if (!this.container) return;

      this.loadSettings();
      this.bindEvents();
      this.fetchCart();
    },

    loadSettings: function() {
      const container = this.container;
      this.settings = {
        freeShippingThreshold: parseFloat(container.dataset.threshold || '0'),
        giftThreshold: parseFloat(container.dataset.giftThreshold || '0'),
        discountThreshold: parseFloat(container.dataset.discountThreshold || '0'),
        currency: container.dataset.currency || '£',
        giftProductId: container.dataset.giftProductId || '',
        barStyle: container.dataset.barStyle || 'linear',
        hideWhenReached: container.dataset.hideWhenReached === 'true'
      };
    },

    bindEvents: function() {
      // Listen for cart updates
      document.addEventListener('cart:updated', () => this.fetchCart());
      
      // Listen for add to cart buttons from recommendations
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
          e.preventDefault();
          this.handleAddToCart(e.target);
        }
      });

      // Listen for variant changes
      document.addEventListener('change', (e) => {
        if (e.target.closest('.variant-selectors')) {
          this.updateVariantSelection(e.target.closest('.recommendation-item'));
        }
      });
    },

    fetchCart: function() {
      fetch('/cart.js')
        .then(response => response.json())
        .then(cart => {
          this.updateProgress(cart);
          this.handleGiftLogic(cart);
        })
        .catch(error => {
          console.error('Error fetching cart:', error);
        });
    },

    updateProgress: function(cart) {
      const totalCents = cart.total_price || 0;
      const total = totalCents / 100;
      
      const fill = this.container.querySelector('.progress-bar-fill');
      const messageEl = this.container.querySelector('.progress-bar-message');
      
      if (!fill || !messageEl) return;

      let progress = 0;
      let message = '';
      
      const { freeShippingThreshold, giftThreshold, discountThreshold, currency } = this.settings;

      if (total < freeShippingThreshold) {
        // Working towards free shipping
        progress = Math.min((total / freeShippingThreshold) * 100, 100);
        const remaining = freeShippingThreshold - total;
        message = `Add ${currency}${remaining.toFixed(2)} more for free shipping`;
      } else if (total < giftThreshold && giftThreshold > 0) {
        // Free shipping unlocked, working towards gift
        progress = 100;
        const remaining = giftThreshold - total;
        message = `Free shipping unlocked! Add ${currency}${remaining.toFixed(2)} more for a free gift`;
      } else if (total < discountThreshold && discountThreshold > 0) {
        // Free shipping and gift unlocked, working towards discount
        progress = 100;
        const remaining = discountThreshold - total;
        message = `You have free shipping and gift! Add ${currency}${remaining.toFixed(2)} more to unlock a discount`;
      } else {
        // All goals reached
        progress = 100;
        message = 'Congratulations! You have unlocked all rewards.';
        
        if (this.settings.hideWhenReached) {
          this.container.style.display = 'none';
          return;
        }
      }

      fill.style.width = progress + '%';
      messageEl.textContent = message;
      
      // Show container if it was hidden
      this.container.style.display = 'block';
    },

    handleGiftLogic: function(cart) {
      const { giftThreshold, giftProductId } = this.settings;
      if (!giftProductId || giftThreshold === 0) return;

      const totalCents = cart.total_price || 0;
      const total = totalCents / 100;
      
      const hasGiftInCart = cart.items.some(item => 
        item.product_id.toString() === giftProductId
      );

      if (total >= giftThreshold && !hasGiftInCart) {
        // Add gift product
        this.addGiftToCart(giftProductId);
      } else if (total < giftThreshold && hasGiftInCart) {
        // Remove gift product
        this.removeGiftFromCart(cart, giftProductId);
      }
    },

    addGiftToCart: function(productId) {
      fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: productId,
          quantity: 1
        })
      })
      .then(response => response.json())
      .then(() => {
        // Trigger cart update
        document.dispatchEvent(new CustomEvent('cart:updated'));
      })
      .catch(error => {
        console.error('Error adding gift to cart:', error);
      });
    },

    removeGiftFromCart: function(cart, giftProductId) {
      const giftItem = cart.items.find(item => 
        item.product_id.toString() === giftProductId
      );
      
      if (!giftItem) return;

      fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: giftItem.key,
          quantity: 0
        })
      })
      .then(response => response.json())
      .then(() => {
        // Trigger cart update
        document.dispatchEvent(new CustomEvent('cart:updated'));
      })
      .catch(error => {
        console.error('Error removing gift from cart:', error);
      });
    },

    handleAddToCart: function(button) {
      const productId = button.dataset.productId;
      const variantId = button.dataset.variantId;
      const quantity = parseInt(button.dataset.quantity || '1');

      let addVariantId = variantId;

      // If no variant ID, get it from selectors
      if (!addVariantId && productId) {
        const recommendationItem = button.closest('.recommendation-item');
        addVariantId = this.getSelectedVariantId(recommendationItem);
      }

      if (!addVariantId) {
        alert('Please select all product options');
        return;
      }

      button.disabled = true;
      button.textContent = 'Adding...';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: addVariantId,
          quantity: quantity
        })
      })
      .then(response => response.json())
      .then(() => {
        button.textContent = 'Added!';
        // Trigger cart update
        document.dispatchEvent(new CustomEvent('cart:updated'));
        
        setTimeout(() => {
          button.disabled = false;
          button.textContent = button.dataset.originalText || 'Add+';
        }, 2000);
      })
      .catch(error => {
        console.error('Error adding to cart:', error);
        button.disabled = false;
        button.textContent = 'Error';
        
        setTimeout(() => {
          button.textContent = button.dataset.originalText || 'Add+';
        }, 2000);
      });
    },

    getSelectedVariantId: function(recommendationItem) {
      // This would need to be implemented based on your variant selection logic
      // For now, return null to require manual variant ID setting
      return null;
    },

    updateVariantSelection: function(recommendationItem) {
      // Update the add to cart button with the selected variant
      // This would need product variant data to be fully implemented
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CartProgress.init());
  } else {
    CartProgress.init();
  }

  // Also initialize on Shopify section loads (theme editor)
  document.addEventListener('shopify:section:load', () => CartProgress.init());

})();
