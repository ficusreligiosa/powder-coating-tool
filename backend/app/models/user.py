from app import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    # Roles: 'data_entry', 'calculation', 'admin', 'salesperson'
    salesperson_id = db.Column(db.Integer, db.ForeignKey('salespersons.id'), nullable=True)
    # Sirf salesperson role ke liye — us user ka salespersons table mein ID
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'full_name': self.full_name,
            'role': self.role,
            'salesperson_id': self.salesperson_id,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }