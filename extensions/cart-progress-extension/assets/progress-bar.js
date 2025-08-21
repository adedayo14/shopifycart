// progress-bar.js
// This script updates the free‑shipping progress bar in real time based on the cart value.

document.addEventListener('DOMContentLoaded', function() {
  var container = document.getElementById('progress-bar-container');
  if (!container) {
    return;
  }
  var threshold = parseFloat(container.dataset.threshold || '0');
  var giftThreshold = parseFloat(container.dataset.giftThreshold || '0');
  var discountThreshold = parseFloat(container.dataset.discountThreshold || '0');
  var currency = container.dataset.currency || '£';

  function updateProgress(cart) {
    var totalCents = cart.total_price || 0;
    var total = totalCents / 100; // convert to currency units
    var progress = 0;
    if (threshold > 0) {
      progress = Math.min((total / threshold) * 100, 100);
    }
    var fill = container.querySelector('.progress-bar-fill');
    if (fill) {
      fill.style.width = progress + '%';
    }
    var messageEl = container.querySelector('.progress-bar-message');
    if (!messageEl) {
      return;
    }
    if (total < threshold) {
      var remaining = threshold - total;
      messageEl.textContent = 'Add ' + currency + remaining.toFixed(2) + ' more for free shipping';
    } else if (total < giftThreshold && giftThreshold > 0) {
      var remainingGift = giftThreshold - total;
      messageEl.textContent = 'Free shipping unlocked! Add ' + currency + remainingGift.toFixed(2) + ' more for a free gift';
    } else if (total < discountThreshold && discountThreshold > 0) {
      var remainingDisc = discountThreshold - total;
      messageEl.textContent = 'You have free shipping and gift! Add ' + currency + remainingDisc.toFixed(2) + ' more to unlock a discount';
    } else {
      messageEl.textContent = 'Congratulations! You have unlocked all rewards.';
    }
  }

  function fetchCart() {
    fetch('/cart.js')
      .then(function(resp) { return resp.json(); })
      .then(function(cart) {
        updateProgress(cart);
      })
      .catch(function() {
        // If cart.js fetch fails, do nothing.
      });
  }
  // initial call
  fetchCart();
  // Update when the cart is updated via Shopify events
  document.addEventListener('cart:updated', fetchCart);
});