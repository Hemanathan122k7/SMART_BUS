/**
 * Authentication Script
 * Handles login, logout, and session management
 */

// Demo credentials (in real app, this would be validated against backend)
const DEMO_USERS = {
    admin: {
        'admin001': { password: 'admin123', name: 'District Admin - North', role: 'admin', district: 'North District' },
        'admin': { password: 'admin', name: 'System Administrator', role: 'admin', district: 'Central District' }
    },
    sector: {
        'sector001': { password: 'sector123', name: 'Sector Incharge - Zone A', role: 'sector', district: 'North District', sectorId: 'SECTOR_A' },
        'sector002': { password: 'sector123', name: 'Sector Incharge - Zone B', role: 'sector', district: 'North District', sectorId: 'SECTOR_B' },
        'sector': { password: 'sector', name: 'Demo Sector Incharge', role: 'sector', district: 'Central District', sectorId: 'SECTOR_DEMO' }
    },
    operator: {
        'op001': { password: 'op123', name: 'Operator 001', role: 'operator', busId: 'BUS001', sectorId: 'SECTOR_A' },
        'op002': { password: 'op123', name: 'Operator 002', role: 'operator', busId: 'BUS002', sectorId: 'SECTOR_A' },
        'operator': { password: 'operator', name: 'Demo Operator', role: 'operator', busId: 'BUS001', sectorId: 'SECTOR_DEMO' }
    }
};

/**
 * Handle login form submission
 * @param {string} role - User role (admin/operator)
 * @param {string} userId - User ID
 * @param {string} password - User password
 */
function handleLogin(role, userId, password) {
    // Clear previous errors
    hideError();

    // Validate inputs
    if (!role) {
        showError('Please select a role');
        return;
    }

    if (!userId || !password) {
        showError('Please enter both User ID and Password');
        return;
    }

    // Check credentials
    const users = DEMO_USERS[role];
    
    if (!users || !users[userId]) {
        showError('Invalid User ID or Password');
        return;
    }

    const user = users[userId];
    
    if (user.password !== password) {
        showError('Invalid User ID or Password');
        return;
    }

    // Login successful - store user data
    const userData = {
        id: userId,
        name: user.name,
        role: user.role,
        busId: user.busId || null,
        sectorId: user.sectorId || null,
        district: user.district || null,
        loginTime: new Date().toISOString()
    };

    // Store in session storage
    sessionStorage.setItem('currentUser', JSON.stringify(userData));
    sessionStorage.setItem('authToken', generateToken());

    // Show success message
    showSuccess('Login successful! Redirecting...');

    // Redirect based on role
    setTimeout(() => {
        if (role === 'admin') {
            window.location.href = 'admin.html';
        } else if (role === 'sector') {
            window.location.href = 'sector.html';
        } else if (role === 'operator') {
            window.location.href = 'operator.html';
        }
    }, 1000);
}

/**
 * Handle logout
 */
function logout() {
    // Clear session storage
    sessionStorage.clear();
    
    // Clear local storage if needed
    // localStorage.clear();

    // Redirect to login page
    window.location.href = '../pages/login.html';
}

// Make logout function globally accessible
window.logout = logout;

/**
 * Check if user is authenticated
 * @returns {boolean} - True if authenticated
 */
function isAuthenticated() {
    const user = sessionStorage.getItem('currentUser');
    const token = sessionStorage.getItem('authToken');
    return user !== null && token !== null;
}

/**
 * Get current user data
 * @returns {Object|null} - User data or null
 */
function getCurrentUser() {
    const userData = sessionStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
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
 * Check role access
 * @param {string} requiredRole - Required role for the page
 */
function checkRoleAccess(requiredRole) {
    const user = getCurrentUser();
    
    if (!user || user.role !== requiredRole) {
        alert('Access denied! You do not have permission to view this page.');
        logout();
    }
}

/**
 * Generate a simple auth token (demo purposes)
 * @returns {string} - Generated token
 */
function generateToken() {
    return 'token_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.className = 'alert alert-error';
        errorElement.style.display = 'block';
        errorElement.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        errorElement.style.color = 'white';
        errorElement.style.fontWeight = '600';
        errorElement.style.fontSize = '1rem';
        errorElement.style.padding = '14px 20px';
        errorElement.style.borderRadius = '10px';
        errorElement.style.boxShadow = '0 4px 20px rgba(239, 68, 68, 0.4)';
    } else {
        alert(message);
    }
}

/**
 * Hide error message
 */
function hideError() {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

/**
 * Show success message
 * @param {string} message - Success message
 */
function showSuccess(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.className = 'alert alert-success';
        errorElement.style.display = 'block';
        errorElement.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        errorElement.style.color = 'white';
        errorElement.style.fontWeight = '600';
        errorElement.style.fontSize = '1.1rem';
        errorElement.style.padding = '16px 20px';
        errorElement.style.borderRadius = '10px';
        errorElement.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
        errorElement.style.animation = 'pulse 0.5s ease';
    }
}

/**
 * Refresh session (keep user logged in)
 */
function refreshSession() {
    const user = getCurrentUser();
    if (user) {
        user.lastActivity = new Date().toISOString();
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    }
}

// Auto-refresh session every 5 minutes
setInterval(refreshSession, 5 * 60 * 1000);

// Add session activity tracking
document.addEventListener('click', refreshSession);
document.addEventListener('keypress', refreshSession);

/**
 * Get user display name
 * @returns {string} - User's display name
 */
function getUserDisplayName() {
    const user = getCurrentUser();
    return user ? user.name : 'Unknown User';
}

/**
 * Initialize auth on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    // Check if on login page
    const isLoginPage = window.location.pathname.includes('login.html');
    
    // If already logged in and on login page, redirect to dashboard
    if (isLoginPage && isAuthenticated()) {
        const user = getCurrentUser();
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
        } else if (user.role === 'sector') {
            window.location.href = 'sector.html';
        } else if (user.role === 'operator') {
            window.location.href = 'operator.html';
        }
    }
    
    // If not on login page and not authenticated, redirect to login
    if (!isLoginPage && !window.location.pathname.includes('busstop.html') && 
        !window.location.pathname.includes('index.html')) {
        protectPage();
    }
});
