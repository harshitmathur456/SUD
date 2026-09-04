/**
 * Vehicle Detections and Watchlist Database
 * Conforming to PRD Section 5.3 & Section 14 Schemas
 */

export const WATCHLIST = [
  {
    id: 1,
    plate_number: "GJ01ST0007",
    vehicle_model: "Red Honda City (2023)",
    reason: "Stolen Vehicle (FIR #2026-8812)",
    added_by: "Inspector R. Patel, Navrangpura PS",
    added_at: "2026-09-02 14:30:00 UTC",
    severity: "critical",
    last_known_location: "Ahmedabad Western Corridor"
  },
  {
    id: 2,
    plate_number: "GJ05WL9999",
    vehicle_model: "Black Mahindra Thar 4x4",
    reason: "Suspected Contraband Transit / Armed Suspects",
    added_by: "State Intelligence Bureau (SIB Gandhinagar)",
    added_at: "2026-09-03 09:15:00 UTC",
    severity: "critical",
    last_known_location: "NH-48 Corridor"
  },
  {
    id: 3,
    plate_number: "GJ12BK4433",
    vehicle_model: "Silver Maruti Swift VXI",
    reason: "Missing Person Linked Vehicle",
    added_by: "Gandhidham Kutch Police",
    added_at: "2026-09-03 18:45:00 UTC",
    severity: "moderate",
    last_known_location: "Kutch East Highway"
  }
];

export const VEHICLE_DATABASE = {
  "GJ01AB1234": {
    plate_number: "GJ01AB1234",
    vehicle_desc: "Silver Toyota Fortuner Legender (2024)",
    owner: "Kishore M. Trivedi (Commercial Fleet)",
    color: "#e2e8f0",
    detections: [
      {
        id: 101,
        camera_id: 1,
        location_name: "01 Chiman bhai Bridge, Ahmedabad",
        timestamp_pts: 1725437415000,
        timestamp_utc: "2026-09-04 08:10:15 UTC",
        confidence: 98.6,
        speed_est_kmh: 48,
        bbox: { x1: 180, y1: 220, x2: 340, y2: 275 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.4,
        is_gap_hop: false
      },
      {
        id: 102,
        camera_id: 2,
        location_name: "02 Janpath, Ahmedabad",
        timestamp_pts: 1725437680000,
        timestamp_utc: "2026-09-04 08:14:40 UTC",
        confidence: 97.2,
        speed_est_kmh: 42,
        bbox: { x1: 210, y1: 195, x2: 380, y2: 250 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 5.8,
        is_gap_hop: false
      },
      {
        id: 103,
        camera_id: 13,
        location_name: "13 CN Vidhyalaya, Ambawadi, Ahmedabad",
        timestamp_pts: 1725438065000,
        timestamp_utc: "2026-09-04 08:21:05 UTC",
        confidence: 99.1,
        speed_est_kmh: 38,
        bbox: { x1: 240, y1: 280, x2: 410, y2: 335 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 7.2,
        is_gap_hop: false
      },
      {
        id: 104,
        camera_id: 14,
        location_name: "14 Delight Bakery, Paldi, Ahmedabad",
        timestamp_pts: 1725438390000,
        timestamp_utc: "2026-09-04 08:26:30 UTC",
        confidence: 95.8,
        speed_est_kmh: 32,
        bbox: { x1: 160, y1: 210, x2: 320, y2: 265 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 6.0,
        is_gap_hop: false
      },
      {
        id: 105,
        camera_id: 4,
        location_name: "04 Paldi Circle, Ahmedabad",
        timestamp_pts: 1725438552000,
        timestamp_utc: "2026-09-04 08:29:12 UTC",
        confidence: 98.9,
        speed_est_kmh: 35,
        bbox: { x1: 190, y1: 230, x2: 360, y2: 285 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.5,
        is_gap_hop: true // Next segment is a large transit hop to North Ahmedabad
      },
      {
        id: 106,
        camera_id: 16,
        location_name: "16 Visat P2, Chandkheda, Ahmedabad",
        timestamp_pts: 1725439680000,
        timestamp_utc: "2026-09-04 08:48:00 UTC",
        confidence: 96.4,
        speed_est_kmh: 56,
        bbox: { x1: 220, y1: 240, x2: 390, y2: 295 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 5.5,
        is_gap_hop: false
      },
      {
        id: 107,
        camera_id: 3,
        location_name: "03 O.N.G.C. Office, Chandkheda, Ahmedabad",
        timestamp_pts: 1725439938000,
        timestamp_utc: "2026-09-04 08:52:18 UTC",
        confidence: 98.2,
        speed_est_kmh: 52,
        bbox: { x1: 170, y1: 205, x2: 345, y2: 260 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.8,
        is_gap_hop: false
      },
      {
        id: 108,
        camera_id: 12,
        location_name: "12 Tri Mandir Adalaj Tollnaka, Gandhinagar",
        timestamp_pts: 1725440745000,
        timestamp_utc: "2026-09-04 09:05:45 UTC",
        confidence: 99.5,
        speed_est_kmh: 68,
        bbox: { x1: 200, y1: 250, x2: 380, y2: 310 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 8.0,
        is_gap_hop: false
      }
    ]
  },
  "GJ11CD9876": {
    plate_number: "GJ11CD9876",
    vehicle_desc: "White Mahindra Scorpio-N (2023)",
    owner: "V. R. Solanki",
    color: "#f8fafc",
    detections: [
      {
        id: 201,
        camera_id: 11,
        location_name: "11 dolatpara-junagadh",
        timestamp_pts: 1725447730000,
        timestamp_utc: "2026-09-04 11:02:10 UTC",
        confidence: 96.8,
        speed_est_kmh: 50,
        bbox: { x1: 190, y1: 230, x2: 350, y2: 285 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.0,
        is_gap_hop: false
      },
      {
        id: 202,
        camera_id: 8,
        location_name: "08 majewadi-gate-junagadh",
        timestamp_pts: 1725448125000,
        timestamp_utc: "2026-09-04 11:08:45 UTC",
        confidence: 98.3,
        speed_est_kmh: 36,
        bbox: { x1: 210, y1: 200, x2: 375, y2: 260 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 6.2,
        is_gap_hop: false
      },
      {
        id: 203,
        camera_id: 10,
        location_name: "10 char-chowk-road-2-junagadh",
        timestamp_pts: 1725448520000,
        timestamp_utc: "2026-09-04 11:15:20 UTC",
        confidence: 94.7,
        speed_est_kmh: 28,
        bbox: { x1: 180, y1: 210, x2: 340, y2: 270 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 5.7,
        is_gap_hop: false
      },
      {
        id: 204,
        camera_id: 9,
        location_name: "09 new-bypass-near-by-circle-junagadh-2",
        timestamp_pts: 1725448970000,
        timestamp_utc: "2026-09-04 11:22:50 UTC",
        confidence: 97.9,
        speed_est_kmh: 54,
        bbox: { x1: 220, y1: 245, x2: 390, y2: 305 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 6.5,
        is_gap_hop: false
      },
      {
        id: 205,
        camera_id: 6,
        location_name: "06 Timbavadi gate-Junagadh",
        timestamp_pts: 1725449295000,
        timestamp_utc: "2026-09-04 11:28:15 UTC",
        confidence: 99.2,
        speed_est_kmh: 46,
        bbox: { x1: 175, y1: 215, x2: 345, y2: 275 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 7.0,
        is_gap_hop: false
      }
    ]
  },
  "GJ21EF4521": {
    plate_number: "GJ21EF4521",
    vehicle_desc: "Deep Blue Hyundai Creta SX",
    owner: "D. K. Patel",
    color: "#3b82f6",
    detections: [
      {
        id: 301,
        camera_id: 19,
        location_name: "19 KHAPARIA GRAM PANCHAYAT, NAVSARI",
        timestamp_pts: 1725459000000,
        timestamp_utc: "2026-09-04 14:10:00 UTC",
        confidence: 97.5,
        speed_est_kmh: 40,
        bbox: { x1: 190, y1: 220, x2: 350, y2: 275 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.0,
        is_gap_hop: false
      },
      {
        id: 302,
        camera_id: 25,
        location_name: "34 dhanori, Gandevi, Navsari",
        timestamp_pts: 1725459502000,
        timestamp_utc: "2026-09-04 14:18:22 UTC",
        confidence: 96.1,
        speed_est_kmh: 45,
        bbox: { x1: 200, y1: 230, x2: 365, y2: 285 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 5.5,
        is_gap_hop: false
      },
      {
        id: 303,
        camera_id: 28,
        location_name: "37 bilimora (Town Center)",
        timestamp_pts: 1725460000000,
        timestamp_utc: "2026-09-04 14:26:40 UTC",
        confidence: 98.8,
        speed_est_kmh: 30,
        bbox: { x1: 180, y1: 210, x2: 340, y2: 265 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.4,
        is_gap_hop: false
      },
      {
        id: 304,
        camera_id: 27,
        location_name: "36 bilimora (Station Area)",
        timestamp_pts: 1725460270000,
        timestamp_utc: "2026-09-04 14:31:10 UTC",
        confidence: 99.0,
        speed_est_kmh: 25,
        bbox: { x1: 215, y1: 240, x2: 380, y2: 295 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 7.1,
        is_gap_hop: false
      },
      {
        id: 305,
        camera_id: 29,
        location_name: "38 bilimora (NH48 Bypass)",
        timestamp_pts: 1725460685000,
        timestamp_utc: "2026-09-04 14:38:05 UTC",
        confidence: 95.4,
        speed_est_kmh: 62,
        bbox: { x1: 170, y1: 200, x2: 335, y2: 260 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 5.9,
        is_gap_hop: false
      },
      {
        id: 306,
        camera_id: 26,
        location_name: "35 TANKAL, Chikhli, Navsari",
        timestamp_pts: 1725461370000,
        timestamp_utc: "2026-09-04 14:49:30 UTC",
        confidence: 98.2,
        speed_est_kmh: 52,
        bbox: { x1: 195, y1: 225, x2: 360, y2: 280 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 6.8,
        is_gap_hop: true // Gap to Khergam interior
      },
      {
        id: 307,
        camera_id: 23,
        location_name: "30 kheram, Navsari",
        timestamp_pts: 1725462135000,
        timestamp_utc: "2026-09-04 15:02:15 UTC",
        confidence: 97.6,
        speed_est_kmh: 44,
        bbox: { x1: 185, y1: 215, x2: 355, y2: 275 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.3,
        is_gap_hop: false
      }
    ]
  },
  "GJ03GH3322": {
    plate_number: "GJ03GH3322",
    vehicle_desc: "Black Tata Nexon EV Max",
    owner: "H. S. Jadeja",
    color: "#0f172a",
    detections: [
      {
        id: 401,
        camera_id: 17,
        location_name: "17 Rajkot Bus Port CCTV",
        timestamp_pts: 1725466320000,
        timestamp_utc: "2026-09-04 16:12:00 UTC",
        confidence: 99.4,
        speed_est_kmh: 34,
        bbox: { x1: 205, y1: 235, x2: 375, y2: 290 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 7.5,
        is_gap_hop: false
      },
      {
        id: 402,
        camera_id: 18,
        location_name: "18 Rajkot CCTV (Trikon Baug)",
        timestamp_pts: 1725466900000,
        timestamp_utc: "2026-09-04 16:21:40 UTC",
        confidence: 97.8,
        speed_est_kmh: 28,
        bbox: { x1: 190, y1: 210, x2: 350, y2: 265 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 6.0,
        is_gap_hop: false
      }
    ]
  },
  "GJ01ST0007": {
    plate_number: "GJ01ST0007",
    vehicle_desc: "Red Honda City ZX (STOLEN VEHICLE)",
    owner: "Alert Record: FIR #2026-8812",
    color: "#ef4444",
    is_watchlist_hit: true,
    detections: [
      {
        id: 501,
        camera_id: 1,
        location_name: "01 Chiman bhai Bridge, Ahmedabad",
        timestamp_pts: 1725471000000,
        timestamp_utc: "2026-09-04 17:30:00 UTC",
        confidence: 99.2,
        speed_est_kmh: 72,
        bbox: { x1: 180, y1: 220, x2: 340, y2: 280 },
        thumbnail_color: "#450a0a",
        clip_duration_s: 6.8,
        is_gap_hop: false
      },
      {
        id: 502,
        camera_id: 2,
        location_name: "02 Janpath, Ahmedabad",
        timestamp_pts: 1725471240000,
        timestamp_utc: "2026-09-04 17:34:00 UTC",
        confidence: 98.4,
        speed_est_kmh: 68,
        bbox: { x1: 200, y1: 230, x2: 360, y2: 290 },
        thumbnail_color: "#450a0a",
        clip_duration_s: 5.9,
        is_gap_hop: false
      },
      {
        id: 503,
        camera_id: 5,
        location_name: "05 Visat teen Rasta, Ahmedabad",
        timestamp_pts: 1725471600000,
        timestamp_utc: "2026-09-04 17:40:00 UTC",
        confidence: 99.7,
        speed_est_kmh: 76,
        bbox: { x1: 190, y1: 215, x2: 350, y2: 275 },
        thumbnail_color: "#450a0a",
        clip_duration_s: 7.2,
        is_gap_hop: false
      }
    ]
  },
  "GJ05WL9999": {
    plate_number: "GJ05WL9999",
    vehicle_desc: "Black Mahindra Thar 4x4 (WATCHLIST TARGET)",
    owner: "State Intelligence Bureau Alert: SIB/GNR/2026/401",
    color: "#0f172a",
    is_watchlist_hit: true,
    detections: [
      {
        id: 601,
        camera_id: 26,
        location_name: "35 TANKAL, Chikhli, Navsari",
        timestamp_pts: 1725475200000,
        timestamp_utc: "2026-09-04 18:40:00 UTC",
        confidence: 97.4,
        speed_est_kmh: 82,
        bbox: { x1: 170, y1: 210, x2: 350, y2: 270 },
        thumbnail_color: "#450a0a",
        clip_duration_s: 6.2,
        is_gap_hop: false
      },
      {
        id: 602,
        camera_id: 29,
        location_name: "38 bilimora (NH48 Bypass)",
        timestamp_pts: 1725475680000,
        timestamp_utc: "2026-09-04 18:48:00 UTC",
        confidence: 99.1,
        speed_est_kmh: 88,
        bbox: { x1: 195, y1: 220, x2: 370, y2: 280 },
        thumbnail_color: "#450a0a",
        clip_duration_s: 7.0,
        is_gap_hop: false
      },
      {
        id: 603,
        camera_id: 28,
        location_name: "37 bilimora (Town Center)",
        timestamp_pts: 1725476100000,
        timestamp_utc: "2026-09-04 18:55:00 UTC",
        confidence: 96.5,
        speed_est_kmh: 45,
        bbox: { x1: 180, y1: 215, x2: 345, y2: 275 },
        thumbnail_color: "#450a0a",
        clip_duration_s: 5.8,
        is_gap_hop: false
      }
    ]
  },
  "GJ12BK4433": {
    plate_number: "GJ12BK4433",
    vehicle_desc: "Silver Maruti Swift VXI (MISSING PERSON CASE)",
    owner: "Kutch East Police Record: FIR #9921",
    color: "#cbd5e1",
    is_watchlist_hit: true,
    detections: [
      {
        id: 701,
        camera_id: 30,
        location_name: "Gandhidham Rambaugh p2, Kutch",
        timestamp_pts: 1725477600000,
        timestamp_utc: "2026-09-04 19:20:00 UTC",
        confidence: 98.9,
        speed_est_kmh: 42,
        bbox: { x1: 185, y1: 225, x2: 355, y2: 285 },
        thumbnail_color: "#450a0a",
        clip_duration_s: 6.5,
        is_gap_hop: false
      }
    ]
  },
  "GJ27AA5544": {
    plate_number: "GJ27AA5544",
    vehicle_desc: "Pearl White Maruti Ertiga VXI",
    owner: "Jitendra B. Solanki",
    color: "#ffffff",
    detections: [
      {
        id: 801,
        camera_id: 21,
        location_name: "23 Patan Dethali Char Rasta, Patan",
        timestamp_pts: 1725481200000,
        timestamp_utc: "2026-09-04 20:20:00 UTC",
        confidence: 96.2,
        speed_est_kmh: 58,
        bbox: { x1: 180, y1: 220, x2: 340, y2: 270 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.0,
        is_gap_hop: false
      },
      {
        id: 802,
        camera_id: 22,
        location_name: "28 BK Mervada tran Rasta, Banaskantha",
        timestamp_pts: 1725482500000,
        timestamp_utc: "2026-09-04 20:41:40 UTC",
        confidence: 98.5,
        speed_est_kmh: 65,
        bbox: { x1: 195, y1: 230, x2: 360, y2: 285 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 6.8,
        is_gap_hop: false
      }
    ]
  },
  "GJ06BB7788": {
    plate_number: "GJ06BB7788",
    vehicle_desc: "Midnight Blue Kia Seltos GTX",
    owner: "R. M. Desai",
    color: "#1e3a8a",
    detections: [
      {
        id: 901,
        camera_id: 7,
        location_name: "07 hero-showroom-gir-somnath, Gir Somnath",
        timestamp_pts: 1725484800000,
        timestamp_utc: "2026-09-04 21:20:00 UTC",
        confidence: 97.9,
        speed_est_kmh: 52,
        bbox: { x1: 180, y1: 215, x2: 350, y2: 275 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.3,
        is_gap_hop: false
      },
      {
        id: 902,
        camera_id: 6,
        location_name: "06 Timbavadi gate-Junagadh",
        timestamp_pts: 1725486600000,
        timestamp_utc: "2026-09-04 21:50:00 UTC",
        confidence: 99.1,
        speed_est_kmh: 60,
        bbox: { x1: 200, y1: 235, x2: 375, y2: 290 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 7.0,
        is_gap_hop: false
      }
    ]
  },
  "GJ18CC3311": {
    plate_number: "GJ18CC3311",
    vehicle_desc: "Silver Tata Punch EV",
    owner: "P. K. Vaghela",
    color: "#94a3b8",
    detections: [
      {
        id: 1001,
        camera_id: 15,
        location_name: "15 Suvidha park, Ahmedabad",
        timestamp_pts: 1725487800000,
        timestamp_utc: "2026-09-04 22:10:00 UTC",
        confidence: 98.2,
        speed_est_kmh: 38,
        bbox: { x1: 180, y1: 210, x2: 340, y2: 265 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 5.7,
        is_gap_hop: false
      },
      {
        id: 1002,
        camera_id: 20,
        location_name: "20 Mohanpura, Ahmedabad",
        timestamp_pts: 1725488400000,
        timestamp_utc: "2026-09-04 22:20:00 UTC",
        confidence: 97.6,
        speed_est_kmh: 40,
        bbox: { x1: 190, y1: 220, x2: 350, y2: 275 },
        thumbnail_color: "#0f172a",
        clip_duration_s: 6.1,
        is_gap_hop: false
      },
      {
        id: 1003,
        camera_id: 24,
        location_name: "33 dehgam, Gandhinagar",
        timestamp_pts: 1725489600000,
        timestamp_utc: "2026-09-04 22:40:00 UTC",
        confidence: 99.4,
        speed_est_kmh: 64,
        bbox: { x1: 195, y1: 225, x2: 360, y2: 285 },
        thumbnail_color: "#1e293b",
        clip_duration_s: 6.8,
        is_gap_hop: false
      }
    ]
  }
};

