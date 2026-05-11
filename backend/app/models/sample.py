from app import db
from datetime import datetime

class Sample(db.Model):
    __tablename__ = 'samples'

    id = db.Column(db.Integer, primary_key=True)
    sales_person_id = db.Column(db.Integer, db.ForeignKey('salespersons.id'), nullable=True)
    sales_person_name = db.Column(db.String(120), nullable=True)
    party_id = db.Column(db.Integer, db.ForeignKey('parties.id'), nullable=True)
    party_name_direct = db.Column(db.String(200), nullable=True)
    city_id = db.Column(db.Integer, db.ForeignKey('cities.id'), nullable=True)
    order_received_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')
    completed_at = db.Column(db.DateTime, nullable=True)
    salesperson_remark = db.Column(db.Text, nullable=True)
    shushil_remark = db.Column(db.Text, nullable=True)
    entry_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Relationships
    products = db.relationship('SampleProduct', backref='sample',
                                lazy=True, cascade='all, delete-orphan')
    salesperson = db.relationship('SalesPerson', backref='samples', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'sales_person_id': self.sales_person_id,
            'sales_person_name': self.salesperson.name if self.salesperson else self.sales_person_name,
            'party_id': self.party_id,
            'party_name_direct': self.party_name_direct,
            'city_id': self.city_id,
            'order_received_date': self.order_received_date.isoformat() if self.order_received_date else None,
            'status': self.status,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'salesperson_remark': self.salesperson_remark,
            'shushil_remark': self.shushil_remark,
            'entry_date': self.entry_date.isoformat() if self.entry_date else None,
            'products': [p.to_dict() for p in self.products]
        }


class SampleProduct(db.Model):
    __tablename__ = 'sample_products'

    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.Integer, db.ForeignKey('samples.id'), nullable=False)
    product_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.String(100), nullable=False)
    matched_with = db.Column(db.String(200), nullable=True)

    order_detail = db.relationship('OrderDetail', backref='sample_product',
                                    lazy=True, uselist=False,
                                    cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'sample_id': self.sample_id,
            'product_name': self.product_name,
            'quantity': self.quantity,
            'matched_with': self.matched_with,
            'order_detail': self.order_detail.to_dict() if self.order_detail else None
        }


class OrderDetail(db.Model):
    __tablename__ = 'order_details'

    id = db.Column(db.Integer, primary_key=True)
    sample_product_id = db.Column(db.Integer, db.ForeignKey('sample_products.id'),
                                   nullable=False)
    order_yes_no = db.Column(db.Boolean, default=False)
    quantity_kg = db.Column(db.Float, default=0.0)
    total_order_qty = db.Column(db.Float, default=0.0)
    filled_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    filled_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'sample_product_id': self.sample_product_id,
            'order_yes_no': self.order_yes_no,
            'quantity_kg': self.quantity_kg,
            'total_order_qty': self.total_order_qty,
            'filled_by': self.filled_by,
            'filled_at': self.filled_at.isoformat() if self.filled_at else None,
            'notes': self.notes
        }