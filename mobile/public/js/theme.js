/**
 * Theme Management Module
 * Handles dark/light theme switching with localStorage persistence
 */

class ThemeManager {
    constructor() {
        this.themeKey = 'supportplanner-theme';
        this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        // Apply stored theme immediately to prevent flash
        this.applyTheme(this.currentTheme);
        
        // Set up toggle button
        this.setupToggleButton();
        
        // Listen for system theme changes
        this.watchSystemTheme();
    }

    /**
     * Get stored theme from localStorage
     */
    getStoredTheme() {
        return localStorage.getItem(this.themeKey);
    }

    /**
     * Get system theme preference
     */
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        const html = document.documentElement;
        
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
        
        this.currentTheme = theme;
        this.updateToggleIcon(theme);
        
        // Store preference
        localStorage.setItem(this.themeKey, theme);
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }

    /**
     * Update toggle button icon
     */
    updateToggleIcon(theme) {
        const toggleBtn = document.getElementById('themeToggle');
        if (!toggleBtn) return;
        
        const icon = toggleBtn.querySelector('.material-icons');
        if (icon) {
            icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
        }
    }

    /**
     * Setup toggle button event listener
     */
    setupToggleButton() {
        const toggleBtn = document.getElementById('themeToggle');
        if (!toggleBtn) return;
        
        toggleBtn.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    /**
     * Watch for system theme changes
     */
    watchSystemTheme() {
        if (!window.matchMedia) return;
        
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Modern browsers
        if (darkModeQuery.addEventListener) {
            darkModeQuery.addEventListener('change', (e) => {
                // Only auto-switch if user hasn't manually set a preference
                if (!this.getStoredTheme()) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
        // Older browsers
        else if (darkModeQuery.addListener) {
            darkModeQuery.addListener((e) => {
                if (!this.getStoredTheme()) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    /**
     * Update meta theme-color for mobile browsers
     */
    updateMetaThemeColor(theme) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        // Set appropriate color based on theme
        metaThemeColor.content = theme === 'dark' ? '#1c1c1e' : '#ffffff';
    }

    /**
     * Get current theme
     */
    getTheme() {
        return this.currentTheme;
    }
}

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager = new ThemeManager();
    });
} else {
    window.themeManager = new ThemeManager();
}

export default ThemeManager;
