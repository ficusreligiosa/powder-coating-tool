from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app import db
from app.models.salesperson import SalesPerson

salespersons_bp = Blueprint('salespersons', __name__)


@salespersons_bp.route('/', methods=['GET'])
@jwt_required()
def get_salespersons():
    salespersons = SalesPerson.query.filter_by(
        is_active=True
    ).order_by(SalesPerson.name).all()
    return jsonify([s.to_dict() for s in salespersons]), 200


@salespersons_bp.route('/search', methods=['GET'])
@jwt_required()
def search_salespersons():
    query = request.args.get('q', '')
    salespersons = SalesPerson.query.filter(
        SalesPerson.name.ilike(f'%{query}%'),
        SalesPerson.is_active == True
    ).order_by(SalesPerson.name).all()
    return jsonify([s.to_dict() for s in salespersons]), 200


@salespersons_bp.route('/', methods=['POST'])
@jwt_required()
def add_salesperson():
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin salesperson add kar sakta hai'}), 403

    data = request.get_json()
    if not data.get('name'):
        return jsonify({'message': 'Salesperson name chahiye'}), 400

    existing = SalesPerson.query.filter_by(
        name=data['name'].upper().strip()
    ).first()
    if existing:
        return jsonify({'message': 'Yeh salesperson already exist karta hai'}), 409

    salesperson = SalesPerson(
        name=data['name'].upper().strip(),
        phone_number=data.get('phone_number', '').strip()
    )
    db.session.add(salesperson)
    db.session.commit()
    return jsonify(salesperson.to_dict()), 201


@salespersons_bp.route('/<int:salesperson_id>', methods=['PUT'])
@jwt_required()
def update_salesperson(salesperson_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin update kar sakta hai'}), 403

    salesperson = SalesPerson.query.get_or_404(salesperson_id)
    data = request.get_json()

    if data.get('name'):
        salesperson.name = data['name'].upper().strip()
    if data.get('phone_number'):
        salesperson.phone_number = data['phone_number'].strip()
    if 'is_active' in data:
        salesperson.is_active = data['is_active']

    db.session.commit()
    return jsonify(salesperson.to_dict()), 200


@salespersons_bp.route('/<int:salesperson_id>', methods=['DELETE'])
@jwt_required()
def delete_salesperson(salesperson_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin delete kar sakta hai'}), 403

    salesperson = SalesPerson.query.get_or_404(salesperson_id)
    # Hard delete nahi, sirf inactive karo
    salesperson.is_active = False
    db.session.commit()
    return jsonify({'message': 'Salesperson inactive ho gaya'}), 200