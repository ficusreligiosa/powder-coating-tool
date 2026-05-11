from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app import db
from app.models.party import Party

parties_bp = Blueprint('parties', __name__)


def generate_party_code():
    """Auto generate next party code like A-3129"""
    last_party = Party.query.order_by(Party.id.desc()).first()
    if not last_party:
        return 'A-101'
    last_number = int(last_party.party_code.split('-')[1])
    return f'A-{last_number + 1}'


@parties_bp.route('/', methods=['GET'])
@jwt_required()
def get_parties():
    parties = Party.query.order_by(Party.party_name).all()
    return jsonify([p.to_dict() for p in parties]), 200


@parties_bp.route('/search', methods=['GET'])
@jwt_required()
def search_parties():
    query = request.args.get('q', '')
    parties = Party.query.filter(
        Party.party_code.ilike(f'%{query}%') |
        Party.party_name.ilike(f'%{query}%')
    ).order_by(Party.party_name).all()
    return jsonify([p.to_dict() for p in parties]), 200


@parties_bp.route('/', methods=['POST'])
@jwt_required()
def add_party():
    claims = get_jwt()
    if claims['role'] not in ['admin', 'salesperson', 'data_entry']:
         return jsonify({'message': 'Access nahi hai'}), 403

    data = request.get_json()
    if not data.get('party_name'):
        return jsonify({'message': 'Party name chahiye'}), 400

    party_code = generate_party_code()

    party = Party(
        party_code=party_code,
        party_name=data['party_name'].strip(),
        phone_number=data.get('phone_number', '').strip(),
        sales_person_name=data.get('sales_person_name', '').strip()
    )
    db.session.add(party)
    db.session.commit()
    return jsonify(party.to_dict()), 201


@parties_bp.route('/<int:party_id>', methods=['PUT'])
@jwt_required()
def update_party(party_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin party update kar sakta hai'}), 403

    party = Party.query.get_or_404(party_id)
    data = request.get_json()

    if data.get('party_name'):
        party.party_name = data['party_name'].strip()
    if data.get('phone_number'):
        party.phone_number = data['phone_number'].strip()
    if data.get('sales_person_name'):
        party.sales_person_name = data['sales_person_name'].strip()

    db.session.commit()
    return jsonify(party.to_dict()), 200


@parties_bp.route('/<int:party_id>', methods=['DELETE'])
@jwt_required()
def delete_party(party_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin party delete kar sakta hai'}), 403

    party = Party.query.get_or_404(party_id)
    db.session.delete(party)
    db.session.commit()
    return jsonify({'message': 'Party delete ho gayi'}), 200