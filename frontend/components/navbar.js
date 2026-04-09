/**
 * Navbar Component
 * Handles top navigation bar functionality
 */

/**
 * Initialize navbar
 */
function initNavbar() {
    // Get user information from session storage
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    
    // Update navbar with user info
    if (user.name) {
        const userElement = document.querySelector('.user-info strong');
        if (userElement) {
            userElement.textContent = user.name || user.id;
        }
    }

    // Add logout functionality
    const logoutBtn = document.querySelector('.btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

/**
 * Logout function
 */
function logout() {
    // Clear session storage
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('authToken');
    
    // Show notification
    alert('Logged out successfully');
    
    // Redirect to login page
    window.location.href = 'login.html';
}

/**
 * Check if user is authenticated
 * @returns {boolean} - True if user is authenticated
 */
function isAuthenticated() {
    const user = sessionStorage.getItem('currentUser');
    return user !== null;
}

/**
 * Protect page - redirect to login if not authenticated
 */
function protectPage() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}

/**
 * Get current user data
 * @returns {Object} - Current user object
 */
function getCurrentUser() {
    return JSON.parse(sessionStorage.getItem('currentUser') || '{}');
}

// Initialize navbar when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initNavbar();
});
