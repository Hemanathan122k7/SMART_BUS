# Smart Bus Monitoring - Simple Full Stack Setup

This setup runs with in-memory storage (no MongoDB required).

## 1. Start backend server

From smartbus-backend folder:

```bash
npm install
npm start
```

Server runs on:

- http://localhost:3000
- http://YOUR_LOCAL_IP:3000

Dashboard:

- http://YOUR_LOCAL_IP:3000/dashboard

Example local IP:

- http://10.103.240.81:3000

## 2. Default operator login

- Operator ID: OP001
- Password: op1234
- Assigned Bus: BUS001

## 3. Required API routes

- POST /updateBus
- GET /getBusData
- POST /issueTicket
- GET /busStopData
- POST /login
- GET /events (server-sent events)

## 4. JSON communication formats

### Bus ESP32 -> updateBus (POST)

```json
{
  "busId": "BUS001",
  "latitude": 12.9731,
  "longitude": 77.6022,
  "doorStatus": "OPEN",
  "safetyStatus": "ALERT",
  "speedKmph": 28
}
```

### Dashboard -> issueTicket (POST)

```json
{
  "busId": "BUS001",
  "source": "Central Station",
  "destination": "Tech Park",
  "passengerCount": 2,
  "operatorId": "OP001"
}
```

### Dashboard/ESP32 <- getBusData (GET)

```json
{
  "success": true,
  "bus": {
    "busId": "BUS001",
    "latitude": 12.9731,
    "longitude": 77.6022,
    "doorStatus": "OPEN",
    "safetyStatus": "ALERT",
    "passengerCount": 12,
    "lastUpdated": "2026-03-29T10:05:30.000Z",
    "route": "R1 City Center - Tech Park",
    "speedKmph": 28
  }
}
```

### Bus stop ESP32 <- busStopData (GET)

```json
{
  "success": true,
  "data": {
    "busId": "BUS001",
    "route": "R1 City Center - Tech Park",
    "currentLocation": {
      "latitude": 12.9731,
      "longitude": 77.6022
    },
    "passengerCount": 12,
    "doorStatus": "OPEN",
    "safetyStatus": "ALERT",
    "etaToNextStopMin": 4,
    "lastUpdated": "2026-03-29T10:05:30.000Z"
  }
}
```

## 5. ESP32 local IP connection rules

- Connect backend PC and ESP32 devices to the same WiFi router.
- Find backend machine IPv4 address.
- Use server base URL in ESP32 code:
  - http://10.103.240.81:3000
- Do not use localhost from ESP32 code.
- Test on browser first:
  - http://10.103.240.81:3000/health

## 6. Realtime behavior

- Dashboard uses:
  - SSE stream from GET /events
  - 5-second polling fallback via GET /getBusData
- Ticket issue updates passenger count immediately.
- Bus stop display reads latest passenger count via GET /busStopData.

## 7. Files added for this setup

- smartbus-backend/server.js
- frontend/pages/live-dashboard.html
- frontend/styles/live-dashboard.css
- frontend/scripts/live-dashboard.js
- iot/esp32-bus/bus_sender_http_example.ino
- iot/esp32-busstop/busstop_display_http_lcd.ino
