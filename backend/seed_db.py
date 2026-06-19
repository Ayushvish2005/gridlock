import csv
from datetime import datetime
from app.database.config import SessionLocal, engine, Base
from app.models.incident import Incident, IncidentStatus

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    if db.query(Incident).count() > 0:
        print("Database already seeded!")
        return

    csv_file = "/home/ayush/Desktop/grodlock/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv"
    
    incidents_to_add = []
    try:
        with open(csv_file, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                # Map CSV to Incident Model
                # id, event_type, latitude, longitude, address, event_cause, requires_road_closure, start_datetime, status, priority, zone
                
                # Parse basic fields
                lat = float(row['latitude']) if row.get('latitude') and row['latitude'] != 'NULL' else None
                lng = float(row['longitude']) if row.get('longitude') and row['longitude'] != 'NULL' else None
                
                priority = row.get('priority') if row.get('priority') and row['priority'] != 'NULL' else 'Low'
                event_cause = row.get('event_cause') if row.get('event_cause') and row['event_cause'] != 'NULL' else 'Unknown'
                zone = row.get('zone') if row.get('zone') and row['zone'] != 'NULL' else 'Unknown Zone'
                
                # Parse dates
                start_dt = None
                if row.get('start_datetime') and row['start_datetime'] != 'NULL':
                    try:
                        start_dt = datetime.fromisoformat(row['start_datetime'].replace('+00', '+00:00'))
                    except Exception:
                        pass
                
                resolved_dt = None
                if row.get('resolved_datetime') and row['resolved_datetime'] != 'NULL':
                    try:
                        resolved_dt = datetime.fromisoformat(row['resolved_datetime'].replace('+00', '+00:00'))
                    except Exception:
                        pass
                        
                # Determine status
                raw_status = row.get('status', '').lower()
                status = IncidentStatus.ACTIVE
                if raw_status in ['closed', 'resolved']:
                    status = IncidentStatus.RESOLVED

                inc = Incident(
                    event_type=row.get('event_type', 'unplanned'),
                    event_cause=event_cause,
                    priority=priority,
                    severity="Critical" if priority == "High" else "Medium",  # Approximate severity for seeding
                    impact_score=85 if priority == "High" else 50,
                    zone=zone,
                    latitude=lat,
                    longitude=lng,
                    requires_road_closure=row.get('requires_road_closure', 'FALSE').upper() == 'TRUE',
                    start_datetime=start_dt,
                    resolved_datetime=resolved_dt,
                    status=status,
                    officers_required=5 if priority == "High" else 2,
                    barricades_required=10 if priority == "High" else 0,
                    ai_explanation=f"Historical incident caused by {event_cause} in {zone}."
                )
                incidents_to_add.append(inc)
                count += 1
                if count > 500: # Limit to 500 for fast seeding
                    break
                    
        db.add_all(incidents_to_add)
        db.commit()
        print(f"Successfully seeded {len(incidents_to_add)} incidents into the database!")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
