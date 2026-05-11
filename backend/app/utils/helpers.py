from werkzeug.security import generate_password_hash
from app import db
from app.models.user import User
from app.models.city import City

def create_admin_user():
    """First time admin user banane ke liye"""
    existing = User.query.filter_by(username='admin').first()
    if not existing:
        admin = User(
            username='admin',
            password_hash=generate_password_hash('admin123'),
            full_name='Administrator',
            role='admin',
            is_active=True
        )
        db.session.add(admin)
        db.session.commit()
        print("✅ Admin user ban gaya! Username: admin, Password: admin123")
    else:
        print("ℹ️ Admin user already exist karta hai")


def seed_moradabad_cities():
    """MBD related cities seed karne ke liye"""
    mbd_names = ['MBD', 'MORADABAD']
    for name in mbd_names:
        existing = City.query.filter_by(name=name).first()
        if not existing:
            city = City(
                name=name,
                state='Uttar Pradesh',
                is_moradabad=True
            )
            db.session.add(city)
    db.session.commit()
    print("✅ Moradabad cities seed ho gayi!")