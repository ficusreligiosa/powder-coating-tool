import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app import db
from app.models.sample import Sample, SampleProduct, OrderDetail
from app.models.party import Party
from app.models.city import City
from app.models.salesperson import SalesPerson
from datetime import datetime, timedelta
from sqlalchemy.orm import joinedload

samples_bp = Blueprint('samples', __name__)


def resolve_party_info(sample, role, parties_cache=None, parties_by_code=None):
    party_name = None
    party_code = None

    if sample.party_id:
        if parties_cache and sample.party_id in parties_cache:
            party = parties_cache[sample.party_id]
        else:
            party = db.session.get(Party, sample.party_id)
        if party:
            party_name = party.party_name
            party_code = party.party_code

    # party_name_direct check — agar A-XXXX pattern hai toh cache se match karo
    if not party_name and sample.party_name_direct:
        raw = sample.party_name_direct.strip()
        if re.match(r'^A-\d+$', raw, re.IGNORECASE):
            party = (parties_by_code or {}).get(raw.upper())
            if party:
                party_name = party.party_name
                party_code = party.party_code
            else:
                party_code = raw
        else:
            party_name = raw

    if role == 'data_entry':
        return {'party_name': None, 'party_code': party_code or party_name}
    elif role == 'salesperson':
        return {'party_name': party_name, 'party_code': None}
    else:
        combined = None
        if party_name and party_code:
            combined = f"{party_name} ({party_code})"
        elif party_name:
            combined = party_name
        elif party_code:
            combined = party_code
        return {'party_name': combined, 'party_code': party_code}


def build_parties_by_code(samples):
    """Unlinked samples ke A-XXXX party_name_direct ke liye bulk cache"""
    direct_codes = [
        s.party_name_direct.strip().upper()
        for s in samples
        if not s.party_id and s.party_name_direct
        and re.match(r'^A-\d+$', s.party_name_direct.strip(), re.IGNORECASE)
    ]
    if not direct_codes:
        return {}
    code_parties = Party.query.filter(
        db.func.upper(Party.party_code).in_(direct_codes)
    ).all()
    return {p.party_code.strip().upper(): p for p in code_parties}


@samples_bp.route('/', methods=['GET'])
@jwt_required()
def get_samples():
    claims = get_jwt()
    duration = request.args.get('duration', None)
    location = request.args.get('location', 'all')
    status = request.args.get('status', None)
    created_by = request.args.get('created_by', None)

    query = Sample.query.options(
        joinedload(Sample.salesperson),
        joinedload(Sample.products),
        joinedload(Sample.city)
    )

    if claims['role'] == 'calculation':
        query = query.filter(Sample.status == 'completed')
    elif status:
        query = query.filter(Sample.status == status)

    if claims['role'] == 'salesperson':
        sp_id = claims.get('salesperson_id')
        if sp_id:
            query = query.filter(Sample.sales_person_id == sp_id)

    if created_by and claims['role'] in ['admin', 'calculation']:
        query = query.filter(Sample.created_by == int(created_by))

    if duration:
        months = int(duration)
        start_date = datetime.utcnow() - timedelta(days=30 * months)
        query = query.filter(Sample.order_received_date >= start_date)

    if location == 'mbd':
        query = query.join(City, Sample.city_id == City.id).filter(City.is_moradabad == True)
    elif location == 'rest':
        query = query.join(City, Sample.city_id == City.id).filter(City.is_moradabad == False)

    samples = query.order_by(Sample.order_received_date.desc()).all()

    # Bulk caches — sirf 2 DB calls
    party_ids = [s.party_id for s in samples if s.party_id]
    parties = {p.id: p for p in Party.query.filter(Party.id.in_(party_ids)).all()} if party_ids else {}
    parties_by_code = build_parties_by_code(samples)

    result = []
    for s in samples:
        sample_dict = s.to_dict()
        party_info = resolve_party_info(s, claims['role'], parties, parties_by_code)
        sample_dict.update(party_info)
        sample_dict['city_name'] = s.city.name if s.city else '—'
        sample_dict['created_by'] = s.created_by
        result.append(sample_dict)

    return jsonify(result), 200


@samples_bp.route('/pending', methods=['GET'])
@jwt_required()
def get_pending():
    claims = get_jwt()
    if claims['role'] not in ['data_entry', 'admin']:
        return jsonify({'message': 'Access nahi hai'}), 403

    samples = Sample.query.options(
        joinedload(Sample.salesperson),
        joinedload(Sample.products),
        joinedload(Sample.city)
    ).filter_by(status='pending').order_by(Sample.order_received_date.asc()).all()

    party_ids = [s.party_id for s in samples if s.party_id]
    parties = {p.id: p for p in Party.query.filter(Party.id.in_(party_ids)).all()} if party_ids else {}
    parties_by_code = build_parties_by_code(samples)

    result = []
    for s in samples:
        sample_dict = s.to_dict()
        party_info = resolve_party_info(s, claims['role'], parties, parties_by_code)
        sample_dict.update(party_info)
        sample_dict['city_name'] = s.city.name if s.city else '—'
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
    sample = Sample.query.options(
        joinedload(Sample.salesperson),
        joinedload(Sample.products)
    ).get_or_404(sample_id)

    sample_dict = sample.to_dict()

    parties = {sample.party_id: db.session.get(Party, sample.party_id)} if sample.party_id else {}
    parties_by_code = build_parties_by_code([sample])
    party_info = resolve_party_info(sample, claims['role'], parties, parties_by_code)
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