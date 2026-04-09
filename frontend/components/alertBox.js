/**
 * Alert Box Component
 * Displays safety alerts and notifications
 */

/**
 * Show a safety alert
 * @param {Object} alertData - Alert data object
 */
function showSafetyAlert(alertData) {
    const alertBox = document.getElementById('safetyAlertBox');
    
    if (!alertBox) return;

    const { type, message, severity } = alertData;
    
    // Determine alert styling based on severity
    let icon = '⚠️';
    let title = 'Alert';
    let bgColor = '#f59e0b';

    switch(severity) {
        case 'critical':
            icon = '🚨';
            title = 'Critical Alert';
            bgColor = '#ef4444';
            break;
        case 'warning':
            icon = '⚠️';
            title = 'Warning';
            bgColor = '#f59e0b';
            break;
        case 'info':
            icon = 'ℹ️';
            title = 'Information';
            bgColor = '#3b82f6';
            break;
        default:
            icon = '⚠️';
            title = 'Alert';
            bgColor = '#f59e0b';
    }

    // Update alert box content
    alertBox.innerHTML = `
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;

    alertBox.style.backgroundColor = bgColor;
    alertBox.style.animation = 'alertPulse 1s ease-in-out';

    // Add to alert history if the table exists
    addToAlertHistory({
        time: new Date().toLocaleTimeString(),
        type: type || 'Door Safety',
        status: severity || 'warning',
        location: 'Main Door'
    });

    // Auto-clear after 5 seconds for non-critical alerts
    if (severity !== 'critical') {
        setTimeout(() => {
            clearSafetyAlert();
        }, 5000);
    }
}

/**
 * Clear the safety alert
 */
function clearSafetyAlert() {
    const alertBox = document.getElementById('safetyAlertBox');
    
    if (!alertBox) return;

    alertBox.innerHTML = `
        <div class="alert-icon">✓</div>
        <div class="alert-content">
            <h4>All Clear</h4>
            <p>No safety alerts detected</p>
        </div>
    `;

    alertBox.style.backgroundColor = '#10b981';
    alertBox.style.animation = '';
}

/**
 * Add alert to history table
 * @param {Object} alert - Alert data
 */
function addToAlertHistory(alert) {
    const tbody = document.getElementById('alertHistoryBody');
    
    if (!tbody) return;

    const row = document.createElement('tr');
    
    // Status badge color
    let statusClass = '';
    switch(alert.status.toLowerCase()) {
        case 'critical':
            statusClass = 'badge-critical';
            break;
        case 'warning':
            statusClass = 'badge-warning';
            break;
        case 'resolved':
            statusClass = 'badge-success';
            break;
        default:
            statusClass = 'badge-info';
    }

    row.innerHTML = `
        <td>${alert.time}</td>
        <td>${alert.type}</td>
        <td><span class="badge ${statusClass}">${alert.status}</span></td>
        <td>${alert.location}</td>
    `;

    // Insert at the beginning
    tbody.insertBefore(row, tbody.firstChild);

    // Keep only last 10 alerts
    while (tbody.children.length > 10) {
        tbody.removeChild(tbody.lastChild);
    }
}

/**
 * Show a general notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, info, warning)
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = 'ℹ️';
    switch(type) {
        case 'success':
            icon = '✓';
            break;
        case 'error':
            icon = '✗';
            break;
        case 'warning':
            icon = '⚠️';
            break;
        default:
            icon = 'ℹ️';
    }

    notification.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${message}</span>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

/**
 * Simulate door safety alert (for demo purposes)
 */
function simulateDoorAlert() {
    showSafetyAlert({
        type: 'Door Safety',
        message: 'Person detected near door area! Please ensure safety before closing doors.',
        severity: 'warning'
    });
}

// Add CSS for alert pulse animation
const style = document.createElement('style');
style.textContent = `
    @keyframes alertPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.9; transform: scale(1.02); }
    }

    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        transform: translateX(400px);
        transition: all 0.3s ease;
        z-index: 1000;
        min-width: 300px;
    }

    .notification.show {
        opacity: 1;
        transform: translateX(0);
    }

    .notification-success {
        background: #10b981;
        color: white;
    }

    .notification-error {
        background: #ef4444;
        color: white;
    }

    .notification-warning {
        background: #f59e0b;
        color: white;
    }

    .notification-info {
        background: #3b82f6;
        color: white;
    }

    .notification-icon {
        font-size: 1.2rem;
    }

    .badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 600;
    }

    .badge-critical {
        background: #ef4444;
        color: white;
    }

    .badge-warning {
        background: #f59e0b;
        color: white;
    }

    .badge-success {
        background: #10b981;
        color: white;
    }

    .badge-info {
        background: #3b82f6;
        color: white;
    }
`;
document.head.appendChild(style);
