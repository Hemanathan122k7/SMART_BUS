/**
 * Bus Card Component
 * Creates and renders bus status cards for bus stop display
 */

/**
 * Create a bus card element
 * @param {Object} bus - Bus data object
 * @returns {HTMLElement} - Bus card element
 */
function createBusCard(bus) {
    const card = document.createElement('div');
    card.className = 'bus-card';
    
    // Determine status class
    let statusClass = 'status-seats-available';
    let statusText = 'Seats Available';
    
    if (bus.seatsAvailable === 0 && bus.standingAvailable > 0) {
        statusClass = 'status-standing-only';
        statusText = 'Standing Only';
    } else if (bus.seatsAvailable === 0 && bus.standingAvailable === 0) {
        statusClass = 'status-bus-full';
        statusText = 'Bus Full';
    }
    
    card.innerHTML = `
        <div class="bus-header">
            <div>
                <div class="bus-id">${bus.busId}</div>
                <div class="bus-route">${bus.route}</div>
            </div>
            <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        
        <div class="capacity-info">
            <div class="capacity-row">
                <span class="capacity-label">Current Passengers:</span>
                <span class="capacity-value">${bus.currentPassengers}</span>
            </div>
            <div class="capacity-row">
                <span class="capacity-label">Seats Available:</span>
                <span class="capacity-value">${bus.seatsAvailable}</span>
            </div>
            <div class="capacity-row">
                <span class="capacity-label">Standing Available:</span>
                <span class="capacity-value">${bus.standingAvailable}</span>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * Render multiple bus cards to a container
 * @param {Array} buses - Array of bus data objects
 * @param {string} containerId - ID of the container element
 */
function renderBusCards(buses, containerId) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error(`Container with ID ${containerId} not found`);
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Check if there are buses
    if (!buses || buses.length === 0) {
        // Show no buses message
        const noBusesMsg = document.getElementById('noBusesMessage');
        if (noBusesMsg) {
            noBusesMsg.style.display = 'block';
        }
        return;
    }
    
    // Hide no buses message
    const noBusesMsg = document.getElementById('noBusesMessage');
    if (noBusesMsg) {
        noBusesMsg.style.display = 'none';
    }
    
    // Create and append bus cards
    buses.forEach(bus => {
        const card = createBusCard(bus);
        container.appendChild(card);
    });
}

/**
 * Update a single bus card
 * @param {string} busId - ID of the bus to update
 * @param {Object} newData - New bus data
 */
function updateBusCard(busId, newData) {
    // Find the card by bus ID and update it
    const cards = document.querySelectorAll('.bus-card');
    cards.forEach(card => {
        const cardBusId = card.querySelector('.bus-id').textContent;
        if (cardBusId === busId) {
            // Replace the entire card
            const newCard = createBusCard(newData);
            card.replaceWith(newCard);
        }
    });
}
