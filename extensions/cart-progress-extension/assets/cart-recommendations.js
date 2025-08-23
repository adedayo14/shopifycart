// Cart Recommendations - Horizontal Scrollable JavaScript
// File: extensions/cart-recommendations-extension/assets/cart-recommendations.js

(function() {
  'use strict';

  class CartRecommendations {
    constructor(container) {
      this.container = container;
      this.track = container.querySelector('.recommendations-track');
      this.cards = container.querySelectorAll('.recommendation-card');
      this.currentIndex = 0;
      
      this.init();
    }

    init() {
      console.log('[CartRecommendations] Initializing horizontal carousel');
      
      // Cache elements
      this.cacheElements();
      
      // Bind events
      this.bindEvents();
      
      // Setup scroll controls
      this.setupScrollControls();
    }

    cacheElements() {
      this.section = this.container.closest('.cart-recommendations-section');
  // Arrows may be outside scroll container now
  this.prevBtn = this.section.querySelector('.carousel-controls .carousel-arrow.prev');
  this.nextBtn = this.section.querySelector('.carousel-controls .carousel-arrow.next');
  this.controls = this.section.querySelector('.carousel-controls');
      this.toggleBtn = this.section.querySelector('.recommendations-toggle');
      this.colorSwatches = this.container.querySelectorAll('.color-swatch');
      this.sizeSelects = this.container.querySelectorAll('.size-select');
      this.addButtons = this.container.querySelectorAll('.add-btn');
    const wrapper = this.section.querySelector('.recommendations-container-wrapper');
    this.successEnabled = wrapper?.dataset.successEnabled === 'true';
    this.successColor = wrapper?.dataset.successColor || '#22c55e';
    }

    bindEvents() {
      // Arrow navigation
      if (this.prevBtn) {
        this.prevBtn.addEventListener('click', () => this.scrollPrev());
      }
      
      if (this.nextBtn) {
        this.nextBtn.addEventListener('click', () => this.scrollNext());
      }

      // Toggle collapse
      if (this.toggleBtn) {
        this.toggleBtn.addEventListener('click', () => this.toggleCollapse());
      }

      // Color swatches
      this.colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', (e) => this.handleColorChange(e));
      });

      // Size selects
        // Size selects (auto-select first available)
        this.sizeSelects.forEach(select => {
          const firstAvail = Array.from(select.options).find(o => o.value);
          if (firstAvail && !select.value) {
            select.value = firstAvail.value;
            this.handleSizeChange({ currentTarget: select });
          }
          select.addEventListener('change', (e) => this.handleSizeChange(e));
        });

      // Add buttons
      this.addButtons.forEach(btn => {
        btn.addEventListener('click', (e) => this.handleAddToCart(e));
      });

      // Scroll event for arrow states
      this.container.addEventListener('scroll', () => this.updateArrowStates());

      // Touch/mouse drag scrolling
      this.setupDragScroll();
    }

    setupScrollControls() {
      // Calculate scroll amounts
      this.cardWidth = this.cards[0]?.offsetWidth || 300;
      this.gap = 15;
      this.scrollAmount = this.cardWidth + this.gap;
      
      // Initial arrow state
  this.updateArrowStates(true);
    }

    scrollPrev() {
      const currentScroll = this.container.scrollLeft;
      const targetScroll = Math.max(0, currentScroll - this.scrollAmount);
      
      this.container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }

    scrollNext() {
      const currentScroll = this.container.scrollLeft;
      const maxScroll = this.container.scrollWidth - this.container.clientWidth;
      const targetScroll = Math.min(maxScroll, currentScroll + this.scrollAmount);
      
      this.container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }

    updateArrowStates(initial = false) {
      if (!this.prevBtn || !this.nextBtn) return;
      const scrollLeft = this.container.scrollLeft;
      const maxScroll = this.container.scrollWidth - this.container.clientWidth;
      const scrollable = maxScroll > 5; // threshold for multiple cards off-screen

      if (this.controls) {
        if (this.container.classList.contains('collapsed') || this.cards.length <= 1) {
          this.controls.style.display = 'none';
        } else {
          this.controls.style.display = 'flex';
        }
      }

      // Disable states even if not scrollable (will both end up disabled)
      this.prevBtn.disabled = scrollLeft <= 0 || !scrollable;
      this.nextBtn.disabled = scrollLeft >= maxScroll - 1 || !scrollable;
    }

    setupDragScroll() {
      let isMouseDown = false;
      let startX;
      let scrollLeft;

      this.container.addEventListener('mousedown', (e) => {
        // Only on container, not on buttons
        if (e.target.closest('button, select')) return;
        
        isMouseDown = true;
        this.container.style.cursor = 'grabbing';
        startX = e.pageX - this.container.offsetLeft;
        scrollLeft = this.container.scrollLeft;
      });

      this.container.addEventListener('mouseleave', () => {
        isMouseDown = false;
        this.container.style.cursor = 'grab';
      });

      this.container.addEventListener('mouseup', () => {
        isMouseDown = false;
        this.container.style.cursor = 'grab';
      });

      this.container.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        e.preventDefault();
        const x = e.pageX - this.container.offsetLeft;
        const walk = (x - startX) * 2;
        this.container.scrollLeft = scrollLeft - walk;
      });

      // Touch support
      let touchStartX = 0;
      
      this.container.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
      });

      this.container.addEventListener('touchmove', (e) => {
        if (!touchStartX) return;
        
        const touchEndX = e.touches[0].clientX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 5) {
          e.preventDefault();
          this.container.scrollLeft += diff * 0.5;
          touchStartX = touchEndX;
        }
      });

      this.container.addEventListener('touchend', () => {
        touchStartX = 0;
      });
    }

    toggleCollapse() {
      const isExpanded = this.toggleBtn.getAttribute('aria-expanded') === 'true';
      
      if (isExpanded) {
        this.container.classList.add('collapsed');
        this.toggleBtn.setAttribute('aria-expanded', 'false');
  if (this.controls) this.controls.style.display = 'none';
      } else {
        this.container.classList.remove('collapsed');
        this.toggleBtn.setAttribute('aria-expanded', 'true');
  // Recalculate visibility of controls only if scrollable
  this.updateArrowStates();
      }
    }

    handleColorChange(e) {
      const swatch = e.currentTarget;
      const card = swatch.closest('.recommendation-card');
      const variantId = swatch.dataset.variantId;
      
      // Update active state
      card.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.remove('active');
      });
      swatch.classList.add('active');
      
      // Update add button variant
      const addBtn = card.querySelector('.add-btn');
      if (addBtn && variantId) {
        addBtn.dataset.variantId = variantId;
      }
    }

    handleSizeChange(e) {
      const select = e.currentTarget;
      const card = select.closest('.recommendation-card');
      const variantId = select.value;
      const selectedOption = select.options[select.selectedIndex];
      const price = selectedOption.dataset.price;
      
      // Update add button
      const addBtn = card.querySelector('.add-btn');
      if (addBtn && variantId) {
        addBtn.dataset.variantId = variantId;
      }
      
      // Update price if provided
      if (price) {
        const priceElement = card.querySelector('.product-price');
        if (priceElement) {
          priceElement.textContent = price;
        }
      }
    }

    async handleAddToCart(e) {
      e.preventDefault();
      const btn = e.currentTarget;
      const card = btn.closest('.recommendation-card');
      const variantId = btn.dataset.variantId;
      
      // Check if size needs to be selected
      const sizeSelect = card.querySelector('.size-select:not([disabled])');
      if (sizeSelect && !sizeSelect.value) {
        this.showToast('Please select a size', 'error');
        sizeSelect.focus();
        return;
      }
      
      // Use selected variant or button's variant
      const selectedVariantId = sizeSelect?.value || variantId;
      
      if (!selectedVariantId) {
        this.showToast('Please select options', 'error');
        return;
      }
      
      // Loading state
      btn.classList.add('loading');
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = '...';
      
      try {
        const formData = new FormData();
        formData.append('id', selectedVariantId);
        formData.append('quantity', '1');
        
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const item = await response.json();
          
          // Success state
          btn.classList.remove('loading');
          btn.classList.add('added');
          btn.textContent = '✓';
          
          // Reset after delay
          setTimeout(() => {
            btn.classList.remove('added');
            btn.textContent = originalText;
            btn.disabled = false;
          }, 2000);
          
          // Update cart
          this.updateCart();
          
          // Show success message
            if (this.successEnabled) {
              this.showToast('Added to cart', 'success');
            }
          
          // Dispatch event
          document.dispatchEvent(new CustomEvent('cart:updated', {
            detail: { item }
          }));
          
          // Remove card from recommendations list (optimistic)
          const cardToRemove = btn.closest('.recommendation-card');
          if (cardToRemove) {
            cardToRemove.remove();
            this.refreshCardsState();
          }
          
        } else {
          throw new Error('Failed to add to cart');
        }
      } catch (error) {
        console.error('[CartRecommendations] Error:', error);
        
        // Reset button
        btn.classList.remove('loading');
        btn.textContent = originalText;
        btn.disabled = false;
        
        this.showToast('Failed to add to cart', 'error');
      }
    }

    async updateCart() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        
        // Update cart count
        document.querySelectorAll('[data-cart-count]').forEach(el => {
          el.textContent = cart.item_count;
        });
        
        // Update cart total
        document.querySelectorAll('[data-cart-total]').forEach(el => {
          el.textContent = this.formatMoney(cart.total_price);
        });
  // Dispatch soft refresh event
  document.dispatchEvent(new CustomEvent('cart:soft-refresh', { detail: { cart } }));
        
  // Attempt to update cart line items in-page if a container exists
  this.updateInlineCartItems(cart);
      } catch (error) {
        console.error('[CartRecommendations] Cart update error:', error);
      }
    }

    formatMoney(cents) {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
      }).format(cents / 100);
    }

    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
  background: ${type === 'success' ? this.successColor : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        animation: slideUp 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      
      document.body.appendChild(toast);
      
      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
      
      // Remove after delay
      setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => {
          toast.remove();
          style.remove();
        }, 300);
      }, 3000);
    }

    refreshCardsState() {
      // Update internal card list
      this.cards = this.container.querySelectorAll('.recommendation-card');
      if (!this.cards.length) {
        // Remove entire section if no recommendations left
        this.section.remove();
        return;
      }
      // Re-evaluate scroll controls visibility
  this.setupScrollControls();
    }

    updateInlineCartItems(cart) {
      // Look for a container (data attribute) to update cart items list dynamically
      const itemsContainer = document.querySelector('[data-cart-items]');
      if (!itemsContainer) return; // Theme not prepared for inline updates
      try {
        itemsContainer.innerHTML = cart.items.map(line => `
          <div class="cart-line" data-line-id="${line.id}">
            <div class="cart-line-image">
              ${line.image ? `<img src="${line.image}" alt="${line.product_title}" loading="lazy" />` : ''}
            </div>
            <div class="cart-line-info">
              <div class="cart-line-title">${line.product_title}</div>
              <div class="cart-line-variant">${line.variant_title || ''}</div>
              <div class="cart-line-qty">Qty: ${line.quantity}</div>
              <div class="cart-line-price">${this.formatMoney(line.final_line_price)}</div>
            </div>
          </div>
        `).join('');
      } catch (e) {
        console.warn('[CartRecommendations] Failed to update inline cart items', e);
      }
    }
  }

  // Initialize all recommendation containers
  function initRecommendations() {
    const containers = document.querySelectorAll('.recommendations-container');
    
    containers.forEach(container => {
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
  document.addEventListener('shopify:section:load', (event) => {
    const container = event.target.querySelector('.recommendations-container');
    if (container && !container.dataset.initialized) {
      new CartRecommendations(container);
      container.dataset.initialized = 'true';
    }
  });

  // Export for debugging
  window.CartRecommendations = CartRecommendations;

})();