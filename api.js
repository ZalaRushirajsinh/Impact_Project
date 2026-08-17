/**
 * Smart Lab Resource Management System - API Client Adapter
 * Dual-Mode Engine: Seamlessly connects to Python REST API Server with
 * automatic LocalStorage fallback if server is offline or opened via file://
 */

const LabAPI = (function () {
  const BASE_URL = window.location.origin && window.location.origin.startsWith('http') 
    ? window.location.origin 
    : 'http://localhost:8000';

  let isServerAvailable = null;
  const LOCAL_STORAGE_KEY = 'SMART_LAB_DATA_V2';

  // Seed data for standalone/fallback mode
  const SEED_DATA = {
    rooms: [
      {
        id: "ROOM-101",
        name: "Advanced Spectroscopy & Optics Lab",
        building: "Quantum Hall",
        floor: "1st Floor",
        maxCapacity: 12,
        currentOccupancy: 4,
        status: "Operational",
        authorizedDepartments: ["Physics", "Material Science", "Optics"],
        sensors: { temperature: 21.4, humidity: 45.2, co2: 480, powerLoad: 3.8, ventilation: "Optimal", lockStatus: "Secured" }
      },
      {
        id: "ROOM-102",
        name: "Bio-Molecular & Biotechnology Lab",
        building: "Curie Bioscience Block",
        floor: "2nd Floor",
        maxCapacity: 15,
        currentOccupancy: 7,
        status: "Operational",
        authorizedDepartments: ["Biotechnology", "Bio-Engineering", "Biochemistry"],
        sensors: { temperature: 19.8, humidity: 52.0, co2: 510, powerLoad: 5.2, ventilation: "Active HEPA", lockStatus: "Secured" }
      },
      {
        id: "ROOM-103",
        name: "Organic Chemistry & Synthesis Lab",
        building: "Mendeleev Wing",
        floor: "Ground Floor",
        maxCapacity: 10,
        currentOccupancy: 2,
        status: "Operational",
        authorizedDepartments: ["Chemistry", "Chemical Engineering", "Pharmacy"],
        sensors: { temperature: 22.1, humidity: 41.5, co2: 620, powerLoad: 4.1, ventilation: "Fume Scrubbers Active", lockStatus: "Secured" }
      },
      {
        id: "ROOM-104",
        name: "Robotics & Embedded IoT Prototyping Lab",
        building: "Turing Tech Complex",
        floor: "3rd Floor",
        maxCapacity: 20,
        currentOccupancy: 9,
        status: "Operational",
        authorizedDepartments: ["Computer Science", "Robotics", "Electrical Engineering"],
        sensors: { temperature: 23.5, humidity: 48.0, co2: 550, powerLoad: 6.7, ventilation: "Optimal", lockStatus: "Unlocked" }
      }
    ],
    equipment: [
      {
        id: "EQ-1001",
        name: "Field Emission Scanning Electron Microscope (FE-SEM)",
        category: "Imaging",
        model: "Zeiss GeminiSEM 500",
        serialNumber: "SEM-9824-Z",
        roomId: "ROOM-101",
        location: "Bench A1 - Isolation Mount",
        hourlyRate: 45,
        status: "Available",
        requiresApproval: true,
        safetyLevel: "Level 3 - Laser/High Voltage",
        lastCalibration: "2026-07-15",
        nextMaintenance: "2026-09-15",
        specifications: "Resolution 0.6 nm at 15 kV, In-lens Duo detector, EDS spectrometer attached.",
        totalUsageHours: 412,
        currentSession: null
      },
      {
        id: "EQ-1002",
        name: "High-Performance Liquid Chromatograph (HPLC)",
        category: "Analytical",
        model: "Agilent 1260 Infinity II",
        serialNumber: "HPLC-5541-A",
        roomId: "ROOM-103",
        location: "Bench C3 - Solvent Hood",
        hourlyRate: 30,
        status: "In Use",
        requiresApproval: false,
        safetyLevel: "Level 2 - Solvents & Pressure",
        lastCalibration: "2026-06-20",
        nextMaintenance: "2026-08-25",
        specifications: "Quaternary pump up to 600 bar, Diode Array Detector (DAD), Autosampler 108 vials.",
        totalUsageHours: 680,
        currentSession: {
          userName: "Dr. Sarah Vance",
          userRole: "Admin",
          startTime: "2026-08-17T09:00:00.000Z",
          expectedEnd: "2026-08-17T12:00:00.000Z",
          bookingId: "BK-2001"
        }
      },
      {
        id: "EQ-1003",
        name: "Refrigerated High-Speed Centrifuge",
        category: "Bio-Process",
        model: "Eppendorf 5424R",
        serialNumber: "CENT-1102-E",
        roomId: "ROOM-102",
        location: "Cold Bench B2",
        hourlyRate: 15,
        status: "Available",
        requiresApproval: false,
        safetyLevel: "Level 1 - General Lab Safety",
        lastCalibration: "2026-08-01",
        nextMaintenance: "2026-11-01",
        specifications: "Max speed 21,130 x g (15,000 rpm), Temp range -10°C to +40°C, 24-place rotor.",
        totalUsageHours: 290,
        currentSession: null
      },
      {
        id: "EQ-1004",
        name: "UV-Vis Double Beam Spectrophotometer",
        category: "Analytical",
        model: "Shimadzu UV-2600i",
        serialNumber: "SPEC-3342-S",
        roomId: "ROOM-101",
        location: "Bench A4",
        hourlyRate: 20,
        status: "Available",
        requiresApproval: false,
        safetyLevel: "Level 1 - Optical Hazard",
        lastCalibration: "2026-07-28",
        nextMaintenance: "2026-10-28",
        specifications: "Wavelength range 185 to 900 nm, photometric accuracy ±0.002 Abs, Lo-Ray-Ligh diffraction grating.",
        totalUsageHours: 185,
        currentSession: null
      },
      {
        id: "EQ-1005",
        name: "Industrial Dual-Extrusion 3D Rapid Prototyper",
        category: "Fabrication",
        model: "UltiMaker S5 Pro Bundle",
        serialNumber: "3DP-7730-U",
        roomId: "ROOM-104",
        location: "Fab Pod 1",
        hourlyRate: 18,
        status: "Under Maintenance",
        requiresApproval: false,
        safetyLevel: "Level 1 - Thermal & Mechanical",
        lastCalibration: "2026-05-10",
        nextMaintenance: "2026-08-18",
        specifications: "Build volume 330 x 240 x 300 mm, dual print core, Material Station with humidity control.",
        totalUsageHours: 520,
        currentSession: null
      },
      {
        id: "EQ-1006",
        name: "Digital Storage Mixed-Signal Oscilloscope",
        category: "Optics",
        model: "Keysight InfiniiVision DSOX3054T",
        serialNumber: "OSC-6621-K",
        roomId: "ROOM-104",
        location: "Electronics Workstation 2",
        hourlyRate: 12,
        status: "Available",
        requiresApproval: false,
        safetyLevel: "Level 1 - ESD Safe",
        lastCalibration: "2026-06-12",
        nextMaintenance: "2026-12-12",
        specifications: "500 MHz bandwidth, 4 analog + 16 digital channels, 5 GSa/s sample rate, 1M waveforms/sec.",
        totalUsageHours: 340,
        currentSession: null
      },
      {
        id: "EQ-1007",
        name: "Automatic Benchtop Autoclave & Sterilizer",
        category: "Bio-Process",
        model: "Tuttnauer 2840EL-D",
        serialNumber: "AUTO-4409-T",
        roomId: "ROOM-102",
        location: "Sterilization Bay D",
        hourlyRate: 25,
        status: "Available",
        requiresApproval: true,
        safetyLevel: "Level 2 - High Pressure/Steam",
        lastCalibration: "2026-08-05",
        nextMaintenance: "2026-09-05",
        specifications: "Chamber volume 28L, temp range 105°C - 137°C, built-in fast cooling and HEPA air drying.",
        totalUsageHours: 195,
        currentSession: null
      }
    ],
    inventory: [
      {
        id: "CHEM-301",
        name: "Acetonitrile (HPLC Grade, ≥99.9%)",
        casNumber: "75-05-8",
        category: "Solvent",
        formula: "CH3CN",
        roomId: "ROOM-103",
        location: "Flammable Safety Cabinet F-01",
        quantity: 2.5,
        unit: "Liters",
        minThreshold: 4.0,
        status: "Low Stock",
        expiryDate: "2027-04-30",
        batchNo: "ACN-2025-089",
        nfpa: { health: 2, flammability: 3, instability: 0, special: "" }
      },
      {
        id: "CHEM-302",
        name: "Sodium Dodecyl Sulfate (SDS, BioUltra)",
        casNumber: "151-21-3",
        category: "Surfactant / Reagent",
        formula: "C12H25NaO4S",
        roomId: "ROOM-102",
        location: "Dry Reagent Shelf B-04",
        quantity: 1200,
        unit: "Grams",
        minThreshold: 500,
        status: "Adequate",
        expiryDate: "2028-01-15",
        batchNo: "SDS-9941-B",
        nfpa: { health: 2, flammability: 1, instability: 1, special: "" }
      },
      {
        id: "CHEM-303",
        name: "Sulfuric Acid (Concentrated, 95-98%)",
        casNumber: "7664-93-9",
        category: "Inorganic Acid",
        formula: "H2SO4",
        roomId: "ROOM-103",
        location: "Acid Corrosive Locker A-02",
        quantity: 5.0,
        unit: "Liters",
        minThreshold: 2.0,
        status: "Adequate",
        expiryDate: "2029-06-30",
        batchNo: "SULF-8820",
        nfpa: { health: 3, flammability: 0, instability: 2, special: "W" }
      },
      {
        id: "CHEM-304",
        name: "Taq DNA Polymerase (5 U/µL)",
        casNumber: "9012-31-1",
        category: "Enzyme / Biotech",
        formula: "Biological Extract",
        roomId: "ROOM-102",
        location: "Ultra-Low Freezer -20°C (Rack 2)",
        quantity: 250,
        unit: "Units",
        minThreshold: 500,
        status: "Critical",
        expiryDate: "2026-11-30",
        batchNo: "TAQ-BIO-44",
        nfpa: { health: 1, flammability: 0, instability: 0, special: "BIO" }
      },
      {
        id: "CHEM-305",
        name: "Isopropanol (Anhydrous, 99.5%)",
        casNumber: "67-63-0",
        category: "Solvent",
        formula: "C3H8O",
        roomId: "ROOM-104",
        location: "Solvent Locker E-03",
        quantity: 8.0,
        unit: "Liters",
        minThreshold: 3.0,
        status: "Adequate",
        expiryDate: "2027-12-01",
        batchNo: "IPA-441-2025",
        nfpa: { health: 2, flammability: 3, instability: 0, special: "" }
      },
      {
        id: "CHEM-306",
        name: "PLA+ High Precision 3D Filament (1.75mm)",
        casNumber: "26100-51-6",
        category: "Consumable",
        formula: "(C3H4O2)n",
        roomId: "ROOM-104",
        location: "Dry Box Storage D-1",
        quantity: 14,
        unit: "Spools",
        minThreshold: 5,
        status: "Adequate",
        expiryDate: "2029-01-01",
        batchNo: "PLA-BLK-99",
        nfpa: { health: 0, flammability: 1, instability: 0, special: "" }
      }
    ],
    bookings: [
      {
        id: "BK-2001",
        equipmentId: "EQ-1002",
        equipmentName: "High-Performance Liquid Chromatograph (HPLC)",
        userName: "Dr. Sarah Vance",
        userEmail: "s.vance@smartlab.edu",
        userRole: "Admin",
        department: "Chemistry",
        date: "2026-08-17",
        startTime: "09:00",
        endTime: "12:00",
        durationHours: 3,
        totalCost: 90,
        purpose: "Pharmacokinetic metabolite purity separation analysis",
        status: "In-Session",
        checkedInAt: "2026-08-17T09:02:15.000Z",
        checkedOutAt: null,
        qrPassCode: "PASS-BK2001-9981"
      },
      {
        id: "BK-2002",
        equipmentId: "EQ-1001",
        equipmentName: "Field Emission Scanning Electron Microscope (FE-SEM)",
        userName: "Elena Rostova",
        userEmail: "e.rostova@smartlab.edu",
        userRole: "Student",
        department: "Material Science",
        date: "2026-08-17",
        startTime: "14:00",
        endTime: "16:30",
        durationHours: 2.5,
        totalCost: 112.5,
        purpose: "Graphene oxide nanosheet topography and grain boundary characterization",
        status: "Confirmed",
        checkedInAt: null,
        checkedOutAt: null,
        qrPassCode: "PASS-BK2002-4521"
      },
      {
        id: "BK-2003",
        equipmentId: "EQ-1003",
        equipmentName: "Refrigerated High-Speed Centrifuge",
        userName: "Markus Reed",
        userEmail: "m.reed@smartlab.edu",
        userRole: "Technician",
        department: "Biotechnology",
        date: "2026-08-18",
        startTime: "10:00",
        endTime: "11:30",
        durationHours: 1.5,
        totalCost: 22.5,
        purpose: "Plasmid DNA pellet purification for PCR amplification",
        status: "Confirmed",
        checkedInAt: null,
        checkedOutAt: null,
        qrPassCode: "PASS-BK2003-8812"
      },
      {
        id: "BK-2004",
        equipmentId: "EQ-1007",
        equipmentName: "Automatic Benchtop Autoclave & Sterilizer",
        userName: "Elena Rostova",
        userEmail: "e.rostova@smartlab.edu",
        userRole: "Student",
        department: "Biotechnology",
        date: "2026-08-18",
        startTime: "13:00",
        endTime: "15:00",
        durationHours: 2,
        totalCost: 50,
        purpose: "Sterilization of nutrient agar media and surgical dissection tools",
        status: "Pending Approval",
        checkedInAt: null,
        checkedOutAt: null,
        qrPassCode: "PASS-BK2004-3329"
      }
    ],
    maintenance: [
      {
        id: "MNT-501",
        equipmentId: "EQ-1005",
        equipmentName: "Industrial Dual-Extrusion 3D Rapid Prototyper",
        reportedBy: "Markus Reed (Chief Technician)",
        priority: "High",
        issueType: "Nozzle Thermal Runaway & Jam",
        description: "Extruder Core 2 temperature fluctuation exceeds ±15°C. Hotend requires disassembly, ultrasonic cleaning, and thermistor sensor recalibration.",
        reportedDate: "2026-08-16",
        scheduledDate: "2026-08-18",
        status: "In Progress",
        assignedTo: "Markus Reed",
        estimatedDowntimeHours: 6
      },
      {
        id: "MNT-502",
        equipmentId: "EQ-1002",
        equipmentName: "High-Performance Liquid Chromatograph (HPLC)",
        reportedBy: "Automated IoT Monitor",
        priority: "Medium",
        issueType: "Quarterly Preventive Calibration",
        description: "Routine pump seal replacement, pressure ripple diagnostics, and UV flow cell alignment calibration.",
        reportedDate: "2026-08-15",
        scheduledDate: "2026-08-25",
        status: "Scheduled",
        assignedTo: "Agilent Certified Service",
        estimatedDowntimeHours: 4
      }
    ],
    accessLogs: [
      {
        id: "LOG-9001",
        timestamp: "2026-08-17T08:45:10.000Z",
        badgeId: "RFID-88129",
        userName: "Dr. Sarah Vance",
        userRole: "Admin",
        department: "Chemistry",
        roomId: "ROOM-103",
        roomName: "Organic Chemistry & Synthesis Lab",
        action: "ENTRY_GRANTED",
        method: "Smart RFID Badge"
      },
      {
        id: "LOG-9002",
        timestamp: "2026-08-17T09:12:00.000Z",
        badgeId: "RFID-34901",
        userName: "Elena Rostova",
        userRole: "Student",
        department: "Material Science",
        roomId: "ROOM-101",
        roomName: "Advanced Spectroscopy & Optics Lab",
        action: "ENTRY_GRANTED",
        method: "Smart RFID Badge"
      },
      {
        id: "LOG-9003",
        timestamp: "2026-08-17T09:30:22.000Z",
        badgeId: "RFID-77114",
        userName: "Guest Student (Unauthorized)",
        userRole: "Visitor",
        department: "Economics",
        roomId: "ROOM-102",
        roomName: "Bio-Molecular & Biotechnology Lab",
        action: "ENTRY_DENIED",
        reason: "Safety Level 3 Certification Required",
        method: "Smart RFID Badge"
      }
    ],
    auditTrail: [
      {
        id: "AUD-101",
        timestamp: "2026-08-17T09:02:15.000Z",
        action: "EQUIPMENT_CHECKIN",
        user: "Dr. Sarah Vance",
        details: "Checked in to Agilent 1260 HPLC (EQ-1002) via QR Pass code."
      },
      {
        id: "AUD-102",
        timestamp: "2026-08-17T08:30:00.000Z",
        action: "CHEMICAL_CONSUMPTION",
        user: "Markus Reed",
        details: "Logged consumption of 0.5L Acetonitrile for column pre-wash."
      },
      {
        id: "AUD-103",
        timestamp: "2026-08-16T16:20:00.000Z",
        action: "MAINTENANCE_TICKET_CREATED",
        user: "Markus Reed",
        details: "Opened High Priority maintenance ticket for UltiMaker 3D Printer (MNT-501)."
      }
    ]
  };

  // LocalStorage Helper functions
  function getLocalData() {
    try {
      const item = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!item) {
        setLocalData(SEED_DATA);
        return JSON.parse(JSON.stringify(SEED_DATA));
      }
      return JSON.parse(item);
    } catch (e) {
      console.warn('LocalStorage access issue:', e);
      return JSON.parse(JSON.stringify(SEED_DATA));
    }
  }

  function setLocalData(data) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save to LocalStorage:', e);
    }
  }

  function logLocalAudit(action, user, details) {
    const data = getLocalData();
    const entry = {
      id: `AUD-${Date.now().toString().slice(-5)}`,
      timestamp: new Date().toISOString(),
      action,
      user,
      details
    };
    data.auditTrail = [entry, ...(data.auditTrail || [])].slice(0, 100);
    setLocalData(data);
  }

  // Network Request with Timeout & Fallback
  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        isServerAvailable = true;
        updateServerStatusBadge(true);
        return await res.json();
      } else {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      isServerAvailable = false;
      updateServerStatusBadge(false);
      // Fall back to client-side local implementation
      return handleLocalFallback(endpoint, options);
    }
  }

  function updateServerStatusBadge(online) {
    const badge = document.getElementById('backendStatusBadge');
    if (badge) {
      if (online) {
        badge.className = 'status-badge status-online';
        badge.innerHTML = '<span class="status-dot"></span> REST Backend: Online (:8000)';
      } else {
        badge.className = 'status-badge status-fallback';
        badge.innerHTML = '<span class="status-dot"></span> Standalone Engine (Offline Sync)';
      }
    }
  }

  // Local fallback dispatcher
  function handleLocalFallback(endpoint, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    const data = getLocalData();

    if (endpoint === '/api/health') {
      return { status: 'healthy', system: 'Smart Lab Client Engine', version: '2.4.0-standalone' };
    }

    if (endpoint === '/api/summary') {
      const eq = data.equipment || [];
      return {
        totalEquipment: eq.length,
        availableEquipment: eq.filter(e => e.status === 'Available').length,
        inUseEquipment: eq.filter(e => e.status === 'In Use').length,
        maintenanceEquipment: eq.filter(e => e.status === 'Under Maintenance').length,
        activeBookings: (data.bookings || []).filter(b => b.status === 'In-Session' || b.status === 'Confirmed').length,
        lowStockCount: (data.inventory || []).filter(c => c.quantity <= c.minThreshold).length,
        openMaintenanceCount: (data.maintenance || []).filter(m => m.status !== 'Resolved').length,
        roomsCount: (data.rooms || []).length
      };
    }

    if (endpoint === '/api/rooms') {
      // Simulate live jitter
      (data.rooms || []).forEach(r => {
        r.sensors.temperature = +(r.sensors.temperature + (Math.random() * 0.2 - 0.1)).toFixed(1);
        r.sensors.humidity = +(r.sensors.humidity + (Math.random() * 0.4 - 0.2)).toFixed(1);
        r.sensors.co2 = Math.round(r.sensors.co2 + (Math.random() * 8 - 4));
      });
      setLocalData(data);
      return data.rooms;
    }

    if (endpoint === '/api/telemetry') {
      const now = new Date();
      const timeline = [];
      for (let i = 12; i > 0; i--) {
        const d = new Date(now.getTime() - i * 5 * 60000);
        timeline.push({
          time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          avgTemp: +(21.2 + (Math.random() * 1.2 - 0.6)).toFixed(1),
          avgHumidity: +(47.5 + (Math.random() * 4 - 2)).toFixed(1),
          avgCo2: Math.round(490 + (Math.random() * 40 - 20)),
          totalPowerKw: +(18.4 + (Math.random() * 2 - 1)).toFixed(1)
        });
      }
      return {
        timestamp: new Date().toISOString(),
        timeline,
        deptUsage: { "Physics & Optics": 28, "Biotechnology": 34, "Chemistry & Material": 24, "Robotics & IoT": 14 },
        systemStatus: "NORMAL",
        fumeExtractionRate: "98.2%",
        emergencyVenting: "Standby"
      };
    }

    if (endpoint.startsWith('/api/equipment')) {
      if (method === 'GET') return data.equipment || [];
      if (method === 'POST') {
        const newEq = {
          id: `EQ-${1000 + data.equipment.length + 1}`,
          status: 'Available',
          totalUsageHours: 0,
          currentSession: null,
          ...body
        };
        data.equipment.push(newEq);
        setLocalData(data);
        logLocalAudit('EQUIPMENT_CREATED', body.creator || 'Admin', `Added ${newEq.name} (${newEq.id})`);
        return newEq;
      }
    }

    if (endpoint.startsWith('/api/bookings')) {
      if (method === 'GET') return data.bookings || [];
      if (method === 'POST') {
        // Conflict validation
        const { equipmentId, date, startTime, endTime } = body;
        const toMin = t => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        const rStart = toMin(startTime);
        const rEnd = toMin(endTime);

        const conflict = data.bookings.find(b => 
          b.equipmentId === equipmentId && 
          b.date === date && 
          ['Confirmed', 'In-Session', 'Pending Approval'].includes(b.status) &&
          Math.max(rStart, toMin(b.startTime)) < Math.min(rEnd, toMin(b.endTime))
        );

        if (conflict) {
          throw new Error(`Time slot collision with booking ${conflict.id} (${conflict.startTime} - ${conflict.endTime})`);
        }

        const eq = data.equipment.find(e => e.id === equipmentId);
        const durationHrs = +((rEnd - rStart) / 60).toFixed(2);
        const rate = eq ? eq.hourlyRate : 20;

        const newBooking = {
          id: `BK-${2000 + data.bookings.length + 1}`,
          equipmentId,
          equipmentName: eq ? eq.name : 'Lab Equipment',
          userName: body.userName || 'Researcher',
          userEmail: body.userEmail || 'user@smartlab.edu',
          userRole: body.userRole || 'Student',
          department: body.department || 'Research',
          date,
          startTime,
          endTime,
          durationHours: durationHrs,
          totalCost: +(durationHrs * rate).toFixed(2),
          purpose: body.purpose || 'Experimentation',
          status: (eq && eq.requiresApproval && body.userRole === 'Student') ? 'Pending Approval' : 'Confirmed',
          checkedInAt: null,
          checkedOutAt: null,
          qrPassCode: `PASS-BK${2000 + data.bookings.length + 1}-${Math.floor(1000 + Math.random() * 9000)}`
        };

        data.bookings.push(newBooking);
        setLocalData(data);
        logLocalAudit('BOOKING_CREATED', newBooking.userName, `Booked ${newBooking.equipmentName} on ${date}`);
        return newBooking;
      }
    }

    if (endpoint.includes('/checkin')) {
      const bId = endpoint.split('/')[3];
      const booking = data.bookings.find(b => b.id === bId);
      if (booking) {
        booking.status = 'In-Session';
        booking.checkedInAt = new Date().toISOString();
        const eq = data.equipment.find(e => e.id === booking.equipmentId);
        if (eq) {
          eq.status = 'In Use';
          eq.currentSession = {
            userName: booking.userName,
            userRole: booking.userRole,
            startTime: booking.checkedInAt,
            bookingId: booking.id
          };
        }
        setLocalData(data);
        logLocalAudit('SESSION_CHECKIN', booking.userName, `Checked in to ${booking.equipmentName}`);
        return { message: 'Check-in successful', booking, equipment: eq };
      }
    }

    if (endpoint.includes('/checkout')) {
      const bId = endpoint.split('/')[3];
      const booking = data.bookings.find(b => b.id === bId);
      if (booking) {
        booking.status = 'Completed';
        booking.checkedOutAt = new Date().toISOString();
        const eq = data.equipment.find(e => e.id === booking.equipmentId);
        if (eq) {
          eq.status = 'Available';
          eq.currentSession = null;
          eq.totalUsageHours = +(eq.totalUsageHours + (booking.durationHours || 1)).toFixed(1);
        }
        setLocalData(data);
        logLocalAudit('SESSION_CHECKOUT', booking.userName, `Checked out from ${booking.equipmentName}`);
        return { message: 'Check-out successful', booking, equipment: eq };
      }
    }

    if (endpoint === '/api/inventory') {
      if (method === 'GET') return data.inventory || [];
      if (method === 'POST') {
        const newItem = {
          id: `CHEM-${300 + data.inventory.length + 1}`,
          ...body,
          status: body.quantity <= body.minThreshold ? 'Low Stock' : 'Adequate'
        };
        data.inventory.push(newItem);
        setLocalData(data);
        logLocalAudit('INVENTORY_ADDED', body.user || 'Staff', `Added chemical ${newItem.name}`);
        return newItem;
      }
    }

    if (endpoint === '/api/inventory/consume') {
      const item = data.inventory.find(i => i.id === body.id);
      if (!item) throw new Error('Inventory item not found');
      if (body.amount > item.quantity) throw new Error(`Insufficient stock. Available: ${item.quantity} ${item.unit}`);
      item.quantity = +(item.quantity - body.amount).toFixed(2);
      item.status = item.quantity <= item.minThreshold * 0.4 ? 'Critical' : (item.quantity <= item.minThreshold ? 'Low Stock' : 'Adequate');
      setLocalData(data);
      logLocalAudit('INVENTORY_CONSUMED', body.user || 'Researcher', `Used ${body.amount} ${item.unit} of ${item.name}`);
      return item;
    }

    if (endpoint === '/api/inventory/restock') {
      const item = data.inventory.find(i => i.id === body.id);
      if (!item) throw new Error('Inventory item not found');
      item.quantity = +(item.quantity + Number(body.amount)).toFixed(2);
      item.status = item.quantity > item.minThreshold ? 'Adequate' : 'Low Stock';
      setLocalData(data);
      logLocalAudit('INVENTORY_RESTOCKED', body.user || 'Technician', `Restocked +${body.amount} ${item.unit} of ${item.name}`);
      return item;
    }

    if (endpoint === '/api/maintenance') {
      if (method === 'GET') return data.maintenance || [];
      if (method === 'POST') {
        const newTicket = {
          id: `MNT-${500 + data.maintenance.length + 1}`,
          reportedDate: new Date().toISOString().split('T')[0],
          status: 'In Progress',
          ...body
        };
        data.maintenance.push(newTicket);
        const eq = data.equipment.find(e => e.id === body.equipmentId);
        if (eq) eq.status = 'Under Maintenance';
        setLocalData(data);
        logLocalAudit('MAINTENANCE_TICKET_OPENED', body.reportedBy || 'Staff', `Opened ticket for ${newTicket.equipmentName}`);
        return newTicket;
      }
    }

    if (endpoint.endsWith('/resolve')) {
      const mId = endpoint.split('/')[3];
      const mnt = data.maintenance.find(m => m.id === mId);
      if (mnt) {
        mnt.status = 'Resolved';
        mnt.resolvedAt = new Date().toISOString();
        mnt.resolutionNotes = body.resolutionNotes || 'Maintenance completed.';
        const eq = data.equipment.find(e => e.id === mnt.equipmentId);
        if (eq) {
          eq.status = 'Available';
          eq.lastCalibration = new Date().toISOString().split('T')[0];
        }
        setLocalData(data);
        logLocalAudit('MAINTENANCE_RESOLVED', body.resolvedBy || 'Technician', `Resolved ${mnt.id}`);
        return { maintenance: mnt, equipment: eq };
      }
    }

    if (endpoint === '/api/access/swipe') {
      const room = data.rooms.find(r => r.id === body.roomId);
      const isAuth = ['Admin', 'Technician'].includes(body.userRole) || (room && room.authorizedDepartments.includes(body.department));
      const logEntry = {
        id: `LOG-${9000 + (data.accessLogs || []).length + 1}`,
        timestamp: new Date().toISOString(),
        badgeId: body.badgeId,
        userName: body.userName,
        userRole: body.userRole,
        department: body.department,
        roomId: body.roomId,
        roomName: room ? room.name : 'Unknown Lab',
        action: isAuth ? 'ENTRY_GRANTED' : 'ENTRY_DENIED',
        reason: isAuth ? null : `Department '${body.department}' not authorized`,
        method: 'Smart RFID Badge'
      };
      data.accessLogs = [logEntry, ...(data.accessLogs || [])].slice(0, 100);
      if (isAuth && room) {
        room.currentOccupancy = Math.min(room.maxCapacity, (room.currentOccupancy || 0) + 1);
      }
      setLocalData(data);
      logLocalAudit('ACCESS_SWIPE', body.userName, `RFID swipe at ${room ? room.name : 'Lab'}: ${logEntry.action}`);
      return { granted: isAuth, action: logEntry.action, log: logEntry, room, reason: logEntry.reason };
    }

    if (endpoint === '/api/logs') {
      return {
        auditTrail: data.auditTrail || [],
        accessLogs: data.accessLogs || []
      };
    }

    return { error: 'Unknown fallback endpoint' };
  }

  // Public API methods
  return {
    // Health & Meta
    getHealth: () => request('/api/health'),
    getSummary: () => request('/api/summary'),
    getRooms: () => request('/api/rooms'),
    getTelemetry: () => request('/api/telemetry'),

    // Equipment
    getEquipment: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/equipment${query ? '?' + query : ''}`);
    },
    getEquipmentById: (id) => request(`/api/equipment/${id}`),
    addEquipment: (eq) => request('/api/equipment', { method: 'POST', body: JSON.stringify(eq) }),
    updateEquipment: (id, updates) => request(`/api/equipment/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteEquipment: (id) => request(`/api/equipment/${id}`, { method: 'DELETE' }),

    // Bookings
    getBookings: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/bookings${query ? '?' + query : ''}`);
    },
    createBooking: (booking) => request('/api/bookings', { method: 'POST', body: JSON.stringify(booking) }),
    updateBookingStatus: (id, status, updater) => request(`/api/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, updater }) }),
    checkInBooking: (id) => request(`/api/bookings/${id}/checkin`, { method: 'POST' }),
    checkOutBooking: (id) => request(`/api/bookings/${id}/checkout`, { method: 'POST' }),
    deleteBooking: (id) => request(`/api/bookings/${id}`, { method: 'DELETE' }),

    // Inventory
    getInventory: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/inventory${query ? '?' + query : ''}`);
    },
    addInventoryItem: (item) => request('/api/inventory', { method: 'POST', body: JSON.stringify(item) }),
    consumeInventory: (id, amount, user, reason) => request('/api/inventory/consume', { method: 'POST', body: JSON.stringify({ id, amount, user, reason }) }),
    restockInventory: (id, amount, user) => request('/api/inventory/restock', { method: 'POST', body: JSON.stringify({ id, amount, user }) }),

    // Maintenance
    getMaintenance: () => request('/api/maintenance'),
    createMaintenanceTicket: (ticket) => request('/api/maintenance', { method: 'POST', body: JSON.stringify(ticket) }),
    resolveMaintenanceTicket: (id, resolutionNotes, resolvedBy) => request(`/api/maintenance/${id}/resolve`, { method: 'PUT', body: JSON.stringify({ resolutionNotes, resolvedBy }) }),

    // Access Control & Logs
    swipeAccessCard: (swipeData) => request('/api/access/swipe', { method: 'POST', body: JSON.stringify(swipeData) }),
    getLogs: () => request('/api/logs'),

    // Storage reset utility
    resetAllData: () => {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return request('/api/health').catch(() => null);
    }
  };
})();
