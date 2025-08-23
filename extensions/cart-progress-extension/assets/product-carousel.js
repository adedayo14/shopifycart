// Product Carousel JavaScript
// File: extensions/product-carousel-extension/assets/product-carousel.js

(function() {
  'use strict';

  class ProductCarousel {
    constructor(container) {
      this.container = container;
      this.blockId = container.dataset.blockId;
      this.autoplay = container.dataset.autoplay === 'true';
      this.autoplaySpeed = parseInt(container.dataset.autoplaySpeed) * 1000 || 5000;
      this.transitionSpeed = parseInt(container.dataset.transitionSpeed) || 600;
      
      this.currentSlide = 1;
      this.totalSlides = 0;
      this.autoplayTimer = null;
      this.isTransitioning = false;
      
      this.init();
    }

    init() {
      console.log('[ProductCarousel] Initializing carousel:', this.blockId);
      
      // Cache DOM elements
      this.cacheElements();
      
      // Count slides
      this.countSlides();
      
      // Bind events
      this.bindEvents();
      
      // Start autoplay if enabled
      if (this.autoplay && this.totalSlides > 1) {
        this.startAutoplay();
      }
      
      // Set initial state
      this.updateContent(1);
    }

    cacheElements() {
      this.slides = this.container.querySelectorAll('.carousel-slide');
      this.indicators = this.container.querySelectorAll('.indicator');
      this.prevButton = this.container.querySelector('.carousel-nav-prev');
      this.nextButton = this.container.querySelector('.carousel-nav-next');
      this.titleElement = this.container.querySelector('[data-title-main]');
      this.descriptionElement = this.container.querySelector('[data-description]');
      this.primaryLink = this.container.querySelector('[data-product-link]');
      this.secondaryLink = this.container.querySelector('[data-secondary-link]');
    }

    countSlides() {
      this.totalSlides = this.slides.length;
      console.log('[ProductCarousel] Total slides:', this.totalSlides);
    }

    bindEvents() {
      // Indicator clicks
      this.indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
          this.goToSlide(index + 1);
        });
      });

      // Navigation arrows
      if (this.prevButton) {
        this.prevButton.addEventListener('click', () => {
          this.previousSlide();
        });
      }

      if (this.nextButton) {
        this.nextButton.addEventListener('click', () => {
          this.nextSlide();
        });
      }

      // Pause on hover
      this.container.addEventListener('mouseenter', () => {
        this.pauseAutoplay();
      });

      this.container.addEventListener('mouseleave', () => {
        if (this.autoplay && this.totalSlides > 1) {
          this.startAutoplay();
        }
      });

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (!this.isCarouselInView()) return;
        
        if (e.key === 'ArrowLeft') {
          this.previousSlide();
        } else if (e.key === 'ArrowRight') {
          this.nextSlide();
        }
      });

      // Touch/swipe support
      this.addSwipeSupport();

      // Visibility change (pause when tab is not active)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pauseAutoplay();
        } else if (this.autoplay && this.totalSlides > 1) {
          this.startAutoplay();
        }
      });
    }

    addSwipeSupport() {
      let touchStartX = 0;
      let touchEndX = 0;
      let touchStartY = 0;
      let touchEndY = 0;

      const imageContainer = this.container.querySelector('.carousel-images');
      
      imageContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      });

      imageContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        this.handleSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
      });
    }

    handleSwipe(startX, endX, startY, endY) {
      const diffX = startX - endX;
      const diffY = startY - endY;
      const minSwipeDistance = 50;

      // Only handle horizontal swipes
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
        if (diffX > 0) {
          // Swipe left - next slide
          this.nextSlide();
        } else {
          // Swipe right - previous slide
          this.previousSlide();
        }
      }
    }

    goToSlide(slideNumber) {
      if (this.isTransitioning || slideNumber === this.currentSlide) return;
      if (slideNumber < 1 || slideNumber > this.totalSlides) return;

      this.isTransitioning = true;
      console.log('[ProductCarousel] Going to slide:', slideNumber);

      // Update slides
      this.slides.forEach((slide, index) => {
        if (index + 1 === slideNumber) {
          slide.classList.add('active', 'transitioning');
        } else {
          slide.classList.remove('active');
        }
      });

      // Update indicators
      this.indicators.forEach((indicator, index) => {
        if (index + 1 === slideNumber) {
          indicator.classList.add('active');
        } else {
          indicator.classList.remove('active');
        }
      });

      // Update content
      this.updateContent(slideNumber);

      // Update current slide
      this.currentSlide = slideNumber;

      // Reset autoplay timer
      if (this.autoplay) {
        this.resetAutoplay();
      }

      // Clear transitioning flag
      setTimeout(() => {
        this.isTransitioning = false;
        this.slides.forEach(slide => {
          slide.classList.remove('transitioning');
        });
      }, this.transitionSpeed);
    }

    updateContent(slideNumber) {
      const activeSlide = this.slides[slideNumber - 1];
      if (!activeSlide) return;

      const title = activeSlide.dataset.title;
      const description = activeSlide.dataset.description;
      const productUrl = activeSlide.dataset.productUrl;

      // Fade out current content
      if (this.titleElement) {
        this.titleElement.style.opacity = '0';
        this.titleElement.style.transform = 'translateY(-10px)';
      }
      if (this.descriptionElement) {
        this.descriptionElement.style.opacity = '0';
        this.descriptionElement.style.transform = 'translateY(-10px)';
      }

      // Update content after fade out
      setTimeout(() => {
        if (this.titleElement && title) {
          this.titleElement.textContent = title;
          this.titleElement.style.opacity = '1';
          this.titleElement.style.transform = 'translateY(0)';
        }

        if (this.descriptionElement && description) {
          this.descriptionElement.textContent = description;
          this.descriptionElement.style.opacity = '1';
          this.descriptionElement.style.transform = 'translateY(0)';
        }

        if (this.primaryLink && productUrl) {
          this.primaryLink.href = productUrl;
        }
      }, 300);
    }

    nextSlide() {
      const next = this.currentSlide === this.totalSlides ? 1 : this.currentSlide + 1;
      this.goToSlide(next);
    }

    previousSlide() {
      const prev = this.currentSlide === 1 ? this.totalSlides : this.currentSlide - 1;
      this.goToSlide(prev);
    }

    startAutoplay() {
      this.pauseAutoplay();
      this.autoplayTimer = setInterval(() => {
        this.nextSlide();
      }, this.autoplaySpeed);
      console.log('[ProductCarousel] Autoplay started');
    }

    pauseAutoplay() {
      if (this.autoplayTimer) {
        clearInterval(this.autoplayTimer);
        this.autoplayTimer = null;
        console.log('[ProductCarousel] Autoplay paused');
      }
    }

    resetAutoplay() {
      if (this.autoplay && this.totalSlides > 1) {
        this.pauseAutoplay();
        this.startAutoplay();
      }
    }

    isCarouselInView() {
      const rect = this.container.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    }

    destroy() {
      this.pauseAutoplay();
      console.log('[ProductCarousel] Carousel destroyed:', this.blockId);
    }
  }

  // Initialize all carousels on the page
  function initCarousels() {
    const carousels = document.querySelectorAll('.product-carousel-container');
    
    carousels.forEach(carousel => {
      // Check if already initialized
      if (!carousel.dataset.initialized) {
        const instance = new ProductCarousel(carousel);
        carousel.dataset.initialized = 'true';
        
        // Store instance for potential cleanup
        carousel.carouselInstance = instance;
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousels);
  } else {
    initCarousels();
  }

  // Reinitialize on Shopify section load
  document.addEventListener('shopify:section:load', (event) => {
    const section = event.target;
    const carousel = section.querySelector('.product-carousel-container');
    
    if (carousel && !carousel.dataset.initialized) {
      const instance = new ProductCarousel(carousel);
      carousel.dataset.initialized = 'true';
      carousel.carouselInstance = instance;
    }
  });

  // Clean up on section unload
  document.addEventListener('shopify:section:unload', (event) => {
    const section = event.target;
    const carousel = section.querySelector('.product-carousel-container');
    
    if (carousel && carousel.carouselInstance) {
      carousel.carouselInstance.destroy();
      delete carousel.carouselInstance;
      delete carousel.dataset.initialized;
    }
  });

  // Handle section reorder
  document.addEventListener('shopify:section:reorder', () => {
    initCarousels();
  });

  // Export for debugging
  window.ProductCarousel = ProductCarousel;