"""
Sentinel Unified Grid — Watchlist DB & Cross-Referencing Logic
Provides instant dictionary lookup for flagged vehicles across Gujarat CCTV network.
"""

WATCHLIST_DATABASE = {
    "GJ01ST0007": {
        "plate_number": "GJ01ST0007",
        "reason": "CRITICAL: STOLEN VEHICLE (FIR #2026-8812 / Navrangpura PS)",
        "category": "Stolen",
        "severity": "CRITICAL",
        "alert_sound": True,
        "vehicle_desc": "White Hyundai Creta (2023)",
        "owner": "Rameshchandra Patel",
        "origin_district": "Ahmedabad",
        "date_flagged": "2026-09-02"
    },
    "GJ05WL9999": {
        "plate_number": "GJ05WL9999",
        "reason": "HIGH PRIORITY: WANTED FELON / CONTRABAND SUSPECT (NDPS Case #441)",
        "category": "Wanted",
        "severity": "HIGH",
        "alert_sound": True,
        "vehicle_desc": "Black Mahindra Thar 4x4",
        "owner": "Unknown (Forged Registration)",
        "origin_district": "Surat",
        "date_flagged": "2026-08-30"
    },
    "GJ18CR1122": {
        "plate_number": "GJ18CR1122",
        "reason": "URGENT: HIT & RUN INVOLVEMENT (FIR #2026-0194 / Gandhinagar Infocity)",
        "category": "Hit and Run",
        "severity": "HIGH",
        "alert_sound": True,
        "vehicle_desc": "Grey Maruti Brezza",
        "owner": "Deepak Mehta",
        "origin_district": "Gandhinagar",
        "date_flagged": "2026-09-03"
    },
    "GJ03GH3322": {
        "plate_number": "GJ03GH3322",
        "reason": "MONITORING: TAX EVASION & RTO SUSPENSION NOTICE",
        "category": "Suspension",
        "severity": "MEDIUM",
        "alert_sound": False,
        "vehicle_desc": "Silver Honda City",
        "owner": "Karan Vora",
        "origin_district": "Rajkot",
        "date_flagged": "2026-08-25"
    }
}

def check_watchlist(plate_number: str):
    """
    Fast O(1) dictionary lookup for vehicle plate cross-referencing.
    Supports normalized comparison.
    """
    if not plate_number:
        return None
    
    clean_query = plate_number.upper().replace(" ", "").replace("-", "").strip()
    
    # 1. Exact Match
    if clean_query in WATCHLIST_DATABASE:
        return WATCHLIST_DATABASE[clean_query]
    
    # 2. Check slight variations or fuzzy prefix
    for plate, info in WATCHLIST_DATABASE.items():
        if clean_query == plate.replace(" ", "").replace("-", ""):
            return info
            
    return None
