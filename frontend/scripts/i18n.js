/**
 * i18n.js – Internationalization / Language Module
 * SmartTransit – Multi-language support for designated users
 *
 * Usage:
 *   1. Include this script in every HTML page BEFORE other page scripts.
 *   2. Add data-i18n="key" on any element whose textContent should be translated.
 *   3. Add data-i18n-placeholder="key" on inputs whose placeholder should be translated.
 *   4. Add data-i18n-title="key" on elements whose title attribute needs translation.
 *   5. In JS, call  I18n.t('key')  to get the translated string.
 *   6. Call  I18n.setLanguage('hi')  to switch language dynamically.
 *
 * Supported languages:  en (English), hi (Hindi), kn (Kannada), ta (Tamil), te (Telugu)
 */

(function (global) {
  'use strict';

  /* ═══ CONFIGURATION ═══ */
  const STORAGE_KEY    = 'smartbus_lang';
  const DEFAULT_LANG   = 'en';
  const SUPPORTED      = ['en', 'hi', 'kn', 'ta', 'te'];

  const LANG_LABELS = {
    en: { name: 'English',  flag: '🇬🇧' },
    hi: { name: 'हिन्दी',    flag: '🇮🇳' },
    kn: { name: 'ಕನ್ನಡ',    flag: '🇮🇳' },
    ta: { name: 'தமிழ்',    flag: '🇮🇳' },
    te: { name: 'తెలుగు',   flag: '🇮🇳' }
  };

  /* ═══ STATE ═══ */
  let currentLang   = DEFAULT_LANG;
  let translations  = {};      // { en: {...}, hi: {...}, ... }
  let isReady       = false;
  let readyCallbacks = [];

  /* ═══ EMBEDDED TRANSLATIONS ═══ */
  // All translations are embedded here so no async file loading is needed.
  // This makes it work with file:// protocol and any static hosting.

  translations.en = {
    // ─── Common / Navbar ───
    "nav.brand":              "SmartTransit",
    "nav.logout":             "Logout",
    "nav.system_online":      "System Online",
    "nav.device_online":      "Device Online",
    "nav.all_systems_ok":     "All Systems OK",
    "nav.language":           "Language",

    // ─── Sidebar ───
    "sidebar.navigation":     "Navigation",
    "sidebar.menu":           "Menu",
    "sidebar.last_sync":      "Last sync:",
    "sidebar.updated":        "Updated:",

    // ─── Roles ───
    "role.admin":             "Admin",
    "role.sector":            "Sector",
    "role.operator":          "Operator",

    // ─── Login Page ───
    "login.title":            "Smart Public Transport System",
    "login.subtitle":         "Intelligent monitoring, capacity-aware ticketing, and IoT safety integration for modern public transportation. Select your role to continue.",
    "login.admin_title":      "District Authority",
    "login.admin_desc":       "Full system control, sector creation, bus management, route oversight, and district-wide analytics.",
    "login.admin_btn":        "Login as Admin",
    "login.sector_title":     "Sector Incharge",
    "login.sector_desc":      "Regional oversight, operator management, bus monitoring, route management, and reporting.",
    "login.sector_btn":       "Login as Sector Incharge",
    "login.operator_title":   "Bus Operator",
    "login.operator_desc":    "Daily operations, ticket issuing, capacity status, drop-off tracking, and safety alerts.",
    "login.operator_btn":     "Login as Operator",
    "login.admin_login_h":    "Administrator Login",
    "login.admin_login_sub":  "District Authority — Full system access",
    "login.sector_login_h":   "Sector Incharge Login",
    "login.sector_login_sub": "Regional oversight and management",
    "login.operator_login_h": "Bus Operator Login",
    "login.operator_login_sub":"Daily operations and vehicle management",
    "login.admin_id":         "Admin ID",
    "login.sector_id":        "Sector ID",
    "login.operator_id":      "Operator ID",
    "login.password":         "Password",
    "login.btn_admin":        "Login as Administrator",
    "login.btn_sector":       "Login as Sector Incharge",
    "login.btn_operator":     "Login as Operator",
    "login.back_roles":       "← Back to Role Selection",
    "login.authenticating":   "Authenticating...",
    "login.enter_admin_id":   "Enter admin ID",
    "login.enter_sector_id":  "Enter sector ID",
    "login.enter_operator_id":"Enter operator ID",
    "login.enter_password":   "Enter password",
    "login.back_home":        "← Back to Home",
    "login.busstop_display":  "Bus Stop Display",

    // ─── Admin Dashboard ───
    "admin.live_monitoring":       "Live Monitoring",
    "admin.bus_management":        "Bus Management",
    "admin.sector_management":     "Sector Management",
    "admin.route_management":      "Route Management",
    "admin.live_map":              "Live Map",
    "admin.analytics":             "Analytics",

    "admin.fleet_title":           "Live Fleet Monitoring",
    "admin.fleet_subtitle":        "Real-time status for all buses across the district",
    "admin.refresh":               "Refresh",

    "admin.devices_online":        "Devices Online:",
    "admin.offline":               "Offline:",
    "admin.total_passengers":      "Total Passengers:",
    "admin.avg_occupancy":         "Avg Occupancy:",
    "admin.last_update":           "Last Update:",

    "admin.stat_total_buses":      "Total Buses",
    "admin.stat_active_buses":     "Active Buses",
    "admin.stat_total_pax":        "Total Passengers",
    "admin.stat_avg_occ":          "Avg Occupancy",
    "admin.stat_buses_full":       "Buses Full",
    "admin.stat_door_alerts":      "Door Alerts",

    "admin.live_bus_status":       "Live Bus Status",
    "admin.th_bus_id":             "Bus ID",
    "admin.th_route":              "Route",
    "admin.th_current_stop":       "Current Stop",
    "admin.th_occupancy":          "Occupancy",
    "admin.th_passengers":         "Passengers",
    "admin.th_seats_avail":        "Seats Avail",
    "admin.th_standing_avail":     "Standing Avail",
    "admin.th_status":             "Status",
    "admin.th_device":             "Device",
    "admin.th_last_update":        "Last Update",
    "admin.loading_live":          "Loading live data…",

    "admin.bus_mgmt_title":        "Bus Management",
    "admin.bus_mgmt_subtitle":     "Create and manage bus configurations",
    "admin.add_new_bus":           "Add New Bus",
    "admin.bus_id":                "Bus ID",
    "admin.bus_number":            "Bus Number / Reg.",
    "admin.seating_capacity":      "Seating Capacity",
    "admin.standing_capacity":     "Standing Capacity",
    "admin.total_capacity":        "Total Capacity",
    "admin.btn_add_bus":           "Add Bus",
    "admin.registered_buses":      "Registered Buses",
    "admin.th_seating":            "Seating",
    "admin.th_standing":           "Standing",
    "admin.th_total":              "Total",
    "admin.th_actions":            "Actions",
    "admin.no_buses":              "No buses yet",

    "admin.sector_mgmt_title":     "Sector Management",
    "admin.sector_mgmt_subtitle":  "Manage sector incharges and their zones",
    "admin.add_sector_incharge":   "Add Sector Incharge",
    "admin.sector_id_label":       "Sector ID",
    "admin.incharge_name":         "Incharge Name",
    "admin.phone_number":          "Phone Number",
    "admin.zone_area":             "Zone / Area",
    "admin.set_password":          "Set password",
    "admin.btn_add_sector":        "Add Sector Incharge",
    "admin.registered_sectors":    "Registered Sector Incharges",
    "admin.th_name":               "Name",
    "admin.th_phone":              "Phone",
    "admin.th_zone":               "Zone",
    "admin.no_sectors":            "No sector incharges yet",

    "admin.route_mgmt_title":      "Route Management",
    "admin.route_mgmt_subtitle":   "Define routes with ordered bus stops",
    "admin.create_new_route":      "Create New Route",
    "admin.route_id":              "Route ID",
    "admin.route_name":            "Route Name",
    "admin.bus_stops_label":       "Bus Stops (in order)",
    "admin.assign_buses_label":    "Assign Buses",
    "admin.btn_create_route":      "Create Route",
    "admin.configured_routes":     "Configured Routes",
    "admin.no_routes":             "No routes yet",

    "admin.live_gps_map":          "Live GPS Map",
    "admin.map_subtitle":          "Real-time bus locations across the district",
    "admin.recenter":              "Re-center",
    "admin.legend":                "Legend",
    "admin.legend_available":      "Available",
    "admin.legend_limited":        "Limited",
    "admin.legend_full":           "Full",
    "admin.legend_busstop":        "Bus Stop",

    "admin.analytics_title":       "Analytics",
    "admin.analytics_subtitle":    "Occupancy trends, route performance, peak hours",
    "admin.occ_trend":             "Occupancy Trend (Last 12 hrs)",
    "admin.pax_volume":            "Passenger Volume",
    "admin.route_perf":            "Route Performance",
    "admin.th_route_id":           "Route ID",
    "admin.th_avg_occ":            "Avg Occupancy",
    "admin.th_daily_trips":        "Daily Trips",
    "admin.th_ontime":             "On-Time %",
    "admin.th_trend":              "Trend",
    "admin.peak_heatmap":          "Peak Hour Heatmap",

    // ─── Operator Dashboard ───
    "op.capacity_status":          "Capacity Status",
    "op.issue_ticket":             "Issue Ticket",
    "op.dropoff_tracking":         "Drop-Off Tracking",
    "op.safety_alerts":            "Safety Alerts",

    "op.live_capacity":            "Live Capacity",
    "op.live_cap_subtitle":        "Real-time occupancy for your bus",
    "op.seats_available":          "Seats Available",
    "op.standing_available":       "Standing Available",
    "op.passengers_onboard":       "Passengers Onboard",
    "op.occ_breakdown":            "Occupancy Breakdown",
    "op.seating":                  "Seating",
    "op.standing":                 "Standing",
    "op.total_capacity":           "Total Capacity",
    "op.stat_onboard":             "Onboard",
    "op.stat_seats_left":          "Seats Left",
    "op.stat_standing_left":       "Standing Left",
    "op.stat_tickets_today":       "Tickets Today",

    "op.issue_ticket_title":       "Issue Ticket",
    "op.issue_ticket_subtitle":    "Manage passenger boarding",
    "op.current_bus_status":       "Current Bus Status",
    "op.new_ticket":               "New Ticket",
    "op.boarding_stop":            "Boarding Stop",
    "op.destination_stop":         "Destination Stop",
    "op.passengers_label":         "Passengers",
    "op.ticket_type":              "Ticket Type",
    "op.regular":                  "Regular",
    "op.student":                  "Student (50% off)",
    "op.senior":                   "Senior Citizen (30% off)",
    "op.total_fare":               "Total Fare",
    "op.auto_calc":                "Auto-calculated",
    "op.btn_issue_ticket":         "Issue Ticket",
    "op.recent_tickets":           "Recent Tickets",
    "op.th_ticket_id":             "Ticket ID",
    "op.th_from":                  "From",
    "op.th_to":                    "To",
    "op.th_fare":                  "Fare",
    "op.th_time":                  "Time",
    "op.no_tickets":               "No tickets today",
    "op.select_stop":              "Select current stop",
    "op.select_dest":              "Select destination",

    "op.dropoff_title":            "Drop-Off Tracking",
    "op.dropoff_subtitle":         "Upcoming stops and passenger drop-offs",
    "op.current_route":            "Current Route",
    "op.route_label":              "Route",
    "op.current_stop_label":       "Current Stop",
    "op.next_stop_label":          "Next Stop",
    "op.upcoming_stops":           "Upcoming Stops",
    "op.th_stop":                  "Stop",
    "op.th_dropoffs":              "Drop-Offs",
    "op.th_distance":              "Distance",
    "op.th_eta":                   "ETA",
    "op.mark_arrival":             "Mark Arrival",
    "op.arrived_btn":              "Arrived at Stop – Process Drop-Offs",

    "op.door_safety":              "Door Safety (IoT)",
    "op.safety_subtitle":          "Real-time door sensor alerts from ESP32",
    "op.all_clear":                "All Clear",
    "op.no_safety_alerts":         "No safety alerts detected",
    "op.about_door_safety":        "About Door Safety",
    "op.door_safety_desc":         "Ultrasonic sensors on the bus door detect obstructions during open/close operations, preventing passenger injuries.",
    "op.sensor_note_title":        "Sensor Note",
    "op.sensor_note_msg":          "The door sensor does not count passengers — it only detects proximity to the door mechanism for safety purposes.",
    "op.recent_alerts":            "Recent Alerts",
    "op.th_type":                  "Type",
    "op.th_location":              "Location",
    "op.no_recent_alerts":         "No recent alerts",

    // ─── Sector Dashboard ───
    "sec.dashboard":               "Dashboard",
    "sec.bus_monitoring":          "Bus Monitoring",
    "sec.operators":               "Operators",
    "sec.routes":                  "Routes",
    "sec.reports":                 "Reports",

    "sec.overview_title":          "Sector Overview",
    "sec.overview_subtitle":       "Zone-level statistics and fleet status",
    "sec.fleet_label":             "Fleet:",
    "sec.alerts_label":            "Alerts:",
    "sec.network_label":           "Network:",
    "sec.network_strong":          "Strong",

    "sec.stat_total_buses":        "Total Buses",
    "sec.stat_active_buses":       "Active Buses",
    "sec.stat_total_pax":          "Total Passengers",
    "sec.stat_operators":          "Operators",
    "sec.stat_active_alerts":      "Active Alerts",
    "sec.stat_routes":             "Routes",
    "sec.fleet_quick_view":        "Fleet Quick View",

    "sec.rt_monitoring_title":     "Real-Time Bus Monitoring",
    "sec.rt_monitoring_subtitle":  "Live status of all buses in your zone",
    "sec.live_feed":               "Live Feed",
    "sec.th_plate":                "Plate",
    "sec.loading_buses":           "Loading buses…",

    "sec.operator_mgmt_title":     "Operator Management",
    "sec.operator_mgmt_subtitle":  "Create operators and assign them to buses",
    "sec.add_operator":            "Add New Operator",
    "sec.operator_id":             "Operator ID",
    "sec.full_name":               "Full Name",
    "sec.assign_bus":              "Assign to Bus",
    "sec.btn_add_operator":        "Add Operator",
    "sec.registered_operators":    "Registered Operators",
    "sec.th_id":                   "ID",
    "sec.th_assigned_bus":         "Assigned Bus",
    "sec.no_operators":            "No operators registered",

    "sec.routes_overview":         "Routes Overview",
    "sec.routes_subtitle":         "All routes in your zone",

    "sec.reports_title":           "Reports",
    "sec.reports_subtitle":        "Sector performance analytics",
    "sec.report_generator":        "Report Generator",
    "sec.report_type":             "Report Type",
    "sec.daily_summary":           "Daily Summary",
    "sec.weekly_summary":          "Weekly Summary",
    "sec.operator_performance":    "Operator Performance",
    "sec.route_performance":       "Route Performance",
    "sec.date":                    "Date",
    "sec.btn_generate":            "Generate Report",

    // ─── Bus Stop Display ───
    "busstop.title":               "Smart Bus Stop Display",
    "busstop.buses_entering":      "Buses Entering",
    "busstop.buses_at_stop":       "Buses at Stop",
    "busstop.buses_leaving":       "Buses Leaving",
    "busstop.no_buses_h":          "No buses currently at this stop",
    "busstop.no_buses_p":          "Please wait for the next arrival",

    // ─── Landing Page ───
    "landing.title":               "Smart Bus Transport System",
    "landing.subtitle":            "Intelligent Monitoring & Capacity-Aware Ticketing",
    "landing.enter":               "Enter System",

    // ─── Status Labels ───
    "status.live":                 "Live",
    "status.online":               "Online",
    "status.offline":              "Offline",
    "status.active":               "Active",
    "status.inactive":             "Inactive",
    "status.seats_available":      "Seats Available",
    "status.standing_only":        "Standing Only",
    "status.bus_full":             "Bus Full",
    "status.near_full":            "Nearly Full",
    "status.ok":                   "OK",

    // ─── Features ───
    "feature.dark_mode":           "Dark Mode",
    "feature.fullscreen":          "Fullscreen",
    "feature.export_csv":          "Export CSV",
    "feature.settings":            "Settings"
  };

  translations.hi = {
    // ─── Common / Navbar ───
    "nav.brand":              "स्मार्ट ट्रांजिट",
    "nav.logout":             "लॉग आउट",
    "nav.system_online":      "सिस्टम ऑनलाइन",
    "nav.device_online":      "डिवाइस ऑनलाइन",
    "nav.all_systems_ok":     "सभी सिस्टम ठीक",
    "nav.language":           "भाषा",

    // ─── Sidebar ───
    "sidebar.navigation":     "संचालन",
    "sidebar.menu":           "मेनू",
    "sidebar.last_sync":      "अंतिम सिंक:",
    "sidebar.updated":        "अपडेट:",

    // ─── Roles ───
    "role.admin":             "व्यवस्थापक",
    "role.sector":            "क्षेत्र",
    "role.operator":          "ऑपरेटर",

    // ─── Login Page ───
    "login.title":            "स्मार्ट सार्वजनिक परिवहन प्रणाली",
    "login.subtitle":         "आधुनिक सार्वजनिक परिवहन के लिए बुद्धिमान निगरानी, क्षमता-जागरूक टिकटिंग, और IoT सुरक्षा एकीकरण। जारी रखने के लिए अपनी भूमिका चुनें।",
    "login.admin_title":      "जिला प्राधिकरण",
    "login.admin_desc":       "पूर्ण सिस्टम नियंत्रण, क्षेत्र निर्माण, बस प्रबंधन, मार्ग निरीक्षण, और जिला-व्यापी विश्लेषण।",
    "login.admin_btn":        "व्यवस्थापक के रूप में लॉगिन",
    "login.sector_title":     "क्षेत्र प्रभारी",
    "login.sector_desc":      "क्षेत्रीय निरीक्षण, ऑपरेटर प्रबंधन, बस निगरानी, मार्ग प्रबंधन, और रिपोर्टिंग।",
    "login.sector_btn":       "क्षेत्र प्रभारी के रूप में लॉगिन",
    "login.operator_title":   "बस ऑपरेटर",
    "login.operator_desc":    "दैनिक संचालन, टिकट जारी करना, क्षमता स्थिति, ड्रॉप-ऑफ ट्रैकिंग, और सुरक्षा अलर्ट।",
    "login.operator_btn":     "ऑपरेटर के रूप में लॉगिन",
    "login.admin_login_h":    "व्यवस्थापक लॉगिन",
    "login.admin_login_sub":  "जिला प्राधिकरण — पूर्ण सिस्टम एक्सेस",
    "login.sector_login_h":   "क्षेत्र प्रभारी लॉगिन",
    "login.sector_login_sub": "क्षेत्रीय निरीक्षण और प्रबंधन",
    "login.operator_login_h": "बस ऑपरेटर लॉगिन",
    "login.operator_login_sub":"दैनिक संचालन और वाहन प्रबंधन",
    "login.admin_id":         "व्यवस्थापक आईडी",
    "login.sector_id":        "क्षेत्र आईडी",
    "login.operator_id":      "ऑपरेटर आईडी",
    "login.password":         "पासवर्ड",
    "login.btn_admin":        "व्यवस्थापक के रूप में लॉगिन करें",
    "login.btn_sector":       "क्षेत्र प्रभारी के रूप में लॉगिन करें",
    "login.btn_operator":     "ऑपरेटर के रूप में लॉगिन करें",
    "login.back_roles":       "← भूमिका चयन पर वापस",
    "login.authenticating":   "प्रमाणित हो रहा है...",
    "login.enter_admin_id":   "व्यवस्थापक आईडी दर्ज करें",
    "login.enter_sector_id":  "क्षेत्र आईडी दर्ज करें",
    "login.enter_operator_id":"ऑपरेटर आईडी दर्ज करें",
    "login.enter_password":   "पासवर्ड दर्ज करें",
    "login.back_home":        "← होम पर वापस",
    "login.busstop_display":  "बस स्टॉप प्रदर्शन",

    // ─── Admin Dashboard ───
    "admin.live_monitoring":       "लाइव निगरानी",
    "admin.bus_management":        "बस प्रबंधन",
    "admin.sector_management":     "क्षेत्र प्रबंधन",
    "admin.route_management":      "मार्ग प्रबंधन",
    "admin.live_map":              "लाइव मैप",
    "admin.analytics":             "विश्लेषण",

    "admin.fleet_title":           "लाइव बेड़ा निगरानी",
    "admin.fleet_subtitle":        "जिले भर में सभी बसों की वास्तविक समय स्थिति",
    "admin.refresh":               "रिफ्रेश",

    "admin.devices_online":        "ऑनलाइन उपकरण:",
    "admin.offline":               "ऑफलाइन:",
    "admin.total_passengers":      "कुल यात्री:",
    "admin.avg_occupancy":         "औसत अधिभोग:",
    "admin.last_update":           "अंतिम अपडेट:",

    "admin.stat_total_buses":      "कुल बसें",
    "admin.stat_active_buses":     "सक्रिय बसें",
    "admin.stat_total_pax":        "कुल यात्री",
    "admin.stat_avg_occ":          "औसत अधिभोग",
    "admin.stat_buses_full":       "बसें भरी हुई",
    "admin.stat_door_alerts":      "दरवाज़ा अलर्ट",

    "admin.live_bus_status":       "लाइव बस स्थिति",
    "admin.th_bus_id":             "बस आईडी",
    "admin.th_route":              "मार्ग",
    "admin.th_current_stop":       "वर्तमान स्टॉप",
    "admin.th_occupancy":          "अधिभोग",
    "admin.th_passengers":         "यात्री",
    "admin.th_seats_avail":        "सीटें उपलब्ध",
    "admin.th_standing_avail":     "खड़े रहने की जगह",
    "admin.th_status":             "स्थिति",
    "admin.th_device":             "डिवाइस",
    "admin.th_last_update":        "अंतिम अपडेट",
    "admin.loading_live":          "लाइव डेटा लोड हो रहा है…",

    "admin.bus_mgmt_title":        "बस प्रबंधन",
    "admin.bus_mgmt_subtitle":     "बस कॉन्फ़िगरेशन बनाएं और प्रबंधित करें",
    "admin.add_new_bus":           "नई बस जोड़ें",
    "admin.bus_id":                "बस आईडी",
    "admin.bus_number":            "बस नंबर / रजि.",
    "admin.seating_capacity":      "बैठने की क्षमता",
    "admin.standing_capacity":     "खड़े रहने की क्षमता",
    "admin.total_capacity":        "कुल क्षमता",
    "admin.btn_add_bus":           "बस जोड़ें",
    "admin.registered_buses":      "पंजीकृत बसें",
    "admin.th_seating":            "बैठने की",
    "admin.th_standing":           "खड़े रहने की",
    "admin.th_total":              "कुल",
    "admin.th_actions":            "कार्यवाही",
    "admin.no_buses":              "अभी कोई बस नहीं",

    "admin.sector_mgmt_title":     "क्षेत्र प्रबंधन",
    "admin.sector_mgmt_subtitle":  "क्षेत्र प्रभारियों और उनके क्षेत्रों का प्रबंधन",
    "admin.add_sector_incharge":   "क्षेत्र प्रभारी जोड़ें",
    "admin.sector_id_label":       "क्षेत्र आईडी",
    "admin.incharge_name":         "प्रभारी का नाम",
    "admin.phone_number":          "फ़ोन नंबर",
    "admin.zone_area":             "ज़ोन / क्षेत्र",
    "admin.set_password":          "पासवर्ड सेट करें",
    "admin.btn_add_sector":        "क्षेत्र प्रभारी जोड़ें",
    "admin.registered_sectors":    "पंजीकृत क्षेत्र प्रभारी",
    "admin.th_name":               "नाम",
    "admin.th_phone":              "फ़ोन",
    "admin.th_zone":               "ज़ोन",
    "admin.no_sectors":            "अभी कोई क्षेत्र प्रभारी नहीं",

    "admin.route_mgmt_title":      "मार्ग प्रबंधन",
    "admin.route_mgmt_subtitle":   "क्रमबद्ध बस स्टॉप के साथ मार्ग परिभाषित करें",
    "admin.create_new_route":      "नया मार्ग बनाएं",
    "admin.route_id":              "मार्ग आईडी",
    "admin.route_name":            "मार्ग का नाम",
    "admin.bus_stops_label":       "बस स्टॉप (क्रम में)",
    "admin.assign_buses_label":    "बसें सौंपें",
    "admin.btn_create_route":      "मार्ग बनाएं",
    "admin.configured_routes":     "कॉन्फ़िगर किए गए मार्ग",
    "admin.no_routes":             "अभी कोई मार्ग नहीं",

    "admin.live_gps_map":          "लाइव GPS मैप",
    "admin.map_subtitle":          "जिले भर में वास्तविक समय बस स्थान",
    "admin.recenter":              "पुनः केंद्रित करें",
    "admin.legend":                "चिह्न-सूची",
    "admin.legend_available":      "उपलब्ध",
    "admin.legend_limited":        "सीमित",
    "admin.legend_full":           "भरा हुआ",
    "admin.legend_busstop":        "बस स्टॉप",

    "admin.analytics_title":       "विश्लेषण",
    "admin.analytics_subtitle":    "अधिभोग प्रवृत्तियाँ, मार्ग प्रदर्शन, पीक घंटे",
    "admin.occ_trend":             "अधिभोग प्रवृत्ति (अंतिम 12 घंटे)",
    "admin.pax_volume":            "यात्री मात्रा",
    "admin.route_perf":            "मार्ग प्रदर्शन",
    "admin.th_route_id":           "मार्ग आईडी",
    "admin.th_avg_occ":            "औसत अधिभोग",
    "admin.th_daily_trips":        "दैनिक यात्राएं",
    "admin.th_ontime":             "समय पर %",
    "admin.th_trend":              "प्रवृत्ति",
    "admin.peak_heatmap":          "पीक आवर हीटमैप",

    // ─── Operator Dashboard ───
    "op.capacity_status":          "क्षमता स्थिति",
    "op.issue_ticket":             "टिकट जारी करें",
    "op.dropoff_tracking":         "ड्रॉप-ऑफ ट्रैकिंग",
    "op.safety_alerts":            "सुरक्षा अलर्ट",

    "op.live_capacity":            "लाइव क्षमता",
    "op.live_cap_subtitle":        "आपकी बस के लिए वास्तविक समय अधिभोग",
    "op.seats_available":          "सीटें उपलब्ध",
    "op.standing_available":       "खड़े रहने की जगह",
    "op.passengers_onboard":       "बोर्ड पर यात्री",
    "op.occ_breakdown":            "अधिभोग विवरण",
    "op.seating":                  "बैठने की",
    "op.standing":                 "खड़े रहने की",
    "op.total_capacity":           "कुल क्षमता",
    "op.stat_onboard":             "बोर्ड पर",
    "op.stat_seats_left":          "सीटें शेष",
    "op.stat_standing_left":       "खड़े शेष",
    "op.stat_tickets_today":       "आज के टिकट",

    "op.issue_ticket_title":       "टिकट जारी करें",
    "op.issue_ticket_subtitle":    "यात्री बोर्डिंग प्रबंधित करें",
    "op.current_bus_status":       "वर्तमान बस स्थिति",
    "op.new_ticket":               "नया टिकट",
    "op.boarding_stop":            "बोर्डिंग स्टॉप",
    "op.destination_stop":         "गंतव्य स्टॉप",
    "op.passengers_label":         "यात्री",
    "op.ticket_type":              "टिकट प्रकार",
    "op.regular":                  "सामान्य",
    "op.student":                  "छात्र (50% छूट)",
    "op.senior":                   "वरिष्ठ नागरिक (30% छूट)",
    "op.total_fare":               "कुल किराया",
    "op.auto_calc":                "स्वचालित गणना",
    "op.btn_issue_ticket":         "टिकट जारी करें",
    "op.recent_tickets":           "हाल के टिकट",
    "op.th_ticket_id":             "टिकट आईडी",
    "op.th_from":                  "से",
    "op.th_to":                    "तक",
    "op.th_fare":                  "किराया",
    "op.th_time":                  "समय",
    "op.no_tickets":               "आज कोई टिकट नहीं",
    "op.select_stop":              "वर्तमान स्टॉप चुनें",
    "op.select_dest":              "गंतव्य चुनें",

    "op.dropoff_title":            "ड्रॉप-ऑफ ट्रैकिंग",
    "op.dropoff_subtitle":         "आगामी स्टॉप और यात्री ड्रॉप-ऑफ",
    "op.current_route":            "वर्तमान मार्ग",
    "op.route_label":              "मार्ग",
    "op.current_stop_label":       "वर्तमान स्टॉप",
    "op.next_stop_label":          "अगला स्टॉप",
    "op.upcoming_stops":           "आगामी स्टॉप",
    "op.th_stop":                  "स्टॉप",
    "op.th_dropoffs":              "ड्रॉप-ऑफ",
    "op.th_distance":              "दूरी",
    "op.th_eta":                   "ईटीए",
    "op.mark_arrival":             "आगमन चिह्नित करें",
    "op.arrived_btn":              "स्टॉप पर पहुंचे – ड्रॉप-ऑफ प्रक्रिया करें",

    "op.door_safety":              "दरवाज़ा सुरक्षा (IoT)",
    "op.safety_subtitle":          "ESP32 से रियल-टाइम दरवाज़ा सेंसर अलर्ट",
    "op.all_clear":                "सब ठीक है",
    "op.no_safety_alerts":         "कोई सुरक्षा अलर्ट नहीं",
    "op.about_door_safety":        "दरवाज़ा सुरक्षा के बारे में",
    "op.door_safety_desc":         "बस के दरवाज़े पर अल्ट्रासोनिक सेंसर खुले/बंद संचालन के दौरान बाधाओं का पता लगाते हैं, यात्रियों की चोटों को रोकते हैं।",
    "op.sensor_note_title":        "सेंसर नोट",
    "op.sensor_note_msg":          "दरवाज़ा सेंसर यात्रियों की गिनती नहीं करता — यह केवल सुरक्षा उद्देश्यों के लिए दरवाज़ा तंत्र के निकटता का पता लगाता है।",
    "op.recent_alerts":            "हाल के अलर्ट",
    "op.th_type":                  "प्रकार",
    "op.th_location":              "स्थान",
    "op.no_recent_alerts":         "कोई हाल का अलर्ट नहीं",

    // ─── Sector Dashboard ───
    "sec.dashboard":               "डैशबोर्ड",
    "sec.bus_monitoring":          "बस निगरानी",
    "sec.operators":               "ऑपरेटर",
    "sec.routes":                  "मार्ग",
    "sec.reports":                 "रिपोर्ट",

    "sec.overview_title":          "क्षेत्र अवलोकन",
    "sec.overview_subtitle":       "ज़ोन-स्तरीय सांख्यिकी और बेड़ा स्थिति",
    "sec.fleet_label":             "बेड़ा:",
    "sec.alerts_label":            "अलर्ट:",
    "sec.network_label":           "नेटवर्क:",
    "sec.network_strong":          "मज़बूत",

    "sec.stat_total_buses":        "कुल बसें",
    "sec.stat_active_buses":       "सक्रिय बसें",
    "sec.stat_total_pax":          "कुल यात्री",
    "sec.stat_operators":          "ऑपरेटर",
    "sec.stat_active_alerts":      "सक्रिय अलर्ट",
    "sec.stat_routes":             "मार्ग",
    "sec.fleet_quick_view":        "बेड़ा त्वरित दृश्य",

    "sec.rt_monitoring_title":     "रियल-टाइम बस निगरानी",
    "sec.rt_monitoring_subtitle":  "आपके ज़ोन में सभी बसों की लाइव स्थिति",
    "sec.live_feed":               "लाइव फ़ीड",
    "sec.th_plate":                "प्लेट",
    "sec.loading_buses":           "बसें लोड हो रही हैं…",

    "sec.operator_mgmt_title":     "ऑपरेटर प्रबंधन",
    "sec.operator_mgmt_subtitle":  "ऑपरेटर बनाएं और बसों में सौंपें",
    "sec.add_operator":            "नया ऑपरेटर जोड़ें",
    "sec.operator_id":             "ऑपरेटर आईडी",
    "sec.full_name":               "पूरा नाम",
    "sec.assign_bus":              "बस को सौंपें",
    "sec.btn_add_operator":        "ऑपरेटर जोड़ें",
    "sec.registered_operators":    "पंजीकृत ऑपरेटर",
    "sec.th_id":                   "आईडी",
    "sec.th_assigned_bus":         "सौंपी गई बस",
    "sec.no_operators":            "कोई ऑपरेटर पंजीकृत नहीं",

    "sec.routes_overview":         "मार्ग अवलोकन",
    "sec.routes_subtitle":         "आपके ज़ोन के सभी मार्ग",

    "sec.reports_title":           "रिपोर्ट",
    "sec.reports_subtitle":        "क्षेत्र प्रदर्शन विश्लेषण",
    "sec.report_generator":        "रिपोर्ट जनरेटर",
    "sec.report_type":             "रिपोर्ट प्रकार",
    "sec.daily_summary":           "दैनिक सारांश",
    "sec.weekly_summary":          "साप्ताहिक सारांश",
    "sec.operator_performance":    "ऑपरेटर प्रदर्शन",
    "sec.route_performance":       "मार्ग प्रदर्शन",
    "sec.date":                    "तारीख",
    "sec.btn_generate":            "रिपोर्ट तैयार करें",

    // ─── Bus Stop Display ───
    "busstop.title":               "स्मार्ट बस स्टॉप प्रदर्शन",
    "busstop.buses_entering":      "आने वाली बसें",
    "busstop.buses_at_stop":       "स्टॉप पर बसें",
    "busstop.buses_leaving":       "जाने वाली बसें",
    "busstop.no_buses_h":          "इस स्टॉप पर अभी कोई बस नहीं",
    "busstop.no_buses_p":          "कृपया अगले आगमन की प्रतीक्षा करें",

    // ─── Landing Page ───
    "landing.title":               "स्मार्ट बस परिवहन प्रणाली",
    "landing.subtitle":            "बुद्धिमान निगरानी और क्षमता-जागरूक टिकटिंग",
    "landing.enter":               "सिस्टम में प्रवेश करें",

    // ─── Status Labels ───
    "status.live":                 "लाइव",
    "status.online":               "ऑनलाइन",
    "status.offline":              "ऑफलाइन",
    "status.active":               "सक्रिय",
    "status.inactive":             "निष्क्रिय",
    "status.seats_available":      "सीटें उपलब्ध",
    "status.standing_only":        "केवल खड़े",
    "status.bus_full":             "बस भरी हुई",
    "status.near_full":            "लगभग भरी हुई",
    "status.ok":                   "ठीक",

    // ─── Features ───
    "feature.dark_mode":           "डार्क मोड",
    "feature.fullscreen":          "फ़ुलस्क्रीन",
    "feature.export_csv":          "CSV निर्यात",
    "feature.settings":            "सेटिंग्स"
  };

  translations.kn = {
    // ─── Common / Navbar ───
    "nav.brand":              "ಸ್ಮಾರ್ಟ್ ಟ್ರಾನ್ಸಿಟ್",
    "nav.logout":             "ಲಾಗ್ ಔಟ್",
    "nav.system_online":      "ಸಿಸ್ಟಮ್ ಆನ್‌ಲೈನ್",
    "nav.device_online":      "ಸಾಧನ ಆನ್‌ಲೈನ್",
    "nav.all_systems_ok":     "ಎಲ್ಲಾ ಸಿಸ್ಟಮ್‌ಗಳು ಸರಿ",
    "nav.language":           "ಭಾಷೆ",

    "sidebar.navigation":     "ನ್ಯಾವಿಗೇಶನ್",
    "sidebar.menu":           "ಮೆನು",
    "sidebar.last_sync":      "ಕೊನೆಯ ಸಿಂಕ್:",
    "sidebar.updated":        "ನವೀಕರಿಸಲಾಗಿದೆ:",

    "role.admin":             "ನಿರ್ವಾಹಕ",
    "role.sector":            "ವಲಯ",
    "role.operator":          "ಆಪರೇಟರ್",

    "login.title":            "ಸ್ಮಾರ್ಟ್ ಸಾರ್ವಜನಿಕ ಸಾರಿಗೆ ವ್ಯವಸ್ಥೆ",
    "login.subtitle":         "ಆಧುನಿಕ ಸಾರ್ವಜನಿಕ ಸಾರಿಗೆಗಾಗಿ ಬುದ್ಧಿವಂತ ಮೇಲ್ವಿಚಾರಣೆ, ಸಾಮರ್ಥ್ಯ-ಅರಿವು ಟಿಕೆಟಿಂಗ್ ಮತ್ತು IoT ಸುರಕ್ಷತಾ ಏಕೀಕರಣ.",
    "login.admin_title":      "ಜಿಲ್ಲಾ ಪ್ರಾಧಿಕಾರ",
    "login.admin_desc":       "ಸಂಪೂರ್ಣ ಸಿಸ್ಟಮ್ ನಿಯಂತ್ರಣ, ವಲಯ ನಿರ್ಮಾಣ, ಬಸ್ ನಿರ್ವಹಣೆ, ಮಾರ್ಗ ಮೇಲ್ವಿಚಾರಣೆ ಮತ್ತು ಜಿಲ್ಲಾ-ವ್ಯಾಪಿ ವಿಶ್ಲೇಷಣೆ.",
    "login.admin_btn":        "ನಿರ್ವಾಹಕರಾಗಿ ಲಾಗಿನ್",
    "login.sector_title":     "ವಲಯ ಉಸ್ತುವಾರಿ",
    "login.sector_desc":      "ಪ್ರಾದೇಶಿಕ ಮೇಲ್ವಿಚಾರಣೆ, ಆಪರೇಟರ್ ನಿರ್ವಹಣೆ, ಬಸ್ ಮೇಲ್ವಿಚಾರಣೆ, ಮಾರ್ಗ ನಿರ್ವಹಣೆ ಮತ್ತು ವರದಿ.",
    "login.sector_btn":       "ವಲಯ ಉಸ್ತುವಾರಿಯಾಗಿ ಲಾಗಿನ್",
    "login.operator_title":   "ಬಸ್ ಆಪರೇಟರ್",
    "login.operator_desc":    "ದೈನಂದಿನ ಕಾರ್ಯಾಚರಣೆ, ಟಿಕೆಟ್ ನೀಡುವಿಕೆ, ಸಾಮರ್ಥ್ಯ ಸ್ಥಿತಿ, ಡ್ರಾಪ್-ಆಫ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಮತ್ತು ಸುರಕ್ಷತಾ ಎಚ್ಚರಿಕೆಗಳು.",
    "login.operator_btn":     "ಆಪರೇಟರ್ ಆಗಿ ಲಾಗಿನ್",
    "login.admin_login_h":    "ನಿರ್ವಾಹಕ ಲಾಗಿನ್",
    "login.admin_login_sub":  "ಜಿಲ್ಲಾ ಪ್ರಾಧಿಕಾರ — ಸಂಪೂರ್ಣ ಸಿಸ್ಟಮ್ ಪ್ರವೇಶ",
    "login.sector_login_h":   "ವಲಯ ಉಸ್ತುವಾರಿ ಲಾಗಿನ್",
    "login.sector_login_sub": "ಪ್ರಾದೇಶಿಕ ಮೇಲ್ವಿಚಾರಣೆ ಮತ್ತು ನಿರ್ವಹಣೆ",
    "login.operator_login_h": "ಬಸ್ ಆಪರೇಟರ್ ಲಾಗಿನ್",
    "login.operator_login_sub":"ದೈನಂದಿನ ಕಾರ್ಯಾಚರಣೆ ಮತ್ತು ವಾಹನ ನಿರ್ವಹಣೆ",
    "login.admin_id":         "ನಿರ್ವಾಹಕ ಐಡಿ",
    "login.sector_id":        "ವಲಯ ಐಡಿ",
    "login.operator_id":      "ಆಪರೇಟರ್ ಐಡಿ",
    "login.password":         "ಗುಪ್ತಪದ",
    "login.btn_admin":        "ನಿರ್ವಾಹಕರಾಗಿ ಲಾಗಿನ್ ಮಾಡಿ",
    "login.btn_sector":       "ವಲಯ ಉಸ್ತುವಾರಿಯಾಗಿ ಲಾಗಿನ್ ಮಾಡಿ",
    "login.btn_operator":     "ಆಪರೇಟರ್ ಆಗಿ ಲಾಗಿನ್ ಮಾಡಿ",
    "login.back_roles":       "← ಪಾತ್ರ ಆಯ್ಕೆಗೆ ಹಿಂತಿರುಗಿ",
    "login.authenticating":   "ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ...",
    "login.enter_admin_id":   "ನಿರ್ವಾಹಕ ಐಡಿ ನಮೂದಿಸಿ",
    "login.enter_sector_id":  "ವಲಯ ಐಡಿ ನಮೂದಿಸಿ",
    "login.enter_operator_id":"ಆಪರೇಟರ್ ಐಡಿ ನಮೂದಿಸಿ",
    "login.enter_password":   "ಗುಪ್ತಪದ ನಮೂದಿಸಿ",
    "login.back_home":        "← ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ",
    "login.busstop_display":  "ಬಸ್ ನಿಲ್ದಾಣ ಪ್ರದರ್ಶನ",

    "admin.live_monitoring":       "ಲೈವ್ ಮೇಲ್ವಿಚಾರಣೆ",
    "admin.bus_management":        "ಬಸ್ ನಿರ್ವಹಣೆ",
    "admin.sector_management":     "ವಲಯ ನಿರ್ವಹಣೆ",
    "admin.route_management":      "ಮಾರ್ಗ ನಿರ್ವಹಣೆ",
    "admin.live_map":              "ಲೈವ್ ಮ್ಯಾಪ್",
    "admin.analytics":             "ವಿಶ್ಲೇಷಣೆ",
    "admin.fleet_title":           "ಲೈವ್ ಬೆಡ ಮೇಲ್ವಿಚಾರಣೆ",
    "admin.fleet_subtitle":        "ಜಿಲ್ಲೆಯಾದ್ಯಂತ ಎಲ್ಲ ಬಸ್‌ಗಳ ನೈಜ-ಸಮಯ ಸ್ಥಿತಿ",
    "admin.refresh":               "ರಿಫ್ರೆಶ್",
    "admin.stat_total_buses":      "ಒಟ್ಟು ಬಸ್‌ಗಳು",
    "admin.stat_active_buses":     "ಸಕ್ರಿಯ ಬಸ್‌ಗಳು",
    "admin.stat_total_pax":        "ಒಟ್ಟು ಪ್ರಯಾಣಿಕರು",
    "admin.stat_avg_occ":          "ಸರಾಸರಿ ಅಧಿಗ್ರಹಣ",
    "admin.stat_buses_full":       "ಭರ್ತಿ ಬಸ್‌ಗಳು",
    "admin.stat_door_alerts":      "ಬಾಗಿಲು ಎಚ್ಚರಿಕೆ",
    "admin.loading_live":          "ಲೈವ್ ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
    "admin.btn_add_bus":           "ಬಸ್ ಸೇರಿಸಿ",
    "admin.no_buses":              "ಇನ್ನೂ ಯಾವ ಬಸ್‌ಗಳೂ ಇಲ್ಲ",
    "admin.btn_add_sector":        "ವಲಯ ಉಸ್ತುವಾರಿ ಸೇರಿಸಿ",
    "admin.no_sectors":            "ಇನ್ನೂ ಯಾವ ವಲಯ ಉಸ್ತುವಾರಿಯೂ ಇಲ್ಲ",
    "admin.btn_create_route":      "ಮಾರ್ಗ ರಚಿಸಿ",
    "admin.no_routes":             "ಇನ್ನೂ ಯಾವ ಮಾರ್ಗವೂ ಇಲ್ಲ",

    "op.capacity_status":          "ಸಾಮರ್ಥ್ಯ ಸ್ಥಿತಿ",
    "op.issue_ticket":             "ಟಿಕೆಟ್ ನೀಡಿ",
    "op.dropoff_tracking":         "ಡ್ರಾಪ್-ಆಫ್ ಟ್ರ್ಯಾಕಿಂಗ್",
    "op.safety_alerts":            "ಸುರಕ್ಷತಾ ಎಚ್ಚರಿಕೆ",
    "op.live_capacity":            "ಲೈವ್ ಸಾಮರ್ಥ್ಯ",
    "op.seats_available":          "ಲಭ್ಯವಿರುವ ಸೀಟುಗಳು",
    "op.standing_available":       "ನಿಂತಿರುವ ಜಾಗ",
    "op.passengers_onboard":       "ಬೋರ್ಡ್‌ನಲ್ಲಿ ಪ್ರಯಾಣಿಕರು",
    "op.btn_issue_ticket":         "ಟಿಕೆಟ್ ನೀಡಿ",
    "op.no_tickets":               "ಇಂದು ಯಾವ ಟಿಕೆಟ್ ಇಲ್ಲ",

    "sec.dashboard":               "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    "sec.bus_monitoring":          "ಬಸ್ ಮೇಲ್ವಿಚಾರಣೆ",
    "sec.operators":               "ಆಪರೇಟರ್‌ಗಳು",
    "sec.routes":                  "ಮಾರ್ಗಗಳು",
    "sec.reports":                 "ವರದಿಗಳು",
    "sec.overview_title":          "ವಲಯ ಅವಲೋಕನ",
    "sec.btn_add_operator":        "ಆಪರೇಟರ್ ಸೇರಿಸಿ",
    "sec.no_operators":            "ಯಾವ ಆಪರೇಟರ್ ನೋಂದಣಿಯಾಗಿಲ್ಲ",
    "sec.btn_generate":            "ವರದಿ ತಯಾರಿಸಿ",

    "busstop.title":               "ಸ್ಮಾರ್ಟ್ ಬಸ್ ನಿಲ್ದಾಣ ಪ್ರದರ್ಶನ",
    "busstop.buses_entering":      "ಬರುತ್ತಿರುವ ಬಸ್‌ಗಳು",
    "busstop.buses_at_stop":       "ನಿಲ್ದಾಣದಲ್ಲಿ ಬಸ್‌ಗಳು",
    "busstop.buses_leaving":       "ಹೊರಡುತ್ತಿರುವ ಬಸ್‌ಗಳು",

    "landing.title":               "ಸ್ಮಾರ್ಟ್ ಬಸ್ ಸಾರಿಗೆ ವ್ಯವಸ್ಥೆ",
    "landing.subtitle":            "ಬುದ್ಧಿವಂತ ಮೇಲ್ವಿಚಾರಣೆ ಮತ್ತು ಸಾಮರ್ಥ್ಯ-ಅರಿವು ಟಿಕೆಟಿಂಗ್",
    "landing.enter":               "ಸಿಸ್ಟಮ್ ಪ್ರವೇಶಿಸಿ",

    "status.live":                 "ಲೈವ್",
    "status.seats_available":      "ಸೀಟುಗಳು ಲಭ್ಯ",
    "status.bus_full":             "ಬಸ್ ಭರ್ತಿ",

    "feature.dark_mode":           "ಡಾರ್ಕ್ ಮೋಡ್",
    "feature.fullscreen":          "ಪೂರ್ಣ ಪರದೆ",
    "feature.export_csv":          "CSV ರಫ್ತು",
    "feature.settings":            "ಸೆಟ್ಟಿಂಗ್‌ಗಳು"
  };

  translations.ta = {
    "nav.brand":              "ஸ்மார்ட் டிரான்சிட்",
    "nav.logout":             "வெளியேறு",
    "nav.system_online":      "அமைப்பு ஆன்லைன்",
    "nav.device_online":      "சாதனம் ஆன்லைன்",
    "nav.all_systems_ok":     "அனைத்து அமைப்புகளும் சரி",
    "nav.language":           "மொழி",

    "sidebar.navigation":     "வழிசெலுத்தல்",
    "sidebar.menu":           "பட்டியல்",
    "sidebar.last_sync":      "கடைசி ஒத்திசைவு:",
    "sidebar.updated":        "புதுப்பிக்கப்பட்டது:",

    "role.admin":             "நிர்வாகி",
    "role.sector":            "துறை",
    "role.operator":          "இயக்குனர்",

    "login.title":            "ஸ்மார்ட் பொது போக்குவரத்து அமைப்பு",
    "login.subtitle":         "நவீன பொது போக்குவரத்துக்கான நுண்ணறிவு கண்காணிப்பு, திறன்-விழிப்பு டிக்கெட் வழங்கல் மற்றும் IoT பாதுகாப்பு ஒருங்கிணைப்பு.",
    "login.admin_title":      "மாவட்ட அதிகாரம்",
    "login.admin_desc":       "முழு அமைப்பு கட்டுப்பாடு, துறை உருவாக்கம், பேருந்து மேலாண்மை, வழித்தட மேற்பார்வை மற்றும் மாவட்ட அளவிலான பகுப்பாய்வு.",
    "login.admin_btn":        "நிர்வாகியாக உள்நுழைக",
    "login.sector_title":     "துறை பொறுப்பாளர்",
    "login.sector_desc":      "பிராந்திய மேற்பார்வை, இயக்குனர் மேலாண்மை, பேருந்து கண்காணிப்பு, வழித்தட மேலாண்மை மற்றும் அறிக்கையிடல்.",
    "login.sector_btn":       "துறை பொறுப்பாளராக உள்நுழைக",
    "login.operator_title":   "பேருந்து இயக்குனர்",
    "login.operator_desc":    "தினசரி செயல்பாடுகள், டிக்கெட் வழங்கல், திறன் நிலை, இறங்கும் இடம் கண்காணிப்பு மற்றும் பாதுகாப்பு எச்சரிக்கைகள்.",
    "login.operator_btn":     "இயக்குனராக உள்நுழைக",
    "login.admin_login_h":    "நிர்வாகி உள்நுழைவு",
    "login.sector_login_h":   "துறை பொறுப்பாளர் உள்நுழைவு",
    "login.operator_login_h": "பேருந்து இயக்குனர் உள்நுழைவு",
    "login.password":         "கடவுச்சொல்",
    "login.back_roles":       "← பங்கு தேர்வுக்கு திரும்பு",

    "admin.live_monitoring":       "நேரடி கண்காணிப்பு",
    "admin.bus_management":        "பேருந்து மேலாண்மை",
    "admin.sector_management":     "துறை மேலாண்மை",
    "admin.route_management":      "வழித்தட மேலாண்மை",
    "admin.live_map":              "நேரடி வரைபடம்",
    "admin.analytics":             "பகுப்பாய்வு",
    "admin.stat_total_buses":      "மொத்த பேருந்துகள்",
    "admin.stat_active_buses":     "செயலில் பேருந்துகள்",
    "admin.stat_total_pax":        "மொத்த பயணிகள்",
    "admin.refresh":               "புதுப்பி",

    "op.capacity_status":          "திறன் நிலை",
    "op.issue_ticket":             "டிக்கெட் வழங்கு",
    "op.dropoff_tracking":         "இறங்கும் இடம் கண்காணிப்பு",
    "op.safety_alerts":            "பாதுகாப்பு எச்சரிக்கைகள்",
    "op.seats_available":          "கிடைக்கும் இருக்கைகள்",
    "op.standing_available":       "நிற்கும் இடம்",
    "op.passengers_onboard":       "பயணிகள் உள்ளே",
    "op.btn_issue_ticket":         "டிக்கெட் வழங்கு",

    "sec.dashboard":               "டாஷ்போர்டு",
    "sec.bus_monitoring":          "பேருந்து கண்காணிப்பு",
    "sec.operators":               "இயக்குனர்கள்",
    "sec.routes":                  "வழித்தடங்கள்",
    "sec.reports":                 "அறிக்கைகள்",

    "busstop.title":               "ஸ்மார்ட் பேருந்து நிலையம் காட்சி",
    "landing.title":               "ஸ்மார்ட் பேருந்து போக்குவரத்து அமைப்பு",
    "landing.subtitle":            "நுண்ணறிவு கண்காணிப்பு மற்றும் திறன்-விழிப்பு டிக்கெட் வழங்கல்",
    "landing.enter":               "அமைப்புக்குள் நுழைக",

    "status.live":                 "நேரடி",
    "feature.dark_mode":           "இருள் பயன்முறை",
    "feature.fullscreen":          "முழு திரை",
    "feature.export_csv":          "CSV ஏற்றுமதி",
    "feature.settings":            "அமைப்புகள்"
  };

  translations.te = {
    "nav.brand":              "స్మార్ట్ ట్రాన్సిట్",
    "nav.logout":             "లాగ్ అవుట్",
    "nav.system_online":      "సిస్టమ్ ఆన్‌లైన్",
    "nav.device_online":      "పరికరం ఆన్‌లైన్",
    "nav.all_systems_ok":     "అన్ని సిస్టమ్‌లు సరి",
    "nav.language":           "భాష",

    "sidebar.navigation":     "నావిగేషన్",
    "sidebar.menu":           "మెనూ",
    "sidebar.last_sync":      "చివరి సమకాలీకరణ:",
    "sidebar.updated":        "నవీకరించబడింది:",

    "role.admin":             "అడ్మిన్",
    "role.sector":            "సెక్టార్",
    "role.operator":          "ఆపరేటర్",

    "login.title":            "స్మార్ట్ ప్రజా రవాణా వ్యవస్థ",
    "login.subtitle":         "ఆధునిక ప్రజా రవాణా కోసం తెలివైన పర్యవేక్షణ, సామర్థ్య-అవగాహన టిక్కెటింగ్ మరియు IoT భద్రత ఏకీకరణ.",
    "login.admin_title":      "జిల్లా అధికారం",
    "login.admin_desc":       "పూర్తి సిస్టమ్ నియంత్రణ, సెక్టార్ సృష్టి, బస్ నిర్వహణ, మార్గ పర్యవేక్షణ, మరియు జిల్లా-వ్యాప్త విశ్లేషణ.",
    "login.admin_btn":        "అడ్మిన్‌గా లాగిన్",
    "login.sector_title":     "సెక్టార్ ఇన్‌చార్జ్",
    "login.sector_desc":      "ప్రాంతీయ పర్యవేక్షణ, ఆపరేటర్ నిర్వహణ, బస్ పర్యవేక్షణ, మార్గ నిర్వహణ మరియు నివేదన.",
    "login.sector_btn":       "సెక్టార్ ఇన్‌చార్జ్‌గా లాగిన్",
    "login.operator_title":   "బస్ ఆపరేటర్",
    "login.operator_desc":    "రోజువారీ కార్యకలాపాలు, టిక్కెట్ జారీ, సామర్థ్య స్థితి, డ్రాప్-ఆఫ్ ట్రాకింగ్ మరియు భద్రతా హెచ్చరికలు.",
    "login.operator_btn":     "ఆపరేటర్‌గా లాగిన్",
    "login.password":         "పాస్‌వర్డ్",
    "login.back_roles":       "← పాత్ర ఎంపికకు తిరిగి",

    "admin.live_monitoring":       "లైవ్ పర্যవేక్షణ",
    "admin.bus_management":        "బస్ నిర్వహణ",
    "admin.sector_management":     "సెక్టార్ నిర్వహణ",
    "admin.route_management":      "మార్గ నిర్వహణ",
    "admin.live_map":              "లైవ్ మ్యాప్",
    "admin.analytics":             "విశ్లేషణ",
    "admin.stat_total_buses":      "మొత్తం బస్‌లు",
    "admin.stat_active_buses":     "చురుకైన బస్‌లు",
    "admin.stat_total_pax":        "మొత్తం ప్రయాణికులు",
    "admin.refresh":               "రిఫ్రెష్",

    "op.capacity_status":          "సామర్థ్య స్థితి",
    "op.issue_ticket":             "టిక్కెట్ జారీ",
    "op.dropoff_tracking":         "డ్రాప్-ఆఫ్ ట్రాకింగ్",
    "op.safety_alerts":            "భద్రతా హెచ్చరికలు",
    "op.seats_available":          "అందుబాటులో ఉన్న సీట్లు",
    "op.standing_available":       "నిలబడే స్థలం",
    "op.passengers_onboard":       "బోర్డులో ప్రయాణికులు",
    "op.btn_issue_ticket":         "టిక్కెట్ జారీ చేయి",

    "sec.dashboard":               "డాష్‌బోర్డ్",
    "sec.bus_monitoring":          "బస్ పర్యవేక్షణ",
    "sec.operators":               "ఆపరేటర్లు",
    "sec.routes":                  "మార్గాలు",
    "sec.reports":                 "నివేదనలు",

    "busstop.title":               "స్మార్ట్ బస్ స్టాప్ డిస్‌ప్లే",
    "landing.title":               "స్మార్ట్ బస్ రవాణా వ్యవస్థ",
    "landing.subtitle":            "తెలివైన పర్యవేక్షణ & సామర్థ్య-అవగాహన టిక్కెటింగ్",
    "landing.enter":               "సిస్టమ్‌లో ప్రవేశించండి",

    "status.live":                 "లైవ్",
    "feature.dark_mode":           "డార్క్ మోడ్",
    "feature.fullscreen":          "పూర్తి స్క్రీన్",
    "feature.export_csv":          "CSV ఎగుమతి",
    "feature.settings":            "సెట్టింగ్‌లు"
  };

  /* ═══ CORE API ═══ */

  /**
   * Get the translated string for a key.
   * Falls back to English, then returns the key itself.
   */
  function t(key, replacements) {
    const lang = translations[currentLang] || {};
    const en   = translations.en || {};
    let str    = lang[key] || en[key] || key;

    // Support simple {{placeholder}} replacements
    if (replacements && typeof replacements === 'object') {
      Object.keys(replacements).forEach(function(k) {
        str = str.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), replacements[k]);
      });
    }

    return str;
  }

  /**
   * Apply translations to the current DOM.
   * Scans for data-i18n, data-i18n-placeholder, data-i18n-title attributes.
   */
  function applyToDOM() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (key) {
        // Preserve inner HTML elements (like <i> icons) by checking
        var icons = el.querySelectorAll('i.fas, i.far, i.fab');
        if (icons.length > 0 && el.childNodes.length > 1) {
          // Element has both icon and text — only replace the text node
          var textSet = false;
          for (var i = 0; i < el.childNodes.length; i++) {
            if (el.childNodes[i].nodeType === 3) { // text node
              el.childNodes[i].textContent = ' ' + t(key);
              textSet = true;
              break;
            }
          }
          if (!textSet) el.textContent = t(key);
        } else {
          el.textContent = t(key);
        }
      }
    });

    // Preserve icon + text in elements like <button><i class="fas ..."></i> Text</button>
    document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });

    // Title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });

    // Update lang-switcher display
    updateSwitcherLabel();
  }

  /**
   * Set the active language and re-apply translations.
   */
  function setLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) {
      console.warn('[i18n] Unsupported language:', lang);
      return;
    }
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    applyToDOM();

    // Dispatch event for any JS listeners
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: lang } }));
  }

  /**
   * Get the current language code.
   */
  function getLanguage() {
    return currentLang;
  }

  /**
   * Get list of supported languages with metadata.
   */
  function getSupportedLanguages() {
    return SUPPORTED.map(function(code) {
      return { code: code, name: LANG_LABELS[code].name, flag: LANG_LABELS[code].flag };
    });
  }

  /* ═══ LANGUAGE SWITCHER UI ═══ */

  /**
   * Inject a language-switcher dropdown into the navbar.
   * Looks for .nav-right and inserts before the logout button.
   */
  function injectSwitcher() {
    var navRight = document.querySelector('.nav-right');
    if (!navRight) {
      // Try login-page header nav
      navRight = document.querySelector('nav');
    }
    if (!navRight) return;

    // Don't duplicate
    if (document.getElementById('langSwitcher')) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'lang-switcher';
    wrapper.id = 'langSwitcher';

    var btn = document.createElement('button');
    btn.className = 'lang-switcher-btn';
    btn.id = 'langSwitcherBtn';
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-globe"></i> <span id="langSwitcherLabel">' +
      (LANG_LABELS[currentLang].flag + ' ' + LANG_LABELS[currentLang].name) +
      '</span> <i class="fas fa-chevron-down" style="font-size:.65rem;margin-left:2px"></i>';

    var dropdown = document.createElement('div');
    dropdown.className = 'lang-dropdown';
    dropdown.id = 'langDropdown';

    SUPPORTED.forEach(function(code) {
      var opt = document.createElement('div');
      opt.className = 'lang-option' + (code === currentLang ? ' active' : '');
      opt.dataset.lang = code;
      opt.innerHTML = LANG_LABELS[code].flag + ' ' + LANG_LABELS[code].name;
      opt.addEventListener('click', function(e) {
        e.stopPropagation();
        setLanguage(code);
        dropdown.classList.remove('open');
        // Update active class
        dropdown.querySelectorAll('.lang-option').forEach(function(o){ o.classList.remove('active'); });
        opt.classList.add('active');
      });
      dropdown.appendChild(opt);
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);

    // Toggle dropdown
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', function() {
      dropdown.classList.remove('open');
    });

    // Insert before logout button
    var logoutBtn = navRight.querySelector('.btn-logout');
    if (logoutBtn) {
      navRight.insertBefore(wrapper, logoutBtn);
    } else {
      navRight.appendChild(wrapper);
    }
  }

  function updateSwitcherLabel() {
    var label = document.getElementById('langSwitcherLabel');
    if (label) {
      label.textContent = LANG_LABELS[currentLang].flag + ' ' + LANG_LABELS[currentLang].name;
    }
    // Update active option in dropdown
    var dropdown = document.getElementById('langDropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.lang-option').forEach(function(opt) {
        opt.classList.toggle('active', opt.dataset.lang === currentLang);
      });
    }
  }

  /* ═══ INITIALIZATION ═══ */

  function initialize() {
    // Restore saved language
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.indexOf(saved) !== -1) {
      currentLang = saved;
    }
    document.documentElement.setAttribute('lang', currentLang);

    isReady = true;
    readyCallbacks.forEach(function(cb) { cb(); });
    readyCallbacks = [];
  }

  /**
   * Register a callback for when i18n is ready.
   */
  function onReady(cb) {
    if (isReady) { cb(); }
    else { readyCallbacks.push(cb); }
  }

  // Auto-initialize
  initialize();

  // When DOM is ready, inject switcher and apply translations
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      injectSwitcher();
      applyToDOM();
    });
  } else {
    // DOM already loaded
    injectSwitcher();
    applyToDOM();
  }

  /* ═══ PUBLIC API ═══ */
  global.I18n = {
    t:                    t,
    setLanguage:          setLanguage,
    getLanguage:          getLanguage,
    getSupportedLanguages:getSupportedLanguages,
    applyToDOM:           applyToDOM,
    onReady:              onReady,
    injectSwitcher:       injectSwitcher,
    translations:         translations
  };

})(window);
