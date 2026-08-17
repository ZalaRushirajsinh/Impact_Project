#!/usr/bin/env python3
"""
Smart Lab Resource Management System - Backend Server
Provides full RESTful API, persistent JSON storage, IoT sensor simulator, and static file serving.
"""

import os
import sys
import json
import time
import random
import mimetypes
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Set stdout encoding for Windows compatibility
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

PORT = 8000
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
INITIAL_DATA_FILE = os.path.join(DATA_DIR, "initial_data.json")
LAB_DATA_FILE = os.path.join(DATA_DIR, "lab_data.json")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

def load_data():
    """Load lab database, initializing from seed if needed."""
    if os.path.exists(LAB_DATA_FILE):
        try:
            with open(LAB_DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Server] Error reading lab_data.json: {e}")
    
    if os.path.exists(INITIAL_DATA_FILE):
        try:
            with open(INITIAL_DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                save_data(data)
                return data
        except Exception as e:
            print(f"[Server] Error reading initial_data.json: {e}")
            
    return {
        "rooms": [],
        "equipment": [],
        "inventory": [],
        "bookings": [],
        "maintenance": [],
        "accessLogs": [],
        "auditTrail": []
    }

def save_data(data):
    """Save lab database atomically to file."""
    try:
        tmp_file = LAB_DATA_FILE + ".tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_file, LAB_DATA_FILE)
    except Exception as e:
        print(f"[Server] Error saving lab_data.json: {e}")

def add_audit_log(data, action, user, details):
    """Helper to append an audit log entry."""
    entry = {
        "id": f"AUD-{int(time.time() * 1000) % 100000}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "user": user,
        "details": details
    }
    if "auditTrail" not in data:
        data["auditTrail"] = []
    data["auditTrail"].insert(0, entry)
    # Keep last 150 entries
    data["auditTrail"] = data["auditTrail"][:150]

class SmartLabRequestHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        raw = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def log_message(self, format, *args):
        # Clean custom logger
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {self.command} {self.path} - {args[0] if args else ''}")

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # API routing
        if path.startswith("/api/"):
            data = load_data()

            if path == "/api/health":
                return self.send_json(200, {
                    "status": "healthy",
                    "system": "Smart Lab Resource Management System",
                    "version": "2.4.0",
                    "serverTime": datetime.now(timezone.utc).isoformat()
                })

            elif path == "/api/summary":
                # Compute dashboard high-level metrics
                total_eq = len(data.get("equipment", []))
                avail_eq = sum(1 for e in data.get("equipment", []) if e.get("status") == "Available")
                in_use_eq = sum(1 for e in data.get("equipment", []) if e.get("status") == "In Use")
                maint_eq = sum(1 for e in data.get("equipment", []) if e.get("status") == "Under Maintenance")
                
                active_bookings = sum(1 for b in data.get("bookings", []) if b.get("status") in ("In-Session", "Confirmed"))
                low_stock_chemicals = sum(1 for c in data.get("inventory", []) if c.get("quantity", 0) <= c.get("minThreshold", 0))
                open_maintenance = sum(1 for m in data.get("maintenance", []) if m.get("status") in ("In Progress", "Scheduled", "Open"))

                return self.send_json(200, {
                    "totalEquipment": total_eq,
                    "availableEquipment": avail_eq,
                    "inUseEquipment": in_use_eq,
                    "maintenanceEquipment": maint_eq,
                    "activeBookings": active_bookings,
                    "lowStockCount": low_stock_chemicals,
                    "openMaintenanceCount": open_maintenance,
                    "roomsCount": len(data.get("rooms", []))
                })

            elif path == "/api/rooms":
                # Add micro-fluctuation to room sensors to simulate live IoT sensors
                rooms = data.get("rooms", [])
                for room in rooms:
                    sensors = room.setdefault("sensors", {})
                    # Slightly jitter values within safe realistic lab boundaries
                    temp_base = sensors.get("temperature", 21.0)
                    sensors["temperature"] = round(temp_base + random.uniform(-0.15, 0.15), 1)
                    hum_base = sensors.get("humidity", 45.0)
                    sensors["humidity"] = round(hum_base + random.uniform(-0.3, 0.3), 1)
                    co2_base = sensors.get("co2", 500)
                    sensors["co2"] = int(max(380, min(1200, co2_base + random.randint(-5, 6))))
                    load_base = sensors.get("powerLoad", 4.0)
                    sensors["powerLoad"] = round(max(0.5, load_base + random.uniform(-0.1, 0.1)), 1)
                save_data(data)
                return self.send_json(200, rooms)

            elif path == "/api/telemetry":
                # Real-time lab telemetry snapshot + 12-point time series for charts
                now = datetime.now()
                timeline = []
                for i in range(12, 0, -1):
                    t_str = f"{(now.hour - (i // 2)) % 24:02d}:{(now.minute - (i * 5)) % 60:02d}"
                    timeline.append({
                        "time": t_str,
                        "avgTemp": round(21.2 + random.uniform(-0.8, 0.8), 1),
                        "avgHumidity": round(47.5 + random.uniform(-2.5, 2.5), 1),
                        "avgCo2": int(490 + random.randint(-30, 45)),
                        "totalPowerKw": round(18.4 + random.uniform(-1.2, 1.8), 1)
                    })

                dept_usage = {
                    "Physics & Optics": 28,
                    "Biotechnology": 34,
                    "Chemistry & Material": 24,
                    "Robotics & IoT": 14
                }

                return self.send_json(200, {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "timeline": timeline,
                    "deptUsage": dept_usage,
                    "systemStatus": "NORMAL",
                    "fumeExtractionRate": "98.2%",
                    "emergencyVenting": "Standby"
                })

            elif path == "/api/equipment":
                category = query.get("category", [None])[0]
                status = query.get("status", [None])[0]
                search = query.get("q", [None])[0]
                
                items = data.get("equipment", [])
                if category and category != "All":
                    items = [x for x in items if x.get("category") == category]
                if status and status != "All":
                    items = [x for x in items if x.get("status") == status]
                if search:
                    s = search.lower()
                    items = [x for x in items if s in x.get("name", "").lower() or s in x.get("model", "").lower() or s in x.get("id", "").lower()]
                return self.send_json(200, items)

            elif path.startswith("/api/equipment/"):
                eq_id = path.split("/")[-1]
                eq = next((x for x in data.get("equipment", []) if x.get("id") == eq_id), None)
                if eq:
                    return self.send_json(200, eq)
                return self.send_json(404, {"error": "Equipment not found"})

            elif path == "/api/inventory":
                items = data.get("inventory", [])
                category = query.get("category", [None])[0]
                low_stock = query.get("lowStock", [None])[0]
                search = query.get("q", [None])[0]

                if category and category != "All":
                    items = [x for x in items if x.get("category") == category]
                if low_stock == "true":
                    items = [x for x in items if x.get("quantity", 0) <= x.get("minThreshold", 0)]
                if search:
                    s = search.lower()
                    items = [x for x in items if s in x.get("name", "").lower() or s in x.get("casNumber", "").lower() or s in x.get("formula", "").lower()]
                return self.send_json(200, items)

            elif path == "/api/bookings":
                status = query.get("status", [None])[0]
                user_email = query.get("userEmail", [None])[0]
                items = data.get("bookings", [])
                if status and status != "All":
                    items = [x for x in items if x.get("status") == status]
                if user_email:
                    items = [x for x in items if x.get("userEmail") == user_email]
                return self.send_json(200, items)

            elif path == "/api/maintenance":
                return self.send_json(200, data.get("maintenance", []))

            elif path == "/api/access/logs":
                return self.send_json(200, data.get("accessLogs", []))

            elif path == "/api/logs":
                return self.send_json(200, {
                    "auditTrail": data.get("auditTrail", []),
                    "accessLogs": data.get("accessLogs", [])
                })

            else:
                return self.send_json(404, {"error": "API endpoint not found"})

        # Static File Serving
        self.serve_static_file(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        data = load_data()
        body = self.read_json_body()

        if path == "/api/equipment":
            # Add new equipment
            new_id = f"EQ-{1000 + len(data.get('equipment', [])) + 1}"
            body["id"] = body.get("id") or new_id
            body.setdefault("status", "Available")
            body.setdefault("totalUsageHours", 0)
            body.setdefault("currentSession", None)
            data["equipment"].append(body)
            add_audit_log(data, "EQUIPMENT_CREATED", body.get("creator", "System Admin"), f"Added new instrument {body.get('name')} ({body['id']})")
            save_data(data)
            return self.send_json(201, body)

        elif path == "/api/bookings":
            # Create a new slot booking with conflict detection
            eq_id = body.get("equipmentId")
            date = body.get("date")
            start_time = body.get("startTime")
            end_time = body.get("endTime")

            if not eq_id or not date or not start_time or not end_time:
                return self.send_json(400, {"error": "Missing booking required fields (equipmentId, date, startTime, endTime)"})

            # Check overlap on same equipment and date
            def parse_minutes(t_str):
                try:
                    h, m = map(int, t_str.split(":"))
                    return h * 60 + m
                except Exception:
                    return 0

            req_start = parse_minutes(start_time)
            req_end = parse_minutes(end_time)

            if req_end <= req_start:
                return self.send_json(400, {"error": "End time must be later than start time"})

            for b in data.get("bookings", []):
                if b.get("equipmentId") == eq_id and b.get("date") == date and b.get("status") in ("Confirmed", "In-Session", "Pending Approval"):
                    existing_start = parse_minutes(b.get("startTime", "00:00"))
                    existing_end = parse_minutes(b.get("endTime", "00:00"))
                    # Overlap condition: max(start1, start2) < min(end1, end2)
                    if max(req_start, existing_start) < min(req_end, existing_end):
                        return self.send_json(409, {
                            "error": f"Time slot collision with booking {b.get('id')} ({b.get('startTime')} - {b.get('endTime')})"
                        })

            # Fetch equipment details
            eq = next((x for x in data.get("equipment", []) if x.get("id") == eq_id), None)
            eq_name = eq.get("name", "Equipment") if eq else "Equipment"
            rate = eq.get("hourlyRate", 20) if eq else 20
            duration_hrs = round((req_end - req_start) / 60, 2)
            total_cost = round(duration_hrs * rate, 2)

            new_booking_id = f"BK-{2000 + len(data.get('bookings', [])) + 1}"
            qr_pass = f"PASS-{new_booking_id}-{random.randint(1000, 9999)}"

            # If student and requires approval, set to Pending Approval
            status = "Confirmed"
            if eq and eq.get("requiresApproval") and body.get("userRole") == "Student":
                status = "Pending Approval"

            booking_obj = {
                "id": new_booking_id,
                "equipmentId": eq_id,
                "equipmentName": eq_name,
                "userName": body.get("userName", "Elena Rostova"),
                "userEmail": body.get("userEmail", "user@smartlab.edu"),
                "userRole": body.get("userRole", "Student"),
                "department": body.get("department", "Research"),
                "date": date,
                "startTime": start_time,
                "endTime": end_time,
                "durationHours": duration_hrs,
                "totalCost": total_cost,
                "purpose": body.get("purpose", "Laboratory Research Project"),
                "status": status,
                "checkedInAt": None,
                "checkedOutAt": None,
                "qrPassCode": qr_pass
            }

            data["bookings"].append(booking_obj)
            add_audit_log(data, "BOOKING_CREATED", booking_obj["userName"], f"Reserved {eq_name} for {date} ({start_time}-{end_time}) [{status}]")
            save_data(data)
            return self.send_json(201, booking_obj)

        elif path.startswith("/api/bookings/") and path.endswith("/checkin"):
            # Check-in via QR Pass / Booking ID
            booking_id = path.split("/")[3]
            booking = next((b for b in data.get("bookings", []) if b.get("id") == booking_id), None)
            if not booking:
                return self.send_json(404, {"error": "Booking not found"})

            booking["status"] = "In-Session"
            booking["checkedInAt"] = datetime.now(timezone.utc).isoformat()

            # Mark equipment as In Use
            eq = next((e for e in data.get("equipment", []) if e.get("id") == booking.get("equipmentId")), None)
            if eq:
                eq["status"] = "In Use"
                eq["currentSession"] = {
                    "userName": booking.get("userName"),
                    "userRole": booking.get("userRole"),
                    "startTime": booking["checkedInAt"],
                    "expectedEnd": f"{booking.get('date')}T{booking.get('endTime')}:00.000Z",
                    "bookingId": booking["id"]
                }

            add_audit_log(data, "SESSION_CHECKIN", booking.get("userName"), f"Session started on {booking.get('equipmentName')} (Booking: {booking_id})")
            save_data(data)
            return self.send_json(200, {"message": "Check-in successful", "booking": booking, "equipment": eq})

        elif path.startswith("/api/bookings/") and path.endswith("/checkout"):
            # Complete session / Check-out
            booking_id = path.split("/")[3]
            booking = next((b for b in data.get("bookings", []) if b.get("id") == booking_id), None)
            if not booking:
                return self.send_json(404, {"error": "Booking not found"})

            booking["status"] = "Completed"
            booking["checkedOutAt"] = datetime.now(timezone.utc).isoformat()

            # Release equipment
            eq = next((e for e in data.get("equipment", []) if e.get("id") == booking.get("equipmentId")), None)
            if eq:
                eq["status"] = "Available"
                eq["currentSession"] = None
                eq["totalUsageHours"] = round(eq.get("totalUsageHours", 0) + booking.get("durationHours", 1), 1)

            add_audit_log(data, "SESSION_CHECKOUT", booking.get("userName"), f"Session completed for {booking.get('equipmentName')} (Booking: {booking_id})")
            save_data(data)
            return self.send_json(200, {"message": "Check-out successful", "booking": booking, "equipment": eq})

        elif path == "/api/inventory":
            new_id = f"CHEM-{300 + len(data.get('inventory', [])) + 1}"
            body["id"] = body.get("id") or new_id
            qty = float(body.get("quantity", 0))
            min_th = float(body.get("minThreshold", 1))
            body["status"] = "Low Stock" if qty <= min_th else "Adequate"
            data["inventory"].append(body)
            add_audit_log(data, "INVENTORY_ADDED", body.get("user", "Lab Staff"), f"Added {body.get('name')} to inventory ({body.get('quantity')} {body.get('unit')})")
            save_data(data)
            return self.send_json(201, body)

        elif path == "/api/inventory/consume":
            # Decrement chemical quantity
            item_id = body.get("id")
            amount = float(body.get("amount", 0))
            user = body.get("user", "Researcher")
            reason = body.get("reason", "Lab Experiment")

            item = next((x for x in data.get("inventory", []) if x.get("id") == item_id), None)
            if not item:
                return self.send_json(404, {"error": "Inventory item not found"})

            curr_qty = float(item.get("quantity", 0))
            if amount > curr_qty:
                return self.send_json(400, {"error": f"Insufficient stock. Available: {curr_qty} {item.get('unit')}"})

            item["quantity"] = round(curr_qty - amount, 2)
            min_th = float(item.get("minThreshold", 0))
            item["status"] = "Critical" if item["quantity"] <= (min_th * 0.4) else ("Low Stock" if item["quantity"] <= min_th else "Adequate")

            add_audit_log(data, "INVENTORY_CONSUMED", user, f"Deducted {amount} {item.get('unit')} of {item.get('name')} for '{reason}' (Remaining: {item['quantity']} {item.get('unit')})")
            save_data(data)
            return self.send_json(200, item)

        elif path == "/api/inventory/restock":
            # Restock inventory
            item_id = body.get("id")
            amount = float(body.get("amount", 0))
            user = body.get("user", "Lab Technician")

            item = next((x for x in data.get("inventory", []) if x.get("id") == item_id), None)
            if not item:
                return self.send_json(404, {"error": "Inventory item not found"})

            item["quantity"] = round(float(item.get("quantity", 0)) + amount, 2)
            min_th = float(item.get("minThreshold", 0))
            item["status"] = "Adequate" if item["quantity"] > min_th else "Low Stock"

            add_audit_log(data, "INVENTORY_RESTOCKED", user, f"Restocked +{amount} {item.get('unit')} of {item.get('name')} (New Total: {item['quantity']} {item.get('unit')})")
            save_data(data)
            return self.send_json(200, item)

        elif path == "/api/maintenance":
            new_id = f"MNT-{500 + len(data.get('maintenance', [])) + 1}"
            body["id"] = body.get("id") or new_id
            body.setdefault("status", "In Progress")
            body.setdefault("reportedDate", datetime.now().strftime("%Y-%m-%d"))
            data["maintenance"].append(body)

            # Update equipment status if critical
            eq_id = body.get("equipmentId")
            eq = next((e for e in data.get("equipment", []) if e.get("id") == eq_id), None)
            if eq:
                eq["status"] = "Under Maintenance"

            add_audit_log(data, "MAINTENANCE_TICKET_OPENED", body.get("reportedBy", "Staff"), f"Opened maintenance ticket {body['id']} for {body.get('equipmentName')} [{body.get('priority')} Priority]")
            save_data(data)
            return self.send_json(201, body)

        elif path == "/api/access/swipe":
            # Smart RFID Badge Door Access Simulator
            badge_id = body.get("badgeId", "RFID-88129")
            room_id = body.get("roomId", "ROOM-101")
            user_name = body.get("userName", "Dr. Sarah Vance")
            user_role = body.get("userRole", "Admin")
            department = body.get("department", "Chemistry")

            room = next((r for r in data.get("rooms", []) if r.get("id") == room_id), None)
            if not room:
                return self.send_json(404, {"error": "Lab room not found"})

            # Admin or Department authorization
            auth_depts = room.get("authorizedDepartments", [])
            granted = (user_role in ("Admin", "Technician")) or (department in auth_depts)

            action = "ENTRY_GRANTED" if granted else "ENTRY_DENIED"
            reason = None if granted else f"User department '{department}' not authorized for {room.get('name')}"

            if granted:
                room["currentOccupancy"] = min(room.get("maxCapacity", 20), room.get("currentOccupancy", 0) + 1)

            log_entry = {
                "id": f"LOG-{9000 + len(data.get('accessLogs', [])) + 1}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "badgeId": badge_id,
                "userName": user_name,
                "userRole": user_role,
                "department": department,
                "roomId": room_id,
                "roomName": room.get("name"),
                "action": action,
                "reason": reason,
                "method": "Smart RFID Badge"
            }

            data.setdefault("accessLogs", []).insert(0, log_entry)
            data["accessLogs"] = data["accessLogs"][:100]

            add_audit_log(data, "ACCESS_SWIPE", user_name, f"RFID swipe at {room.get('name')}: {action}")
            save_data(data)

            return self.send_json(200, {
                "granted": granted,
                "action": action,
                "room": room,
                "log": log_entry,
                "reason": reason
            })

        else:
            return self.send_json(404, {"error": "API route not found"})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        data = load_data()
        body = self.read_json_body()

        if path.startswith("/api/equipment/"):
            eq_id = path.split("/")[-1]
            eq = next((e for e in data.get("equipment", []) if e.get("id") == eq_id), None)
            if not eq:
                return self.send_json(404, {"error": "Equipment not found"})
            eq.update(body)
            add_audit_log(data, "EQUIPMENT_UPDATED", body.get("updater", "Admin"), f"Updated details for {eq.get('name')} ({eq_id})")
            save_data(data)
            return self.send_json(200, eq)

        elif path.startswith("/api/bookings/") and path.endswith("/status"):
            parts = path.split("/")
            booking_id = parts[3]
            booking = next((b for b in data.get("bookings", []) if b.get("id") == booking_id), None)
            if not booking:
                return self.send_json(404, {"error": "Booking not found"})

            new_status = body.get("status")
            booking["status"] = new_status
            add_audit_log(data, "BOOKING_STATUS_CHANGED", body.get("updater", "Admin"), f"Booking {booking_id} status changed to '{new_status}'")
            save_data(data)
            return self.send_json(200, booking)

        elif path.startswith("/api/maintenance/") and path.endswith("/resolve"):
            parts = path.split("/")
            mnt_id = parts[3]
            mnt = next((m for m in data.get("maintenance", []) if m.get("id") == mnt_id), None)
            if not mnt:
                return self.send_json(404, {"error": "Maintenance ticket not found"})

            mnt["status"] = "Resolved"
            mnt["resolutionNotes"] = body.get("resolutionNotes", "Maintenance completed and tested operational.")
            mnt["resolvedAt"] = datetime.now(timezone.utc).isoformat()

            # Restore equipment status to Available
            eq_id = mnt.get("equipmentId")
            eq = next((e for e in data.get("equipment", []) if e.get("id") == eq_id), None)
            if eq and eq.get("status") == "Under Maintenance":
                eq["status"] = "Available"
                eq["lastCalibration"] = datetime.now().strftime("%Y-%m-%d")

            add_audit_log(data, "MAINTENANCE_RESOLVED", body.get("resolvedBy", "Chief Technician"), f"Resolved maintenance ticket {mnt_id} for {mnt.get('equipmentName')}")
            save_data(data)
            return self.send_json(200, {"maintenance": mnt, "equipment": eq})

        else:
            return self.send_json(404, {"error": "API route not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        data = load_data()

        if path.startswith("/api/equipment/"):
            eq_id = path.split("/")[-1]
            data["equipment"] = [x for x in data.get("equipment", []) if x.get("id") != eq_id]
            add_audit_log(data, "EQUIPMENT_DELETED", "Admin", f"Removed equipment ID {eq_id}")
            save_data(data)
            return self.send_json(200, {"message": f"Equipment {eq_id} deleted successfully"})

        elif path.startswith("/api/bookings/"):
            b_id = path.split("/")[-1]
            data["bookings"] = [x for x in data.get("bookings", []) if x.get("id") != b_id]
            add_audit_log(data, "BOOKING_CANCELLED", "User", f"Cancelled booking ID {b_id}")
            save_data(data)
            return self.send_json(200, {"message": f"Booking {b_id} deleted"})

        else:
            return self.send_json(404, {"error": "API route not found"})

    def serve_static_file(self, req_path):
        """Serve HTML, CSS, JS, JSON, and asset files."""
        if req_path == "/" or req_path == "":
            req_path = "/index.html"

        # Sanitize path to prevent directory traversal
        clean_path = os.path.normpath(req_path.lstrip("/"))
        root_dir = os.path.dirname(os.path.abspath(__file__))
        target_file = os.path.join(root_dir, clean_path)

        if not os.path.exists(target_file) or os.path.isdir(target_file):
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"<h1>404 Not Found</h1><p>Smart Lab Resource Management System</p>")
            return

        mime_type, _ = mimetypes.guess_type(target_file)
        if not mime_type:
            mime_type = "application/octet-stream"

        try:
            with open(target_file, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache, must-revalidate")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Server Error: {e}".encode("utf-8"))

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, SmartLabRequestHandler)
    print(f"============================================================")
    print(f"[SMART LAB] RESOURCE MANAGEMENT SYSTEM - BACKEND REST SERVER")
    print(f"============================================================")
    print(f"[STATUS] Server running on: http://localhost:{PORT}")
    print(f"[API]    REST API Base URL: http://localhost:{PORT}/api")
    print(f"[STORE]  Persistent Storage: {LAB_DATA_FILE}")
    print(f"============================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
