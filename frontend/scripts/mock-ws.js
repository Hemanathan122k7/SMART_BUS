/**
 * mock-ws.js
 * Real-time WebSocket simulation engine
 * Simulates ESP32 IoT device data for Smart Bus Transport System
 * Ready to swap with real WebSocket connection without breaking consumer code
 */

(function(global) {
  'use strict';

  /* ── CONFIG ──────────────────────────────────────────────── */
  const WS_TICK_MS      = 3000;   // base update interval
  const PASSENGER_TICK  = 5000;   // passenger count update
  const LOCATION_TICK   = 4000;   // GPS location update
  const SAFETY_TICK     = 8000;   // door safety check
  const HEALTH_TICK     = 10000;  // system health update

  /* ── MOCK BUS FLEET ──────────────────────────────────────── */
  const MOCK_BUSES = [
    { busId:'BUS001', busNumber:'KA-01-AB-1234', seating:40, standing:20, route:'R001', operator:'Rajesh Kumar',   lat:12.9716, lng:77.5946 },
    { busId:'BUS002', busNumber:'KA-01-CD-5678', seating:40, standing:20, route:'R001', operator:'Priya Sharma',   lat:12.9756, lng:77.6010 },
    { busId:'BUS003', busNumber:'KA-02-EF-9012', seating:36, standing:15, route:'R002', operator:'Mohan Rao',      lat:12.9600, lng:77.5800 },
    { busId:'BUS004', busNumber:'KA-02-GH-3456', seating:36, standing:15, route:'R002', operator:'Sita Devi',      lat:12.9680, lng:77.5900 },
    { busId:'BUS005', busNumber:'KA-03-IJ-7890', seating:44, standing:22, route:'R003', operator:'Anand Patel',    lat:12.9800, lng:77.5700 },
    { busId:'BUS006', busNumber:'KA-03-KL-1234', seating:44, standing:22, route:'R003', operator:'Kavitha Nair',   lat:12.9550, lng:77.6100 },
  ];

  const STOPS = [
    'Central Station','City Mall','University Gate','Hospital Junction',
    'Tech Park','Market Square','Airport Road','Sports Complex',
    'Railway Station','Bus Terminal','Old Town','New Suburb'
  ];

  /* ── LIVE BUS STATE ──────────────────────────────────────── */
  const busState = {};
  MOCK_BUSES.forEach(b => {
    busState[b.busId] = {
      ...b,
      passengers:    Math.floor(Math.random() * b.seating),
      currentStop:   STOPS[Math.floor(Math.random() * STOPS.length)],
      nextStop:      STOPS[Math.floor(Math.random() * STOPS.length)],
      speed:         Math.floor(Math.random() * 40) + 10,
      doorStatus:    'closed',
      doorAlert:     false,
      deviceOnline:  true,
      signalStrength:Math.floor(Math.random() * 4) + 1,
      lastUpdate:    Date.now(),
      eta:           Math.floor(Math.random() * 8) + 1,
      heading:       Math.floor(Math.random() * 360),
    };
  });

  /* ── EVENT BUS ───────────────────────────────────────────── */
  const listeners = {};

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
  }

  function emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(fn => {
      try { fn(data); } catch(e) { console.error('MockWS listener error:', e); }
    });
  }

  /* ── SIMULATION HELPERS ──────────────────────────────────── */
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function jitter(val, maxDelta) {
    return val + (Math.random() - 0.5) * maxDelta;
  }

  function getBusStatus(state) {
    const total = state.seating + state.standing;
    const pct   = state.passengers / total;
    if (pct < 0.5)  return { status:'Seats Available', level:'ok',   pct };
    if (pct < 0.8)  return { status:'Limited Seats',   level:'warn', pct };
    if (pct < 1.0)  return { status:'Standing Only',   level:'warn', pct };
    return               { status:'Bus Full',          level:'danger',pct };
  }

  /* ── TICK: PASSENGER UPDATES ─────────────────────────────── */
  function tickPassengers() {
    MOCK_BUSES.forEach(b => {
      const s    = busState[b.busId];
      const total = s.seating + s.standing;
      const delta = rand(-4, 6);
      s.passengers = clamp(s.passengers + delta, 0, total);
      s.lastUpdate = Date.now();

      const info  = getBusStatus(s);
      const payload = {
        busId:      s.busId,
        busNumber:  s.busNumber,
        passengers: s.passengers,
        seating:    s.seating,
        standing:   s.standing,
        status:     info.status,
        statusLevel:info.level,
        occupancyPct: Math.round(info.pct * 100),
        timestamp:  new Date().toISOString()
      };

      emit('passenger_update', payload);
      emit(`bus_update_${s.busId}`, payload);

      // Trigger bus-full notification
      if (s.passengers >= total && !s._notifiedFull) {
        s._notifiedFull = true;
        emit('alert', {
          type:    'bus_full',
          level:   'danger',
          busId:   s.busId,
          busNumber: s.busNumber,
          message: `Bus ${s.busNumber} is at full capacity!`,
          timestamp: new Date().toISOString()
        });
      } else if (s.passengers < total) {
        s._notifiedFull = false;
      }
    });
    emit('fleet_update', getFleetSnapshot());
  }

  /* ── TICK: GPS LOCATION ──────────────────────────────────── */
  function tickLocation() {
    MOCK_BUSES.forEach(b => {
      const s = busState[b.busId];
      // Simulate movement
      s.lat = jitter(s.lat, 0.003);
      s.lng = jitter(s.lng, 0.003);
      s.speed   = clamp(jitter(s.speed, 10), 0, 60);
      s.heading = (s.heading + rand(-15, 15) + 360) % 360;
      s.eta     = clamp(s.eta + rand(-1, 1), 1, 20);

      emit('location_update', {
        busId:  s.busId,
        busNumber: s.busNumber,
        lat:    s.lat,
        lng:    s.lng,
        speed:  Math.round(s.speed),
        heading:s.heading,
        currentStop: s.currentStop,
        nextStop:    s.nextStop,
        eta:    s.eta,
        timestamp: new Date().toISOString()
      });
    });

    // Occasionally simulate a bus arriving at a stop
    if (Math.random() < 0.3) {
      const b = MOCK_BUSES[rand(0, MOCK_BUSES.length - 1)];
      const s = busState[b.busId];
      const newStop = STOPS[rand(0, STOPS.length - 1)];
      s.currentStop = newStop;
      s.nextStop    = STOPS[rand(0, STOPS.length - 1)];

      emit('alert', {
        type:    'bus_arrival',
        level:   'info',
        busId:   s.busId,
        busNumber: s.busNumber,
        stopName: newStop,
        message: `${s.busNumber} has arrived at ${newStop}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  /* ── TICK: DOOR SAFETY ───────────────────────────────────── */
  function tickSafety() {
    MOCK_BUSES.forEach(b => {
      const s = busState[b.busId];
      const prev = s.doorAlert;

      // 10% chance of door alert
      s.doorAlert  = Math.random() < 0.10;
      s.doorStatus = s.doorAlert ? 'obstruction' : 'closed';

      if (s.doorAlert && !prev) {
        emit('alert', {
          type:    'door_safety',
          level:   'danger',
          busId:   s.busId,
          busNumber: s.busNumber,
          message: `⚠ Door obstruction detected on ${s.busNumber}!`,
          timestamp: new Date().toISOString()
        });
        emit('safety_alert', {
          busId:   s.busId,
          busNumber: s.busNumber,
          doorAlert: true,
          message: 'Person detected near door',
          timestamp: new Date().toISOString()
        });
      }

      if (!s.doorAlert && prev) {
        emit('safety_clear', { busId: s.busId, timestamp: new Date().toISOString() });
      }
    });
  }

  /* ── TICK: SYSTEM HEALTH ─────────────────────────────────── */
  function tickHealth() {
    MOCK_BUSES.forEach(b => {
      const s = busState[b.busId];
      // Signal can fluctuate
      s.signalStrength = clamp(s.signalStrength + rand(-1, 1), 1, 4);
      // Occasionally go offline briefly
      const wasOnline = s.deviceOnline;
      s.deviceOnline  = Math.random() > 0.05;

      emit('health_update', {
        busId:         s.busId,
        busNumber:     s.busNumber,
        deviceOnline:  s.deviceOnline,
        signalStrength:s.signalStrength,
        lastUpdate:    new Date().toISOString()
      });

      if (!s.deviceOnline && wasOnline) {
        emit('alert', {
          type:    'device_offline',
          level:   'warn',
          busId:   s.busId,
          busNumber: s.busNumber,
          message: `ESP32 on ${s.busNumber} went offline`,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Emit overall system health
    const online  = MOCK_BUSES.filter(b => busState[b.busId].deviceOnline).length;
    emit('system_health', {
      totalDevices:   MOCK_BUSES.length,
      onlineDevices:  online,
      offlineDevices: MOCK_BUSES.length - online,
      timestamp: new Date().toISOString()
    });
  }

  /* ── SNAPSHOT HELPERS ────────────────────────────────────── */
  function getFleetSnapshot() {
    return MOCK_BUSES.map(b => {
      const s    = busState[b.busId];
      const info = getBusStatus(s);
      return {
        busId:       s.busId,
        busNumber:   s.busNumber,
        route:       s.route,
        operator:    s.operator,
        passengers:  s.passengers,
        seating:     s.seating,
        standing:    s.standing,
        totalCap:    s.seating + s.standing,
        occupancyPct:Math.round(info.pct * 100),
        status:      info.status,
        statusLevel: info.level,
        currentStop: s.currentStop,
        nextStop:    s.nextStop,
        speed:       Math.round(s.speed),
        eta:         s.eta,
        deviceOnline:s.deviceOnline,
        signalStrength:s.signalStrength,
        doorAlert:   s.doorAlert,
        lat:         s.lat,
        lng:         s.lng,
        heading:     s.heading,
        lastUpdate:  new Date(s.lastUpdate).toLocaleTimeString()
      };
    });
  }

  function getBusSnapshot(busId) {
    const b = busState[busId];
    if (!b) return null;
    const info = getBusStatus(b);
    return {
      ...b,
      status:      info.status,
      statusLevel: info.level,
      occupancyPct: Math.round(info.pct * 100),
      lastUpdate:  new Date(b.lastUpdate).toLocaleTimeString()
    };
  }

  function getAnalyticsData() {
    // Last 12 hours occupancy trend (mock)
    const hours = [];
    const occupancy = [];
    const passengers = [];
    for (let i = 11; i >= 0; i--) {
      const h = new Date();
      h.setHours(h.getHours() - i);
      hours.push(h.getHours() + ':00');
      const isPeakMorning = h.getHours() >= 7 && h.getHours() <= 9;
      const isPeakEvening = h.getHours() >= 17 && h.getHours() <= 19;
      const base = isPeakMorning || isPeakEvening ? 80 : 45;
      occupancy.push(clamp(base + rand(-10, 15), 10, 100));
      passengers.push(clamp((base + rand(-8, 12)) * 3, 30, 300));
    }

    // Route performance
    const routes = [
      { id:'R001', name:'Central ↔ Airport',   avgOcc:72, trips:24, onTime:88 },
      { id:'R002', name:'University ↔ Market', avgOcc:85, trips:18, onTime:79 },
      { id:'R003', name:'Hospital ↔ Tech Park',avgOcc:61, trips:20, onTime:94 },
    ];

    // Heatmap (7 days × 24 hours sample)
    const heatmap = [];
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const peakH = [7,8,9,17,18,19];
    days.forEach(d => {
      Array.from({length:24},(_,h)=>h).forEach(h => {
        const p = peakH.includes(h) ? rand(70,95) : rand(20,55);
        heatmap.push({ day:d, hour:h, value:p });
      });
    });

    return { hours, occupancy, passengers, routes, heatmap };
  }

  /* ── PUBLIC API ──────────────────────────────────────────── */
  const MockWS = {
    on,
    off,
    //--
    getFleetSnapshot,
    getBusSnapshot,
    getAnalyticsData,
    getBuses: () => MOCK_BUSES,
    getStops: () => STOPS,
    //--
    start() {
      if (this._started) return;
      this._started = true;
      // Initial flush
      setTimeout(tickPassengers,  200);
      setTimeout(tickLocation,    400);
      setTimeout(tickHealth,      600);
      // Intervals
      this._t1 = setInterval(tickPassengers, PASSENGER_TICK);
      this._t2 = setInterval(tickLocation,   LOCATION_TICK);
      this._t3 = setInterval(tickSafety,     SAFETY_TICK);
      this._t4 = setInterval(tickHealth,     HEALTH_TICK);
      console.info('[MockWS] Simulation started — fleet:', MOCK_BUSES.length, 'buses');
    },
    stop() {
      [this._t1,this._t2,this._t3,this._t4].forEach(t => clearInterval(t));
      this._started = false;
      console.info('[MockWS] Simulation stopped');
    }
  };

  global.MockWS = MockWS;

})(window);
