/**
 * ViewManager - Unified navigation stack for the application
 * Handles full-screen views (map, audit) and bottom sheets (event details)
 * 
 * View Types:
 * - 'fullscreen': Slides in from right, covers entire screen
 * - 'sheet': Slides up from bottom, can be swiped to dismiss
 * - 'modal': Traditional centered modal with backdrop
 */

const ViewManager = {
  stack: ['timeline'], // Base view is always timeline
  activeSheet: null,
  transitionDuration: 300, // ms
  
  /**
   * Get the current top view
   */
  getCurrentView() {
    return this.stack[this.stack.length - 1];
  },
  
  /**
   * Check if a specific view is active
   */
  isViewActive(viewName) {
    return this.stack.includes(viewName);
  },
  
  /**
   * Push a full-screen view onto the stack
   * @param {string} viewName - Name of the view ('map', 'audit', 'experts')
   * @param {Object} options - Optional data to pass to the view
   */
  pushView(viewName, options = {}) {
    if (this.getCurrentView() === viewName) return;
    
    const viewElement = this.getViewElement(viewName);
    if (!viewElement) {
      console.error(`[ViewManager] View element not found: ${viewName}`);
      return;
    }
    
    // Hide timeline and app bar for full-screen views
    this.hideTimeline();
    
    // Prepare view for animation
    viewElement.style.display = 'flex';
    viewElement.classList.add('view-entering');
    
    // Trigger reflow for animation
    viewElement.offsetHeight;
    
    // Start slide-in animation
    viewElement.classList.remove('view-entering');
    viewElement.classList.add('view-active');
    
    this.stack.push(viewName);
    this.updateHistory(viewName);
    
    console.log(`[ViewManager] Pushed: ${viewName}, Stack:`, [...this.stack]);
    
    // Trigger view-specific initialization
    this.onViewEnter(viewName, options);
  },
  
  /**
   * Pop the current view and return to previous
   */
  popView() {
    if (this.stack.length <= 1) {
      console.log('[ViewManager] Cannot pop base view');
      return;
    }
    
    const currentView = this.stack.pop();
    const viewElement = this.getViewElement(currentView);
    
    if (viewElement) {
      // Start slide-out animation
      viewElement.classList.remove('view-active');
      viewElement.classList.add('view-exiting');
      
      setTimeout(() => {
        viewElement.style.display = 'none';
        viewElement.classList.remove('view-exiting');
      }, this.transitionDuration);
    }
    
    // If back to timeline, show it
    if (this.getCurrentView() === 'timeline') {
      this.showTimeline();
    }
    
    console.log(`[ViewManager] Popped: ${currentView}, Stack:`, [...this.stack]);
    
    // Update browser history
    if (this.stack.length === 1) {
      history.pushState({ view: 'timeline' }, '', '#');
    }
  },
  
  /**
   * Show a bottom sheet (for event details, quick actions)
   * @param {string} sheetId - ID of the sheet element
   * @param {Object} data - Data to populate the sheet
   */
  showSheet(sheetId, data = {}) {
    const sheet = document.getElementById(sheetId);
    if (!sheet) {
      console.error(`[ViewManager] Sheet not found: ${sheetId}`);
      return;
    }
    
    // Close existing sheet if any
    if (this.activeSheet && this.activeSheet !== sheetId) {
      this.hideSheet(this.activeSheet);
    }
    
    this.activeSheet = sheetId;
    
    // Show backdrop
    this.showBackdrop();
    
    // Prepare and show sheet
    sheet.style.display = 'flex';
    sheet.classList.add('sheet-entering');
    
    // Trigger reflow
    sheet.offsetHeight;
    
    sheet.classList.remove('sheet-entering');
    sheet.classList.add('sheet-active');
    
    // Setup swipe-to-dismiss
    this.setupSheetGestures(sheet);
    
    console.log(`[ViewManager] Showing sheet: ${sheetId}`);
    
    return sheet;
  },
  
  /**
   * Hide a bottom sheet
   */
  hideSheet(sheetId) {
    const sheet = document.getElementById(sheetId || this.activeSheet);
    if (!sheet) return;
    
    sheet.classList.remove('sheet-active');
    sheet.classList.add('sheet-exiting');
    
    setTimeout(() => {
      sheet.style.display = 'none';
      sheet.classList.remove('sheet-exiting');
    }, this.transitionDuration);
    
    this.hideBackdrop();
    this.activeSheet = null;
    
    console.log(`[ViewManager] Hidden sheet: ${sheetId}`);
  },
  
  /**
   * Setup swipe-to-dismiss gestures for a sheet
   */
  setupSheetGestures(sheet) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    const handleStart = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      startY = touch.clientY;
      isDragging = true;
      sheet.style.transition = 'none';
    };
    
    const handleMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches ? e.touches[0] : e;
      currentY = touch.clientY;
      const deltaY = currentY - startY;
      
      // Only allow dragging down
      if (deltaY > 0) {
        sheet.style.transform = `translateY(${deltaY}px)`;
      }
    };
    
    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      sheet.style.transition = '';
      
      const deltaY = currentY - startY;
      
      // If dragged more than 100px, dismiss
      if (deltaY > 100) {
        this.hideSheet(sheet.id);
      } else {
        sheet.style.transform = '';
      }
    };
    
    // Remove old listeners and add new ones
    sheet.removeEventListener('touchstart', handleStart);
    sheet.removeEventListener('touchmove', handleMove);
    sheet.removeEventListener('touchend', handleEnd);
    
    sheet.addEventListener('touchstart', handleStart, { passive: true });
    sheet.addEventListener('touchmove', handleMove, { passive: true });
    sheet.addEventListener('touchend', handleEnd);
  },
  
  /**
   * Show backdrop for sheets/modals
   */
  showBackdrop() {
    let backdrop = document.getElementById('viewBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'viewBackdrop';
      backdrop.className = 'view-backdrop';
      backdrop.addEventListener('click', () => {
        if (this.activeSheet) {
          this.hideSheet();
        }
      });
      document.body.appendChild(backdrop);
    }
    
    backdrop.style.display = 'block';
    backdrop.offsetHeight; // Reflow
    backdrop.classList.add('backdrop-active');
  },
  
  /**
   * Hide backdrop
   */
  hideBackdrop() {
    const backdrop = document.getElementById('viewBackdrop');
    if (backdrop) {
      backdrop.classList.remove('backdrop-active');
      setTimeout(() => {
        backdrop.style.display = 'none';
      }, this.transitionDuration);
    }
  },
  
  /**
   * Get the DOM element for a view
   */
  getViewElement(viewName) {
    const viewMap = {
      'map': 'mapViewWrapper',
      'audit': 'auditModal',
      'experts': 'expertsModal'
    };
    return document.getElementById(viewMap[viewName] || viewName);
  },
  
  /**
   * Hide timeline and app bar
   */
  hideTimeline() {
    const timeline = document.getElementById('timelineWrapper');
    const appBar = document.querySelector('.app-bar');
    
    if (timeline) timeline.style.display = 'none';
    if (appBar) appBar.style.display = 'none';
  },
  
  /**
   * Show timeline and app bar
   */
  showTimeline() {
    const timeline = document.getElementById('timelineWrapper');
    const appBar = document.querySelector('.app-bar');
    
    if (timeline) timeline.style.display = '';
    if (appBar) appBar.style.display = '';
  },
  
  /**
   * Update browser history for deep linking
   */
  updateHistory(viewName) {
    history.pushState({ view: viewName }, '', `#${viewName}`);
  },
  
  /**
   * Handle browser back button
   */
  handlePopState(event) {
    if (this.activeSheet) {
      this.hideSheet();
      return;
    }
    
    if (this.stack.length > 1) {
      this.popView();
    }
  },
  
  /**
   * Callback when a view is entered
   */
  onViewEnter(viewName, options) {
    // Override in app-simple.js for view-specific logic
    const event = new CustomEvent('viewEnter', { detail: { viewName, options } });
    document.dispatchEvent(event);
  },
  
  /**
   * Initialize the ViewManager
   */
  init() {
    // Handle browser back button
    window.addEventListener('popstate', (e) => this.handlePopState(e));
    
    // Handle ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.activeSheet) {
          this.hideSheet();
        } else if (this.stack.length > 1) {
          this.popView();
        }
      }
    });
    
    // Check URL hash on load
    const hash = window.location.hash.slice(1);
    if (hash && hash !== 'timeline') {
      // Delay to let app initialize
      setTimeout(() => this.pushView(hash), 100);
    }
    
    console.log('[ViewManager] Initialized');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ViewManager;
}
