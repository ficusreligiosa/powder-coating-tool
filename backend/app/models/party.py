from app import db
from datetime import datetime

class Party(db.Model):
    __tablename__ = 'parties'

    id = db.Column(db.Integer, primary_key=True)
    party_code = db.Column(db.String(50), unique=True, nullable=False)
    party_name = db.Column(db.String(200), nullable=False)
    phone_number = db.Column(db.String(100), nullable=True)
    sales_person_name = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    samples = db.relationship('Sample', backref='party', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'party_code': self.party_code,
            'party_name': self.party_name,
            'phone_number': self.phone_number,
            'sales_person_name': self.sales_person_name,
            'created_at': self.created_at.isoformat()
        }