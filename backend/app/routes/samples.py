from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app import db
from app.models.sample import Sample, SampleProduct, OrderDetail
from app.models.party import Party
from app.models.city import City
from app.models.salesperson import SalesPerson
from datetime import datetime, timedelta

samples_bp = Blueprint('samples', __name__)


def resolve_party_info(sample, role):
    """Role ke basis pe party info return karo"""

    party_name = None
    party_code = None

    if sample.party_id:
        party = db.session.get(Party, sample.party_id)  # FIXED: Party.query.get() deprecated

        if party:
            party_name = party.party_name
            party_code = party.party_code

    # direct/manual party name
    if not party_name and sample.party_name_direct:
        party_name = sample.party_name_direct

    # =========================
    # DISPLAY VALUE
    # =========================

    combined_party = None

    if party_name and party_code:
        combined_party = f"{party_name} ({party_code})"  # e.g. PARTH OVERSEAS (A-746)
    elif party_name:
        combined_party = party_name
    elif party_code:
        combined_party = party_code

    # ROLE BASED RESPONSE

    # DATA ENTRY → ONLY CODE
    if role == 'data_entry':
        return {
            'party_name': None,
            'party_code': party_code or party_name
        }

    # SALESPERSON → ONLY NAME
    elif role == 'salesperson':
        return {
            'party_name': party_name,
            'party_code': None
        }

    # ADMIN + CALCULATION → NAME + CODE (combined), party_code bhi bhejo for fallback
    else:
        return {
            'party_name': combined_party,
            'party_code': party_code  # FIXED: None tha, ab party_code bhejo
        }


@samples_bp.route('/', methods=['GET'])
@jwt_required()
def get_samples():
    claims = get_jwt()
    duration = request.args.get('duration', None)
    location = request.args.get('location', 'all')
    status = request.args.get('status', None)
    created_by = request.args.get('created_by', None)

    query = Sample.query

    # Sirf completed dikhao Karishma ke liye
    if claims['role'] == 'calculation':
        query = query.filter(Sample.status == 'completed')
    elif status:
        query = query.filter(Sample.status == status)

    # Salesperson sirf apni requests dekhe
    if claims['role'] == 'salesperson':
        sp_id = claims.get('salesperson_id')
        if sp_id:
            query = query.filter(Sample.sales_person_id == sp_id)

    # Entry By filter (created_by user ID) — sirf admin/calculation ke liye
    if created_by and claims['role'] in ['admin', 'calculation']:
        query = query.filter(Sample.created_by == int(created_by))

    if duration:
        months = int(duration)
        start_date = datetime.utcnow() - timedelta(days=30 * months)
        query = query.filter(Sample.order_received_date >= start_date)

    if location == 'mbd':
        query = query.join(City).filter(City.is_moradabad == True)
    elif location == 'rest':
        query = query.join(City).filter(City.is_moradabad == False)

    samples = query.order_by(Sample.order_received_date.desc()).all()

    result = []
    for s in samples:
        sample_dict = s.to_dict()
        party_info = resolve_party_info(s, claims['role'])
        sample_dict.update(party_info)

        if s.city_id:
            city = City.query.get(s.city_id)
            sample_dict['city_name'] = city.name if city else '—'
        else:
            sample_dict['city_name'] = '—'

        sample_dict['created_by'] = s.created_by

        result.append(sample_dict)

    return jsonify(result), 200


@samples_bp.route('/pending', methods=['GET'])
@jwt_required()
def get_pending():
    claims = get_jwt()
    if claims['role'] not in ['data_entry', 'admin']:
        return jsonify({'message': 'Access nahi hai'}), 403

    samples = Sample.query.filter_by(
        status='pending'
    ).order_by(Sample.order_received_date.asc()).all()

    result = []
    for s in samples:
        sample_dict = s.to_dict()
        party_info = resolve_party_info(s, claims['role'])
        sample_dict.update(party_info)

        if s.city_id:
            city = City.query.get(s.city_id)
            sample_dict['city_name'] = city.name if city else '—'
        else:
            sample_dict['city_name'] = '—'

        sample_dict['created_by'] = s.created_by

        result.append(sample_dict)

    return jsonify(result), 200


@samples_bp.route('/<int:sample_id>/complete', methods=['PUT'])
@jwt_required()
def mark_complete(sample_id):
    claims = get_jwt()
    if claims['role'] not in ['data_entry', 'admin']:
        return jsonify({'message': 'Access nahi hai'}), 403

    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()

    sample.status = 'completed'
    sample.completed_at = datetime.utcnow()
    if data.get('shushil_remark'):
        sample.shushil_remark = data['shushil_remark']

    db.session.commit()
    return jsonify(sample.to_dict()), 200


@samples_bp.route('/<int:sample_id>', methods=['GET'])
@jwt_required()
def get_sample(sample_id):
    claims = get_jwt()
    sample = Sample.query.get_or_404(sample_id)
    sample_dict = sample.to_dict()

    party_info = resolve_party_info(sample, claims['role'])
    sample_dict.update(party_info)

    if sample.city_id:
        city = City.query.get(sample.city_id)
        sample_dict['city_name'] = city.name if city else '—'
    else:
        sample_dict['city_name'] = '—'

    sample_dict['created_by'] = sample.created_by

    return jsonify(sample_dict), 200


@samples_bp.route('/', methods=['POST'])
@jwt_required()
def add_sample():
    claims = get_jwt()
    user_id = get_jwt_identity()

    if claims['role'] not in ['data_entry', 'admin', 'salesperson']:
        return jsonify({'message': 'Access nahi hai'}), 403

    data = request.get_json()

    if claims['role'] == 'salesperson':
        sp_id = claims.get('salesperson_id')
        if not sp_id:
            return jsonify({'message': 'Salesperson account properly linked nahi hai, admin se contact karo'}), 400
        data['sales_person_id'] = sp_id
    elif not data.get('sales_person_id'):
        return jsonify({'message': 'Sales person select karo'}), 400

    if not data.get('products') or len(data['products']) == 0:
        return jsonify({'message': 'Kam se kam ek product chahiye'}), 400

    salesperson = SalesPerson.query.get(data['sales_person_id'])
    if not salesperson:
        return jsonify({'message': 'Salesperson exist nahi karta'}), 404

    party_id = None
    party_name_direct = None

    if data.get('party_id'):
        party_id = data['party_id']
    elif data.get('party_name_direct'):
        party_name_direct = data['party_name_direct'].strip()
    else:
        return jsonify({'message': 'Party select karo ya party name daalo'}), 400

    city_id = None
    if data.get('city_id'):
        city_id = data['city_id']

    sample = Sample(
        sales_person_id=salesperson.id,
        party_id=party_id,
        party_name_direct=party_name_direct,
        city_id=city_id,
        order_received_date=datetime.utcnow(),
        status='pending',
        salesperson_remark=data.get('salesperson_remark', ''),
        created_by=int(user_id)
    )
    db.session.add(sample)
    db.session.flush()

    for p in data['products']:
        if not p.get('product_name') or not p.get('quantity'):
            return jsonify({'message': 'Product name aur quantity dono chahiye'}), 400

        product = SampleProduct(
            sample_id=sample.id,
            product_name=p['product_name'].strip(),
            quantity=p['quantity'].strip(),
            matched_with=p.get('matched_with', '').strip()
        )
        db.session.add(product)

    db.session.commit()
    return jsonify(sample.to_dict()), 201


@samples_bp.route('/<int:sample_id>', methods=['DELETE'])
@jwt_required()
def delete_sample(sample_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin delete kar sakta hai'}), 403

    sample = Sample.query.get_or_404(sample_id)
    db.session.delete(sample)
    db.session.commit()
    return jsonify({'message': 'Sample delete ho gaya'}), 200