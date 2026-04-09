# 🚌 Smart Bus Transport Monitoring & Capacity-Aware Ticketing System

## Overview

A comprehensive frontend web application for intelligent public bus transport monitoring and capacity-aware ticketing system with a **professional black & white theme** and **3-tier management hierarchy**. This system provides real-time monitoring, capacity management, and IoT-assisted safety features for public buses.

---

## 🎯 Project Purpose

This project is designed for:
- **Smart City Transportation Solutions**
- **Professional Management Systems**
- **IoT System Integration Projects**
- **District-Level Transport Management**

---

## 🎨 Design Theme

**Professional Black & White Interface**
- Minimalist monochrome color scheme
- Smooth transition effects (0.4s cubic-bezier timing)
- Ripple animations on buttons
- Card hover effects with scale transforms
- Table gradient animations
- Enterprise-grade professional appearance

---

## 🏢 Management Hierarchy

### 3-Tier Structure

#### 🔹 District Admin (Top Level)
- Creates and manages Sector Incharges
- Oversees district-wide bus operations
- Configures routes and monitors all sectors
- **Login**: admin / admin123

#### 🔹 Sector Incharge (Middle Level)
- Creates and manages Bus Operators
- Monitors zone-specific operations
- Assigns operators to buses in their zone
- **Login**: sector001 / sector123, sector002 / sector123

#### 🔹 Bus Operator (Bottom Level)
- Manages assigned bus operations
- Issues tickets and tracks passengers
- Reports issues and monitors routes
- **Login**: operator001 / pass123, operator002 / pass123

---

## ✨ Features

### 1️⃣ **Login System**
- Common login portal for all three roles
- Role-based access control with automatic routing
- Secure session management
- Professional animated background

### 2️⃣ **District Admin Dashboard**
Complete district authority interface with:
- **Sector Management**: Create and configure sector incharges
- **Bus Management**: Create and configure buses with capacity settings
- **Route Configuration**: Define routes with ordered bus stops
- **Live Monitoring**: Real-time status of all buses in the district

### 3️⃣ **Sector Incharge Dashboard**
Zone-level management interface with:
- **Operator Management**: Create and assign operators to buses
- **Bus Monitoring**: Track buses in assigned zone
- **Routes Overview**: View zone-specific routes
- **Performance Reports**: Generate sector-level analytics

### 4️⃣ **Operator Dashboard**
Bus-level operational interface with:
- **Ticket Issuing**: Capacity-aware ticket booking with fare calculation
- **Live Capacity Display**: Real-time passenger count and availability
- **Drop-Off Tracking**: Monitor passengers getting off at upcoming stops
- **Safety Alerts**: IoT-based door zone safety warnings

### 5️⃣ **Bus Stop Display**
Public-facing digital display showing:
- Real-time bus arrivals and departures
- Passenger capacity status for each bus
- Color-coded availability indicators
- Auto-refresh functionality

---

## 📁 Project Structure

```
/frontend
│
├── /public
│   ├── index.html              # Landing page with navigation
│   └── favicon.ico
│
├── /pages
│   ├── login.html              # Common login page
│   ├── admin.html              # Admin dashboard
│   ├── operator.html           # Operator dashboard
│   └── busstop.html            # Public bus stop display
│
├── /components
│   ├── navbar.js               # Navigation bar component
│   ├── sidebar.js              # Sidebar navigation
│   ├── busCard.js              # Bus status cards
│   ├── capacityIndicator.js    # Capacity visualization
│   ├── alertBox.js             # Safety alert notifications
│   └── tableRenderer.js        # Reusable table components
│
├── /styles
│   ├── main.css                # Global styles and variables
│   ├── dashboard.css           # Dashboard layouts
│   ├── cards.css               # Card components
│   ├── tables.css              # Table styles
│   └── responsive.css          # Mobile responsiveness
│
├── /scripts
│   ├── auth.js                 # Authentication logic
│   ├── admin.js                # Admin page functionality
│   ├── operator.js             # Operator page logic
│   ├── busstop.js              # Bus stop display logic
│   ├── api.js                  # API calls and data management
│   └── websocket.js            # Real-time updates (simulated)
│
├── /data
│   ├── sampleBuses.json        # Sample bus data
│   ├── sampleRoutes.json       # Sample route data
│   ├── sampleTickets.json      # Sample ticket data
│   └── sampleOperators.json    # Sample operator data
│
└── README.md                   # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Basic understanding of HTML, CSS, and JavaScript
- (Optional) Local web server for better file handling

### Installation

1. **Clone or download the project**
   ```bash
   git clone <your-repo-url>
   cd SMART_BUS/frontend
   ```

2. **Open with a local server** (recommended)
   
   **Option A: Using Python**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```
   
   **Option B: Using Node.js (http-server)**
   ```bash
   npx http-server -p 8000
   ```
   
   **Option C: Using VS Code Live Server**
   - Install "Live Server" extension
   - Right-click on `public/index.html`
   - Select "Open with Live Server"

3. **Access the application**
   ```
   http://localhost:8000/public/index.html
   ```

---

## 🔐 Demo Credentials

### Admin Login
- **User ID**: `admin` or `admin001`
- **Password**: `admin` or `admin123`
- **Role**: Select "Admin"

### Operator Login
- **User ID**: `operator`, `op001`, or `op002`
- **Password**: `operator` or `op123`
- **Role**: Select "Operator"

---

## 📊 Capacity Logic

### Capacity Calculation
```
Total Capacity = Seating Capacity + Standing Capacity
```

### Status Indicators
- 🟢 **Seats Available**: `seating > 0`
- 🟡 **Standing Only**: `seating = 0 AND standing > 0`
- 🔴 **Bus Full**: `seating = 0 AND standing = 0`

### Ticket Validation
- System prevents over-capacity booking
- Visual warnings when capacity exceeded
- Real-time capacity updates across all interfaces

---

## 🎨 UI/UX Features

### Smart City Design
- Modern card-based layout
- Gradient color schemes
- Responsive grid system
- Color-coded status indicators

### Responsive Design
- Mobile-first approach
- Tablet optimization
- Desktop full-screen support
- Touch-friendly interfaces

### Real-Time Updates
- Auto-refresh functionality
- Live status monitoring
- WebSocket simulation for demos
- Smooth animations and transitions

---

## 🛠️ Technical Details

### Technologies Used
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with flexbox/grid
- **JavaScript (ES6+)**: Vanilla JS, no frameworks
- **LocalStorage**: Client-side data persistence
- **JSON**: Data interchange format

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Data Storage
- Uses browser `localStorage` for data persistence
- Falls back to sample JSON data if unavailable
- Simulates API calls with async/await patterns

---

## 📱 Pages Description

### 1. Landing Page (`index.html`)
- Entry point to the application
- Provides navigation to login

### 2. Login Page (`login.html`)
- Role selection (Admin/Operator)
- User authentication
- Session management
- Redirects based on role

### 3. Admin Dashboard (`admin.html`)
Four main sections:
- **Bus Management**: Add/edit buses with capacity configuration
- **Operator Management**: Create operators and assign buses
- **Route Management**: Configure routes with multiple stops
- **Live Monitoring**: Real-time dashboard with statistics

### 4. Operator Dashboard (`operator.html`)
Four main sections:
- **Ticket Issuing**: Book tickets with capacity validation
- **Capacity Status**: Visual capacity indicators
- **Drop-Off Tracking**: Passenger management at stops
- **Safety Alerts**: IoT sensor warnings

### 5. Bus Stop Display (`busstop.html`)
Public display features:
- Real-time bus information
- Capacity availability
- Auto-refresh every 5 seconds
- Color-coded status badges

---

## 🔧 Configuration

### Customizing Bus Stop Name
Add a query parameter to the bus stop URL:
```
busstop.html?stop=Airport Terminal
```

### Modifying Sample Data
Edit JSON files in `/data` folder:
- `sampleBuses.json`: Bus configurations
- `sampleRoutes.json`: Route definitions
- `sampleTickets.json`: Ticket records
- `sampleOperators.json`: Operator information

### Adjusting Auto-Refresh
In `busstop.js`, modify the refresh interval:
```javascript
// Change from 5 seconds to 10 seconds
let countdown = 10; // Instead of 5
```

---

## 🎓 Academic Features

### Well-Commented Code
- Detailed JSDoc comments
- Inline explanations
- Section markers for easy navigation

### Modular Architecture
- Reusable components
- Separation of concerns
- Easy to extend and modify

### Demonstration Ready
- Sample data included
- Visual appeal for presentations
- Real-time simulation
- Professional UI design

---

## 🔌 IoT Integration (Conceptual)

### Current Implementation
- Simulated sensor data
- Placeholder functions for IoT
- Ready-to-integrate structure

### Future Integration Points
1. **Passenger Counting**: IR/Ultrasonic sensors
2. **GPS Tracking**: Real-time location updates
3. **Door Safety**: Ultrasonic proximity sensors
4. **RFID Ticketing**: Contactless card readers

### WebSocket Structure
```javascript
// Example IoT message format
{
  type: 'sensor_data',
  payload: {
    busId: 'BUS001',
    sensorType: 'ultrasonic',
    value: 25,
    timestamp: '2026-02-04T10:30:00Z'
  }
}
```

---

## 📈 Future Enhancements

### Planned Features
- [ ] Real backend API integration
- [ ] Actual WebSocket implementation
- [ ] GPS-based route tracking
- [ ] Mobile app companion
- [ ] Payment gateway integration
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Accessibility features (WCAG)

---

## 🐛 Troubleshooting

### Issue: Data not persisting
**Solution**: Ensure browser allows localStorage. Check browser console for errors.

### Issue: Images/styles not loading
**Solution**: Use a local server instead of opening HTML files directly.

### Issue: Sample data not showing
**Solution**: Check that JSON files are in the correct `/data` folder.

### Issue: Login not working
**Solution**: Verify you're using the correct demo credentials listed above.

---

## 📝 Development Notes

### Adding New Features
1. Create component in `/components` if reusable
2. Add styles in appropriate CSS file
3. Update script logic in `/scripts`
4. Document in code comments

### Code Style
- Use camelCase for variables and functions
- Add JSDoc comments for functions
- Keep functions small and focused
- Use meaningful variable names

### Testing
- Test on multiple browsers
- Check responsive design on different screen sizes
- Verify all user flows
- Test with sample data

---

## 👥 Contributors

This project was created for academic demonstration purposes.

### How to Contribute
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add documentation
5. Submit a pull request

---

## 📄 License

This project is open-source and available for educational purposes.

**Note**: This is a demonstration project. For production use, implement:
- Proper backend API
- Real authentication system
- Database integration
- Security measures
- Data encryption
- Error handling

---

## 🎥 Demo Instructions

### For Presentation

1. **Start with Landing Page**
   - Show professional design
   - Explain system purpose

2. **Demonstrate Admin Dashboard**
   - Add a bus (live demo)
   - Create an operator
   - Configure a route
   - Show live monitoring

3. **Switch to Operator View**
   - Issue tickets
   - Show capacity updates
   - Demonstrate safety alerts
   - Track drop-offs

4. **Show Bus Stop Display**
   - Display on a second screen
   - Demonstrate auto-refresh
   - Show real-time updates

---

## 📞 Support

For questions or issues:
- Check troubleshooting section
- Review code comments
- Inspect browser console for errors

---

## 🙏 Acknowledgments

- Designed for Indian public transport systems
- Inspired by smart city initiatives
- Built with academic research in mind

---

## ⚡ Quick Start Commands

```bash
# Clone repository
git clone <repo-url>

# Navigate to frontend
cd SMART_BUS/frontend

# Start local server (Python)
python -m http.server 8000

# Open browser
http://localhost:8000/public/index.html

# Login as Admin
Username: admin
Password: admin
```

---

**Last Updated**: February 4, 2026  
**Version**: 1.0.0  
**Status**: Demo Ready ✅

---

## 🎯 Key Highlights for Academic Submission

✅ **Complete Documentation**  
✅ **Professional UI Design**  
✅ **Well-Commented Code**  
✅ **Responsive Design**  
✅ **Demo-Ready Data**  
✅ **IoT Integration Ready**  
✅ **Smart City Focused**  
✅ **Real-Time Simulation**

---

**Happy Coding! 🚀**
