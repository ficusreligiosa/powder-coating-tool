from app import db

class City(db.Model):
    __tablename__ = 'cities'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    state = db.Column(db.String(100), nullable=True)
    is_moradabad = db.Column(db.Boolean, default=False)

    # Relationship
    samples = db.relationship('Sample', backref='city', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'state': self.state,
            'is_moradabad': self.is_moradabad
        }