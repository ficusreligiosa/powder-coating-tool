from app import create_app, db
from app.models.user import User
from app.models.salesperson import SalesPerson
from werkzeug.security import generate_password_hash

app = create_app()

salespersons = [
    ('YAHIYA KHAN', 'yahiya'),
    ('RISHI KUMAR', 'rishi'),
    ('UMANG SHRIVASTAVA', 'umang'),
    ('BABLU SINGH', 'bablu'),
    ('KARUNESH MISHRA', 'karunesh'),
    ('SACHIN YADAV', 'sachin'),
    ('AJAY GUPTA', 'ajay'),
    ('SHIVSHAKTI TRIPATHI', 'shivshakti'),
    ('KUSH KUSHWAHA', 'kush'),
    ('AZEEM AHMAD', 'azeem'),
    ('PRADEEP KUMAR PANDEY', 'pradeep'),
    ('ANOOP KUMAR', 'anoop'),
    ('SANJAY YADAV', 'sanjay'),
    ('AQIB ISLAM', 'aqib'),
    ('AROON KUMAR SINGH', 'aroon'),
    ('DOORDARSHI DIXIT', 'doordarshi'),
]

with app.app_context():
    for full_name, username in salespersons:
        # Salesperson record check/create
        sp = SalesPerson.query.filter_by(name=full_name).first()
        if not sp:
            sp = SalesPerson(name=full_name)
            db.session.add(sp)
            db.session.flush()
            print(f"✅ Salesperson created: {full_name}")
        else:
            print(f"ℹ️ Salesperson exists: {full_name}")

        # User check/create
        existing = User.query.filter_by(username=username).first()
        if not existing:
            user = User(
                username=username,
                password_hash=generate_password_hash(f"{username}@321"),
                full_name=full_name,
                role='salesperson',
                is_active=True,
                salesperson_id=sp.id
            )
            db.session.add(user)
            print(f"✅ User created: {username} / {username}@321")
        else:
            print(f"ℹ️ User exists: {username}")

    db.session.commit()
    print("\n🎉 Done!")