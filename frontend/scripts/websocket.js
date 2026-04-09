/**
 * WebSocket Script
 * Handles real-time communication using WebSocket or simulation
 */

// WebSocket connection (would connect to actual server in production)
let ws = null;
let isConnected = false;
let reconnectInterval = null;

// WebSocket server URL (placeholder - would be real server in production)
const WS_URL = 'ws://localhost:3000/ws';

/**
 * Initialize WebSocket connection
 */
function initWebSocket() {
    try {
        // For demo purposes, we'll simulate WebSocket with setInterval
        // In production, this would be: ws = new WebSocket(WS_URL);
        
        console.log('Initializing simulated WebSocket connection...');
        simulateWebSocket();
        
        // Uncomment below for actual WebSocket implementation
        /*
        ws = new WebSocket(WS_URL);
        
        ws.onopen = handleWebSocketOpen;
        ws.onmessage = handleWebSocketMessage;
        ws.onerror = handleWebSocketError;
        ws.onclose = handleWebSocketClose;
        */
        
    } catch (error) {
        console.error('WebSocket initialization error:', error);
        simulateWebSocket();
    }
}

/**
 * Handle WebSocket open event
 */
function handleWebSocketOpen() {
    console.log('WebSocket connected');
    isConnected = true;
    
    // Clear reconnect interval if exists
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
    
    // Send authentication
    const user = getCurrentUser();
    if (user && ws) {
        ws.send(JSON.stringify({
            type: 'auth',
            token: sessionStorage.getItem('authToken'),
            userId: user.id,
            role: user.role
        }));
    }
}

/**
 * Handle incoming WebSocket messages
 * @param {MessageEvent} event - WebSocket message event
 */
function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'capacity_update':
                handleCapacityUpdate(data.payload);
                break;
                
            case 'safety_alert':
                handleSafetyAlert(data.payload);
                break;
                
            case 'bus_location':
                handleBusLocationUpdate(data.payload);
                break;
                
            case 'ticket_issued':
                handleTicketNotification(data.payload);
                break;
                
            case 'passenger_dropoff':
                handlePassengerDropoff(data.payload);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
}

/**
 * Handle WebSocket error
 * @param {Event} error - Error event
 */
function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    isConnected = false;
}

/**
 * Handle WebSocket close event
 */
function handleWebSocketClose() {
    console.log('WebSocket disconnected');
    isConnected = false;
    
    // Attempt to reconnect
    attemptReconnect();
}

/**
 * Attempt to reconnect WebSocket
 */
function attemptReconnect() {
    if (reconnectInterval) return;
    
    console.log('Attempting to reconnect...');
    
    reconnectInterval = setInterval(() => {
        if (!isConnected) {
            initWebSocket();
        } else {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    }, 5000); // Try every 5 seconds
}

/**
 * Send message through WebSocket
 * @param {Object} message - Message object to send
 */
function sendWebSocketMessage(message) {
    if (ws && isConnected) {
        ws.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket not connected, message not sent:', message);
    }
}

/**
 * Handle capacity update
 * @param {Object} data - Capacity update data
 */
function handleCapacityUpdate(data) {
    console.log('Capacity update received:', data);
    
    // Update UI if on operator page
    if (typeof updateCapacityDisplay === 'function') {
        updateCapacityDisplay(data);
    }
    
    // Update bus stop display if applicable
    if (typeof updateBusCard === 'function') {
        updateBusCard(data.busId, data);
    }
}

/**
 * Handle safety alert
 * @param {Object} data - Alert data
 */
function handleSafetyAlert(data) {
    console.log('Safety alert received:', data);
    
    if (typeof showSafetyAlert === 'function') {
        showSafetyAlert(data);
    }
}

/**
 * Handle bus location update
 * @param {Object} data - Location data
 */
function handleBusLocationUpdate(data) {
    console.log('Bus location update:', data);
    
    // Update map or location display if implemented
}

/**
 * Handle ticket notification
 * @param {Object} data - Ticket data
 */
function handleTicketNotification(data) {
    console.log('Ticket issued:', data);
    
    // Could show notification to admin
}

/**
 * Handle passenger dropoff
 * @param {Object} data - Dropoff data
 */
function handlePassengerDropoff(data) {
    console.log('Passenger dropoff:', data);
    
    // Update capacity
    if (typeof handleCapacityUpdate === 'function') {
        handleCapacityUpdate(data);
    }
}

/**
 * Simulate WebSocket for demo purposes
 */
function simulateWebSocket() {
    console.log('Using simulated WebSocket (demo mode)');
    
    // Simulate random updates
    setInterval(() => {
        // Simulate capacity updates
        if (Math.random() > 0.7) {
            const simulatedUpdate = {
                type: 'capacity_update',
                payload: {
                    busId: 'BUS001',
                    currentPassengers: Math.floor(Math.random() * 60),
                    seatsAvailable: Math.floor(Math.random() * 40),
                    standingAvailable: Math.floor(Math.random() * 20),
                    timestamp: new Date().toISOString()
                }
            };
            
            handleWebSocketMessage({ data: JSON.stringify(simulatedUpdate) });
        }
        
        // Simulate safety alerts (rare)
        if (Math.random() > 0.95) {
            const simulatedAlert = {
                type: 'safety_alert',
                payload: {
                    type: 'Door Safety',
                    message: 'Person detected near door area!',
                    severity: 'warning',
                    timestamp: new Date().toISOString()
                }
            };
            
            handleWebSocketMessage({ data: JSON.stringify(simulatedAlert) });
        }
    }, 10000); // Every 10 seconds
}

/**
 * Subscribe to specific events
 * @param {string} eventType - Event type to subscribe to
 * @param {string} busId - Optional bus ID filter
 */
function subscribeToEvents(eventType, busId = null) {
    const subscription = {
        type: 'subscribe',
        eventType: eventType,
        busId: busId
    };
    
    sendWebSocketMessage(subscription);
}

/**
 * Unsubscribe from events
 * @param {string} eventType - Event type to unsubscribe from
 */
function unsubscribeFromEvents(eventType) {
    const unsubscription = {
        type: 'unsubscribe',
        eventType: eventType
    };
    
    sendWebSocketMessage(unsubscription);
}

/**
 * Send bus location update (from bus device)
 * @param {Object} locationData - Location data
 */
function sendLocationUpdate(locationData) {
    const message = {
        type: 'location_update',
        payload: locationData
    };
    
    sendWebSocketMessage(message);
}

/**
 * Send IoT sensor data
 * @param {Object} sensorData - Sensor data
 */
function sendSensorData(sensorData) {
    const message = {
        type: 'sensor_data',
        payload: sensorData
    };
    
    sendWebSocketMessage(message);
}

/**
 * Close WebSocket connection
 */
function closeWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
        isConnected = false;
    }
    
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
}

// Initialize WebSocket on page load (except for public pages)
document.addEventListener('DOMContentLoaded', function() {
    const isPublicPage = window.location.pathname.includes('index.html') || 
                        window.location.pathname.includes('login.html');
    
    if (!isPublicPage && isAuthenticated()) {
        initWebSocket();
        
        // Subscribe to relevant events based on role
        const user = getCurrentUser();
        if (user) {
            if (user.role === 'operator' && user.busId) {
                subscribeToEvents('capacity_update', user.busId);
                subscribeToEvents('safety_alert', user.busId);
            } else if (user.role === 'admin') {
                subscribeToEvents('capacity_update');
                subscribeToEvents('ticket_issued');
            }
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    closeWebSocket();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initWebSocket,
        sendWebSocketMessage,
        subscribeToEvents,
        unsubscribeFromEvents,
        sendLocationUpdate,
        sendSensorData
    };
}
