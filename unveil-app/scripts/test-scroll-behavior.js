/**
 * Manual testing script for select-event scroll behavior
 * 
 * Run this in the browser console on the select-event page to validate:
 * 1. No unnecessary scrolling when content fits
 * 2. Proper scrolling when content exceeds viewport
 * 3. Safe area handling
 */

function testScrollBehavior() {
  console.log('🔍 Testing Select Event Page Scroll Behavior');
  console.log('=' .repeat(50));
  
  // Get scrolling element
  const scrollingElement = document.scrollingElement || document.documentElement;
  
  // Test 1: Check if content fits in viewport
  const scrollHeight = scrollingElement.scrollHeight;
  const clientHeight = scrollingElement.clientHeight;
  const isScrollable = scrollHeight > clientHeight;
  
  console.log('📏 Viewport Measurements:');
  console.log(`   Scroll Height: ${scrollHeight}px`);
  console.log(`   Client Height: ${clientHeight}px`);
  console.log(`   Is Scrollable: ${isScrollable}`);
  
  // Test 2: Check viewport height usage
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  console.log(`   Visual Viewport: ${viewportHeight}px`);
  console.log(`   Window Inner Height: ${window.innerHeight}px`);
  
  // Test 3: Check for proper CSS units
  const mobileShell = document.querySelector('[class*="min-h-mobile"]');
  if (mobileShell) {
    const computedStyle = window.getComputedStyle(mobileShell);
    console.log('✅ Found element using min-h-mobile class');
    console.log(`   Min Height: ${computedStyle.minHeight}`);
  } else {
    console.log('❌ No elements found using min-h-mobile');
  }
  
  // Test 4: Check safe area padding
  const safeElements = document.querySelectorAll('[class*="safe-"]');
  console.log(`📱 Safe Area Elements: ${safeElements.length} found`);
  
  safeElements.forEach((el, i) => {
    const style = window.getComputedStyle(el);
    console.log(`   Element ${i + 1}:`, {
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
    });
  });
  
  // Test 5: Check for scrollbar visibility
  const hasVerticalScrollbar = window.innerWidth > document.documentElement.clientWidth;
  console.log(`🖱️  Vertical Scrollbar Visible: ${hasVerticalScrollbar}`);
  
  // Test 6: Rubber band test (iOS specific)
  if (isScrollable) {
    console.log('⬆️  Content exceeds viewport - scrolling should work normally');
  } else {
    console.log('✨ Content fits viewport - no rubber band effect expected');
    
    // Test scroll attempt
    const initialScrollTop = window.scrollY;
    window.scrollTo(0, 100);
    setTimeout(() => {
      const newScrollTop = window.scrollY;
      if (newScrollTop === initialScrollTop) {
        console.log('✅ No unwanted scrolling - page correctly sized');
      } else {
        console.log('❌ Page scrolled when it shouldn\'t - check implementation');
      }
      window.scrollTo(0, initialScrollTop); // Reset
    }, 100);
  }
  
  // Summary
  console.log('\n📋 Summary:');
  if (!isScrollable && !hasVerticalScrollbar) {
    console.log('✅ PASS: Content fits viewport with no unnecessary scroll');
  } else if (isScrollable) {
    console.log('ℹ️  INFO: Content exceeds viewport - scrolling enabled as expected');
  } else {
    console.log('⚠️  WARNING: Potential scroll issues detected');
  }
  
  return {
    scrollHeight,
    clientHeight,
    isScrollable,
    hasVerticalScrollbar,
    viewportHeight,
    mobileShellFound: !!mobileShell,
    safeElementsCount: safeElements.length
  };
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  // Wait for page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testScrollBehavior);
  } else {
    testScrollBehavior();
  }
}

// Export for manual use
window.testScrollBehavior = testScrollBehavior;
