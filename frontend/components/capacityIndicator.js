/**
 * Capacity Indicator Component
 * Displays and updates capacity status indicators
 */

/**
 * Update capacity display with current data
 * @param {Object} capacityData - Object containing capacity information
 */
function updateCapacityDisplay(capacityData) {
    const {
        currentPassengers,
        seatingCapacity,
        standingCapacity,
        seatsAvailable,
        standingAvailable
    } = capacityData;

    // Calculate occupied seats and standing
    const seatsOccupied = seatingCapacity - seatsAvailable;
    const standingOccupied = standingCapacity - standingAvailable;
    const totalCapacity = seatingCapacity + standingCapacity;

    // Update text displays
    updateElement('currentPassengers', currentPassengers);
    updateElement('seatsAvailable', seatsAvailable);
    updateElement('standingAvailable', standingAvailable);
    updateElement('passengersOnboard', currentPassengers);
    updateElement('seatsRemaining', seatsAvailable);
    updateElement('standingRemaining', standingAvailable);

    // Update capacity bars
    updateCapacityBar('seatingBar', seatsOccupied, seatingCapacity);
    updateCapacityBar('standingBar', standingOccupied, standingCapacity);
    updateCapacityBar('totalBar', currentPassengers, totalCapacity);

    // Update capacity text
    updateElement('seatingText', `${seatsOccupied} / ${seatingCapacity}`);
    updateElement('standingText', `${standingOccupied} / ${standingCapacity}`);
    updateElement('totalText', `${currentPassengers} / ${totalCapacity}`);

    // Update status badge
    updateStatusBadge(seatsAvailable, standingAvailable);
}

/**
 * Update a capacity bar's width
 * @param {string} barId - ID of the bar element
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 */
function updateCapacityBar(barId, current, max) {
    const bar = document.getElementById(barId);
    if (bar) {
        const percentage = max > 0 ? (current / max) * 100 : 0;
        bar.style.width = `${Math.min(percentage, 100)}%`;

        // Update color based on percentage
        if (percentage < 50) {
            bar.style.backgroundColor = '#10b981'; // Green
        } else if (percentage < 80) {
            bar.style.backgroundColor = '#f59e0b'; // Orange
        } else {
            bar.style.backgroundColor = '#ef4444'; // Red
        }
    }
}

/**
 * Update status badge based on capacity
 * @param {number} seatsAvailable - Available seats
 * @param {number} standingAvailable - Available standing capacity
 */
function updateStatusBadge(seatsAvailable, standingAvailable) {
    const statusBadge = document.getElementById('busStatus');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusTitle = document.getElementById('statusTitle');
    const statusMessage = document.getElementById('statusMessage');

    let statusText = '';
    let statusClass = '';
    let icon = '';
    let message = '';

    if (seatsAvailable > 0) {
        statusText = 'Seats Available';
        statusClass = 'status-seats-available';
        icon = '🟢';
        message = 'Bus has plenty of seating capacity available';
    } else if (standingAvailable > 0) {
        statusText = 'Standing Only';
        statusClass = 'status-standing-only';
        icon = '🟡';
        message = 'All seats occupied, standing room available';
    } else {
        statusText = 'Bus Full';
        statusClass = 'status-bus-full';
        icon = '🔴';
        message = 'Bus has reached maximum capacity';
    }

    if (statusBadge) {
        statusBadge.textContent = statusText;
        statusBadge.className = `status-badge ${statusClass}`;
    }

    if (statusIndicator) {
        const iconElement = statusIndicator.querySelector('.status-icon');
        if (iconElement) iconElement.textContent = icon;
    }

    if (statusTitle) statusTitle.textContent = statusText;
    if (statusMessage) statusMessage.textContent = message;
}

/**
 * Helper function to update element text content
 * @param {string} elementId - ID of the element
 * @param {any} value - Value to set
 */
function updateElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Check if ticket can be issued based on capacity
 * @param {number} passengerCount - Number of passengers
 * @param {number} availableCapacity - Available capacity
 * @returns {boolean} - True if capacity is sufficient
 */
function checkCapacity(passengerCount, availableCapacity) {
    return passengerCount <= availableCapacity;
}

/**
 * Show capacity warning
 * @param {string} message - Warning message
 */
function showCapacityWarning(message) {
    const warningElement = document.getElementById('capacityWarning');
    if (warningElement) {
        warningElement.textContent = message || '⚠️ Warning: Insufficient capacity for this booking!';
        warningElement.style.display = 'block';
    }
}

/**
 * Hide capacity warning
 */
function hideCapacityWarning() {
    const warningElement = document.getElementById('capacityWarning');
    if (warningElement) {
        warningElement.style.display = 'none';
    }
}
