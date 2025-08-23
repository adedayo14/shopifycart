// Cart Recommendations - Simple ES5 Compatible Version
// File: extensions/cart-progress-extension/assets/cart-recommendations-simple.js

(function() {
  'use strict';

  function CartRecommendations(container) {
    this.container = container;
    this.track = container.querySelector('.recommendations-track');
    this.cards = container.querySelectorAll('.recommendation-card');
    this.currentIndex = 0;
    
    this.init();
  }

  CartRecommendations.prototype.init = function() {
    console.log('[CartRecommendations] Initializing horizontal carousel');
    
    // Cache elements
    this.cacheElements();
    
    // Bind events
    this.bindEvents();
    
    // Setup scroll controls
    this.setupScrollControls();
  };

  CartRecommendations.prototype.cacheElements = function() {
    this.section = this.container.closest('.cart-recommendations-section');
    this.prevBtn = this.section.querySelector('.carousel-controls .carousel-arrow.prev');
    this.nextBtn = this.section.querySelector('.carousel-controls .carousel-arrow.next');
    this.controls = this.section.querySelector('.carousel-controls');
    this.toggleBtn = this.section.querySelector('.recommendations-toggle');
    this.colorSwatches = this.container.querySelectorAll('.color-swatch');
    this.sizeSelects = this.container.querySelectorAll('.size-select');
    this.addButtons = this.container.querySelectorAll('.add-btn');
    
    var wrapper = this.section.querySelector('.recommendations-container-wrapper');
    this.successEnabled = wrapper && wrapper.dataset.successEnabled === 'true';
    this.successColor = (wrapper && wrapper.dataset.successColor) || '#22c55e';
  };

  CartRecommendations.prototype.bindEvents = function() {
    var self = this;
    
    // Arrow navigation
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', function() { self.scrollPrev(); });
    }
    
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', function() { self.scrollNext(); });
    }

    // Toggle collapse
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', function() { self.toggleCollapse(); });
    }

    // Color swatches
    this.colorSwatches.forEach(function(swatch) {
      swatch.addEventListener('click', function(e) { self.handleColorChange(e); });
    });

    // Size selects
    this.sizeSelects.forEach(function(select) {
      var firstAvail = Array.from(select.options).find(function(o) { return o.value; });
      if (firstAvail && !select.value) {
        select.value = firstAvail.value;
        self.handleSizeChange({ currentTarget: select });
      }
      select.addEventListener('change', function(e) { self.handleSizeChange(e); });
    });

    // Add buttons
    this.addButtons.forEach(function(btn) {
      btn.addEventListener('click', function(e) { self.handleAddToCart(e); });
    });

    // Scroll event for arrow states
    this.container.addEventListener('scroll', function() { self.updateArrowStates(); });
  };

  CartRecommendations.prototype.setupScrollControls = function() {
    this.cardWidth = (this.cards[0] && this.cards[0].offsetWidth) || 300;
    this.gap = 15;
    this.scrollAmount = this.cardWidth + this.gap;
    
    this.updateArrowStates(true);
  };

  CartRecommendations.prototype.scrollPrev = function() {
    var currentScroll = this.container.scrollLeft;
    var targetScroll = Math.max(0, currentScroll - this.scrollAmount);
    
    this.container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  CartRecommendations.prototype.scrollNext = function() {
    var currentScroll = this.container.scrollLeft;
    var maxScroll = this.container.scrollWidth - this.container.clientWidth;
    var targetScroll = Math.min(maxScroll, currentScroll + this.scrollAmount);
    
    this.container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  CartRecommendations.prototype.updateArrowStates = function(initial) {
    if (!this.prevBtn || !this.nextBtn) return;
    var scrollLeft = this.container.scrollLeft;
    var maxScroll = this.container.scrollWidth - this.container.clientWidth;
    var scrollable = maxScroll > 5;

    if (this.controls) {
      if (this.container.classList.contains('collapsed') || this.cards.length <= 1) {
        this.controls.style.display = 'none';
      } else {
        this.controls.style.display = 'flex';
      }
    }

    this.prevBtn.disabled = scrollLeft <= 0 || !scrollable;
    this.nextBtn.disabled = scrollLeft >= maxScroll - 1 || !scrollable;
  };

  CartRecommendations.prototype.toggleCollapse = function() {
    var isExpanded = this.toggleBtn.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      this.container.classList.add('collapsed');
      this.toggleBtn.setAttribute('aria-expanded', 'false');
      if (this.controls) this.controls.style.display = 'none';
    } else {
      this.container.classList.remove('collapsed');
      this.toggleBtn.setAttribute('aria-expanded', 'true');
      this.updateArrowStates();
    }
  };

  CartRecommendations.prototype.handleColorChange = function(e) {
    var swatch = e.currentTarget;
    var card = swatch.closest('.recommendation-card');
    var variantId = swatch.dataset.variantId;
    
    card.querySelectorAll('.color-swatch').forEach(function(s) {
      s.classList.remove('active');
    });
    swatch.classList.add('active');
    
    var addBtn = card.querySelector('.add-btn');
    if (addBtn && variantId) {
      addBtn.dataset.variantId = variantId;
    }
  };

  CartRecommendations.prototype.handleSizeChange = function(e) {
    var select = e.currentTarget;
    var card = select.closest('.recommendation-card');
    var variantId = select.value;
    var selectedOption = select.options[select.selectedIndex];
    var price = selectedOption.dataset.price;
    
    var addBtn = card.querySelector('.add-btn');
    if (addBtn && variantId) {
      addBtn.dataset.variantId = variantId;
    }
    
    if (price) {
      var priceElement = card.querySelector('.product-price');
      if (priceElement) {
        priceElement.textContent = price;
      }
    }
  };

  CartRecommendations.prototype.handleAddToCart = function(e) {
    e.preventDefault();
    var btn = e.currentTarget;
    var card = btn.closest('.recommendation-card');
    var variantId = btn.dataset.variantId;
    var self = this;
    
    // Check if size needs to be selected
    var sizeSelect = card.querySelector('.size-select:not([disabled])');
    if (sizeSelect && !sizeSelect.value) {
      this.showToast('Please select a size', 'error');
      sizeSelect.focus();
      return;
    }
    
    // Use selected variant or button's variant
    var selectedVariantId = (sizeSelect && sizeSelect.value) ? sizeSelect.value : variantId;
    
    if (!selectedVariantId) {
      this.showToast('Please select options', 'error');
      return;
    }
    
    // Loading state
    btn.classList.add('loading');
    btn.disabled = true;
    var originalText = btn.textContent;
    btn.textContent = '...';
    
    var formData = new FormData();
    formData.append('id', selectedVariantId);
    formData.append('quantity', '1');
    
    fetch('/cart/add.js', {
      method: 'POST',
      body: formData
    })
    .then(function(response) {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Failed to add to cart');
      }
    })
    .then(function(item) {
      console.log('[CartRecommendations] Item added successfully:', item);
      
      // Success state
      btn.classList.remove('loading');
      btn.classList.add('added');
      btn.textContent = '✓';
      
      // Show success message
      if (self.successEnabled) {
        self.showToast('Added to cart', 'success');
      }
      
      // Remove card from recommendations list immediately
      var cardToRemove = btn.closest('.recommendation-card');
      if (cardToRemove) {
        cardToRemove.remove();
        self.refreshCardsState();
      }
      
      // Trigger soft refresh like quantity changes do
      self.triggerSoftCartRefresh();
    })
    .catch(function(error) {
      console.error('[CartRecommendations] Error:', error);
      
      // Reset button
      btn.classList.remove('loading');
      btn.textContent = originalText;
      btn.disabled = false;
      
      self.showToast('Failed to add to cart', 'error');
    });
  };

  // Universal cart UI update function (following Shopify best practices)
  CartRecommendations.prototype.updateCartUI = function(cart) {
    console.log('[CartRecommendations] Updating cart UI with:', cart.item_count, 'items');
    
    // Update cart count elements (standard selectors)
    var cartCountSelectors = [
      '#cart-count',
      '[data-cart-count]', 
      '.cart-count', 
      '.header__cart-count',
      '.cart-icon-bubble',
      '.cart__count-bubble'
    ];
    
    cartCountSelectors.forEach(function(selector) {
      document.querySelectorAll(selector).forEach(function(el) {
        el.textContent = cart.item_count;
        el.setAttribute('data-count', cart.item_count);
      });
    });
    
    // Update cart totals
    var formattedTotal = (cart.total_price / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });
    
    var cartTotalSelectors = [
      '[data-cart-total]', 
      '.cart-total',
      '.cart__total',
      '.cart-subtotal'
    ];
    
    cartTotalSelectors.forEach(function(selector) {
      document.querySelectorAll(selector).forEach(function(el) {
        el.textContent = formattedTotal;
      });
    });
    
    // Dispatch the standard cart:update event as recommended
    document.dispatchEvent(new CustomEvent('cart:update', { 
      detail: { cart: cart }, 
      bubbles: true 
    }));
  };

  CartRecommendations.prototype.triggerSoftCartRefresh = function() {
    var self = this;
    console.log('[CartRecommendations] Triggering cart refresh...');
    
    // Method 1: Immediate events
    document.dispatchEvent(new CustomEvent('cart:updated'));
    document.dispatchEvent(new CustomEvent('cart:changed'));
    
    // Method 2: Force page refresh sections (like themes do)
    setTimeout(function() {
      // Try to refresh cart sections directly
      var cartSections = document.querySelectorAll('[data-section-type="cart"], .cart-drawer, [data-cart-drawer]');
      if (cartSections.length > 0) {
        console.log('[CartRecommendations] Found cart sections, refreshing...');
        cartSections.forEach(function(section) {
          var sectionId = section.dataset.sectionId || 'cart';
          // Force section reload if possible
          if (window.Shopify && window.Shopify.theme && window.Shopify.theme.sections) {
            window.Shopify.theme.sections.load(sectionId);
          }
        });
      }
      
      // Method 3: Universal cart refresh approach
      fetch('/cart.js')
        .then(function(response) { return response.json(); })
        .then(function(cart) {
          console.log('[CartRecommendations] Cart data fetched:', cart.item_count, 'items');
          
          // Use the standardized updateCartUI function
          self.updateCartUI(cart);
          
          // Fire comprehensive events with cart data (following Shopify best practices)
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart, bubbles: true }));
          document.dispatchEvent(new CustomEvent('cart:change', { detail: cart, bubbles: true }));
          document.dispatchEvent(new CustomEvent('cart:update', { detail: { cart: cart }, bubbles: true }));
          document.dispatchEvent(new CustomEvent('shopify:cart:update', { detail: cart, bubbles: true }));
          
          // Try theme-specific refresh methods
          if (window.theme) {
            if (typeof window.theme.cartUpdate === 'function') window.theme.cartUpdate();
            if (typeof window.theme.cart === 'object' && typeof window.theme.cart.update === 'function') {
              window.theme.cart.update();
            }
          }
          
          if (window.CartJS && typeof window.CartJS.getCart === 'function') {
            window.CartJS.getCart();
          }
          
          // Simulate quantity input changes (most reliable method)
          var quantityInputs = document.querySelectorAll('input[name*="quantity"], input[name*="updates"], .cart__quantity-input');
          if (quantityInputs.length > 0) {
            console.log('[CartRecommendations] Triggering quantity change events...');
            quantityInputs.forEach(function(input) {
              var events = ['input', 'change', 'blur'];
              events.forEach(function(eventType) {
                var event = new Event(eventType, { bubbles: true, cancelable: true });
                input.dispatchEvent(event);
              });
            });
          }
          
          // Force trigger form submission events (without actually submitting)
          var cartForms = document.querySelectorAll('form[action="/cart"], form[action*="/cart"]');
          cartForms.forEach(function(form) {
            var events = ['change', 'input'];
            events.forEach(function(eventType) {
              var event = new Event(eventType, { bubbles: true, cancelable: true });
              form.dispatchEvent(event);
            });
          });
          
          // Last resort: trigger window events that themes often listen to
          window.dispatchEvent(new Event('resize'));
          window.dispatchEvent(new CustomEvent('cart:refresh'));
          
          console.log('[CartRecommendations] All cart refresh methods triggered');
        })
        .catch(function(e) {
          console.warn('[CartRecommendations] Cart refresh failed:', e);
        });
    }, 50);;
  };

  CartRecommendations.prototype.formatMoney = function(cents) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(cents / 100);
  };

  CartRecommendations.prototype.showToast = function(message, type) {
    type = type || 'info';
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    
    var bgColor = type === 'success' ? this.successColor : type === 'error' ? '#ef4444' : '#3b82f6';
    
    toast.style.cssText = 
      'position: fixed;' +
      'bottom: 20px;' +
      'right: 20px;' +
      'padding: 12px 20px;' +
      'background: ' + bgColor + ';' +
      'color: white;' +
      'border-radius: 8px;' +
      'font-size: 14px;' +
      'font-weight: 500;' +
      'z-index: 9999;' +
      'animation: slideUp 0.3s ease;' +
      'box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
    
    document.body.appendChild(toast);
    
    // Remove after delay
    setTimeout(function() {
      toast.remove();
    }, 3000);
  };

  CartRecommendations.prototype.refreshCardsState = function() {
    this.cards = this.container.querySelectorAll('.recommendation-card');
    if (!this.cards.length) {
      this.section.remove();
      return;
    }
    this.setupScrollControls();
  };

  // Initialize all recommendation containers
  function initRecommendations() {
    var containers = document.querySelectorAll('.recommendations-container');
    
    containers.forEach(function(container) {
      if (!container.dataset.initialized) {
        new CartRecommendations(container);
        container.dataset.initialized = 'true';
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecommendations);
  } else {
    initRecommendations();
  }

  // Reinitialize on Shopify events
  document.addEventListener('shopify:section:load', function(event) {
    var container = event.target.querySelector('.recommendations-container');
    if (container && !container.dataset.initialized) {
      new CartRecommendations(container);
      container.dataset.initialized = 'true';
    }
  });

  // Export for debugging
  window.CartRecommendations = CartRecommendations;

})();
