/**
 * notifications.js
 * Enterprise Toast & Push Notification System
 * Provides real-time visual alerts for bus events
 */

(function(global) {
  'use strict';

  const DEFAULTS = {
    duration:   5000,   // auto-dismiss ms (0 = sticky)
    position:   'top-right',
    maxToasts:  5,
    audio:      false
  };

  const ICONS = {
    ok:     'fa-circle-check',
    warn:   'fa-triangle-exclamation',
    danger: 'fa-circle-exclamation',
    info:   'fa-circle-info',
    bus_full:      'fa-ban',
    door_safety:   'fa-door-open',
    bus_arrival:   'fa-bus',
    device_offline:'fa-wifi',
  };

  let container = null;
  let toastCount = 0;

  /* ── INIT ──────────────────────────────────────────────── */
  function init() {
    if (container) return;
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  /* ── SHOW TOAST ────────────────────────────────────────── */
  function show(options = {}) {
    if (!container) init();

    const {
      title    = 'Notification',
      message  = '',
      type     = 'info',      // ok | warn | danger | info
      duration = DEFAULTS.duration,
      icon     = null,
    } = options;

    // Limit max toasts
    const existing = container.querySelectorAll('.toast');
    if (existing.length >= DEFAULTS.maxToasts) {
      dismiss(existing[0].dataset.id);
    }

    const id         = 'toast-' + (++toastCount);
    const iconClass  = icon || ICONS[type] || 'fa-bell';
    const timeStr    = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

    const el = document.createElement('div');
    el.className  = `toast ${type}`;
    el.dataset.id = id;
    el.innerHTML  = `
      <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
      <div class="toast-body">
        <div class="toast-title">${sanitize(title)}</div>
        <div class="toast-msg">${sanitize(message)}</div>
        <div class="toast-time">${timeStr}</div>
      </div>
      <button class="toast-close" onclick="Notify._dismiss('${id}')">
        <i class="fas fa-xmark"></i>
      </button>
      <div class="toast-progress"></div>
    `;

    container.insertBefore(el, container.firstChild);

    // Auto-dismiss
    if (duration > 0) {
      // Animate progress bar
      const pb = el.querySelector('.toast-progress');
      if (pb) {
        pb.style.transition  = `width ${duration}ms linear`;
        pb.style.width       = '100%';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            pb.style.width = '0%';
          });
        });
      }

      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }

  /* ── CONVENIENCE METHODS ────────────────────────────────── */
  function success(title, message, duration) { return show({ title, message, type:'ok',     duration }); }
  function warning(title, message, duration) { return show({ title, message, type:'warn',   duration }); }
  function error  (title, message, duration) { return show({ title, message, type:'danger', duration: duration || 8000 }); }
  function info   (title, message, duration) { return show({ title, message, type:'info',   duration }); }

  /* ── DISMISS ──────────────────────────────────────────── */
  function dismiss(id) {
    const el = container ? container.querySelector(`[data-id="${id}"]`) : null;
    if (!el) return;
    el.classList.add('removing');
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
  }

  function dismissAll() {
    if (!container) return;
    container.querySelectorAll('.toast').forEach(el => {
      el.classList.add('removing');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
    });
  }

  /* ── BUS EVENT HELPERS ──────────────────────────────────── */
  function busFull(busNumber) {
    return show({
      type:    'danger',
      icon:    ICONS.bus_full,
      title:   'Bus Full',
      message: `${busNumber} has reached full capacity. No further boarding allowed.`,
      duration:8000
    });
  }

  function doorAlert(busNumber) {
    return show({
      type:    'danger',
      icon:    ICONS.door_safety,
      title:   'Door Safety Alert',
      message: `Obstruction detected at door on ${busNumber}. Check immediately!`,
      duration:10000
    });
  }

  function busArrival(busNumber, stopName) {
    return show({
      type:    'info',
      icon:    ICONS.bus_arrival,
      title:   'Bus Arriving',
      message: `${busNumber} is arriving at ${stopName}`,
      duration:5000
    });
  }

  function deviceOffline(busNumber) {
    return show({
      type:    'warn',
      icon:    ICONS.device_offline,
      title:   'Device Offline',
      message: `ESP32 tracker on ${busNumber} lost connection`,
      duration:7000
    });
  }

  /* ── WIRE TO MockWS ──────────────────────────────────────── */
  function connectToMockWS() {
    if (!global.MockWS) return;

    MockWS.on('alert', function(a) {
      switch(a.type) {
        case 'bus_full':      busFull(a.busNumber); break;
        case 'door_safety':   doorAlert(a.busNumber); break;
        case 'bus_arrival':   busArrival(a.busNumber, a.stopName); break;
        case 'device_offline':deviceOffline(a.busNumber); break;
        default:
          show({ type: a.level || 'info', title: 'System Alert', message: a.message });
      }
    });
  }

  /* ── UTILITY ──────────────────────────────────────────── */
  function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  /* ── PUBLIC API ──────────────────────────────────────────── */
  global.Notify = {
    init,
    show,
    success,
    warning,
    error,
    info,
    dismiss,
    dismissAll,
    busFull,
    doorAlert,
    busArrival,
    deviceOffline,
    connectToMockWS,
    _dismiss: dismiss        // used by inline onclick in toast HTML
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
