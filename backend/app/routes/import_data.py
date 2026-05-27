from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app import db
from app.models.party import Party
from app.models.salesperson import SalesPerson
from app.models.city import City
from app.models.sample import Sample, SampleProduct

import csv
import io

from datetime import datetime

import_bp = Blueprint('import_data', __name__)
import re

def parse_quantity_to_grams(qty_str):
    if not qty_str:
        return 0
    qty_str = qty_str.strip().upper()
    cross_match = re.match(r'(\d+\.?\d*)\s*[Xx×]\s*(\d+\.?\d*)', qty_str)
    if cross_match:
        count = float(cross_match.group(1))
        unit_qty = float(cross_match.group(2))
        if count > unit_qty:
            count, unit_qty = unit_qty, count
        return count * unit_qty
    num_match = re.search(r'(\d+\.?\d*)', qty_str)
    if not num_match:
        return 0
    value = float(num_match.group(1))
    if 'KG' in qty_str:
        return value * 1000
    elif 'GM' in qty_str or 'GRM' in qty_str or 'GRAM' in qty_str:
        return value
    else:
        return value


def parse_tally_qty(qty_str):
    if not qty_str:
        return 0
    qty_str = qty_str.strip().upper()
    num_match = re.search(r'(\d+\.?\d*)', qty_str)
    if not num_match:
        return 0
    value = float(num_match.group(1))
    if 'KG' in qty_str:
        return value * 1000
    return value


def normalize_party_name(name):
    if not name:
        return ''
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip().lower()


def find_party_by_name(party_name):
    if not party_name:
        return None
    party = Party.query.filter(Party.party_name.ilike(party_name)).first()
    if party:
        return party
    normalized_input = normalize_party_name(party_name)
    all_parties = Party.query.all()
    for p in all_parties:
        if normalize_party_name(p.party_name) == normalized_input:
            return p
    party = Party.query.filter(Party.party_name.ilike(f'%{party_name}%')).first()
    return party


def get_or_create_city(name):
    if not name or not name.strip():
        return None
    name = name.strip().upper()
    city = City.query.filter_by(name=name).first()
    if not city:
        mbd_names = ['MORADABAD', 'MBD']
        city = City(name=name, state='', is_moradabad=name in mbd_names)
        db.session.add(city)
        db.session.flush()
    return city


def get_or_create_salesperson(name):
    if not name or not name.strip():
        return None
    name = name.strip().upper()
    sp = SalesPerson.query.filter_by(name=name).first()
    if not sp:
        sp = SalesPerson(name=name)
        db.session.add(sp)
        db.session.flush()
    return sp


# =========================
# IMPORT PARTIES
# =========================

@import_bp.route('/parties', methods=['POST'])
@jwt_required()
def import_parties():
    claims = get_jwt()
    if claims['role'] not in ['admin', 'calculation']:
        return jsonify({'message': 'Access denied'}), 403
    if 'file' not in request.files:
        return jsonify({'message': 'CSV file required'}), 400

    file = request.files['file']
    stream = io.StringIO(file.stream.read().decode('UTF-8'))
    reader = csv.DictReader(stream)

    success = 0
    skipped = 0
    errors = []

    for row in reader:
        try:
            party_code = row.get('UNIQUE ID', '').strip()
            party_name = row.get('PARTY NAME', '').strip()
            phone = row.get('PHONE NUMBER', '').strip()
            station = row.get('STATION', '').strip()
            sales_person = row.get('SALES PERSON NAME', '').strip()

            if not party_code or not party_name:
                skipped += 1
                errors.append(f"BLANK ROW: code='{party_code}' name='{party_name}'")
                continue

            existing = Party.query.filter_by(party_code=party_code).first()
            if existing:
                skipped += 1
                errors.append(f"DUPLICATE: {party_code} - {party_name}")
                continue

            party = Party(
                party_code=party_code,
                party_name=party_name,
                phone_number=phone,
                sales_person_name=sales_person
            )
            db.session.add(party)
            success += 1

        except Exception as e:
            errors.append(str(e))
            continue

    db.session.commit()
    return jsonify({'message': 'Party import complete!', 'success': success, 'skipped': skipped, 'errors': errors}), 200


# =========================
# IMPORT SAMPLES
# =========================

@import_bp.route('/samples', methods=['POST'])
@jwt_required()
def import_samples():
    claims = get_jwt()
    if claims['role'] not in ['admin', 'calculation']:
        return jsonify({'message': 'Access denied'}), 403
    if 'file' not in request.files:
        return jsonify({'message': 'CSV file required'}), 400

    created_by_raw = request.form.get('created_by')
    created_by = int(created_by_raw) if created_by_raw and created_by_raw.isdigit() else None

    file = request.files['file']
    stream = io.StringIO(file.stream.read().decode('UTF-8'))
    reader = csv.DictReader(stream)

    success = 0
    skipped = 0
    errors = []

    all_parties_by_code = {p.party_code.upper(): p for p in Party.query.all()}
    all_parties_by_name = {p.party_name.upper(): p for p in Party.query.all()}
    all_cities = {c.name.upper(): c for c in City.query.all()}
    all_salespersons = {s.name.upper(): s for s in SalesPerson.query.all()}

    new_cities = {}
    new_salespersons = {}
    rows = list(reader)

    for row in rows:
        try:
            timestamp_str = row.get('Timestamp', '').strip()
            if not timestamp_str:
                skipped += 1
                continue

            try:
                entry_date = datetime.strptime(timestamp_str, '%m/%d/%Y %H:%M:%S')
            except:
                try:
                    entry_date = datetime.strptime(timestamp_str, '%d/%m/%Y %H:%M:%S')
                except:
                    entry_date = datetime.utcnow()

            order_date_str = row.get('Order Recieved Date', '').strip()
            if not order_date_str:
                order_date_str = row.get('Order Received Date', '').strip()
            try:
                order_date = datetime.strptime(order_date_str, '%m/%d/%Y')
            except:
                try:
                    order_date = datetime.strptime(order_date_str, '%d/%m/%Y')
                except:
                    order_date = entry_date

            sp_name = row.get('Sales Person Name', '').strip().upper()
            salesperson = all_salespersons.get(sp_name)
            if not salesperson and sp_name:
                if sp_name not in new_salespersons:
                    sp = SalesPerson(name=sp_name)
                    db.session.add(sp)
                    db.session.flush()
                    new_salespersons[sp_name] = sp
                    all_salespersons[sp_name] = sp
                salesperson = new_salespersons[sp_name]

            party_name = row.get('Party Name', '').strip()
            party_code = row.get('Party Code', '').strip()
            if not party_code:
                party_code = row.get('Party ID', '').strip()

            party = None
            if party_code:
                party = all_parties_by_code.get(party_code.upper())
            if not party and party_name:
                party = all_parties_by_name.get(party_name.upper())

            station = row.get('Station', '').strip().upper()
            city = all_cities.get(station)
            if not city and station:
                if station not in new_cities:
                    mbd_names = ['MORADABAD', 'MBD']
                    c = City(name=station, state='', is_moradabad=station in mbd_names)
                    db.session.add(c)
                    db.session.flush()
                    new_cities[station] = c
                    all_cities[station] = c
                city = new_cities[station]

            sample = Sample(
                sales_person_id=salesperson.id if salesperson else None,
                party_id=party.id if party else None,
                party_name_direct=(party_name or party_code) if not party else None,
                city_id=city.id if city else None,
                order_received_date=order_date,
                entry_date=entry_date,
                status='completed',
                completed_at=entry_date,
                created_by=created_by
            )
            db.session.add(sample)
            db.session.flush()

            for i in range(1, 9):
                product_name = row.get(f'Product Name {i}', '').strip()
                if not product_name:
                    product_name = row.get(f'Product Name{i}', '').strip()
                if not product_name:
                    continue

                qty = row.get(f'Product {i} Qty', '').strip()
                if not qty:
                    qty = row.get(f'Product{i} Qty', '').strip()

                matched = row.get(f'Matched With {i}', '').strip()
                if not matched:
                    matched = row.get(f'Matched With{i}', '').strip()
                if not matched and i == 1:
                    matched = row.get('Matched With', '').strip()

                product = SampleProduct(
                    sample_id=sample.id,
                    product_name=product_name,
                    quantity=qty or '',
                    matched_with=matched
                )
                db.session.add(product)

            success += 1
            if success % 100 == 0:
                db.session.commit()

        except Exception as e:
            errors.append(f"Row error: {str(e)}")
            db.session.rollback()
            continue

    db.session.commit()
    return jsonify({'message': 'Sample import complete!', 'success': success, 'skipped': skipped, 'errors': errors[:10]}), 200


# =========================
# IMPORT SALESPERSONS
# =========================

@import_bp.route('/salespersons', methods=['POST'])
@jwt_required()
def import_salespersons():
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Only admin can import'}), 403
    if 'file' not in request.files:
        return jsonify({'message': 'CSV file required'}), 400

    file = request.files['file']
    stream = io.StringIO(file.stream.read().decode('UTF-8'))
    reader = csv.DictReader(stream)

    success = 0
    skipped = 0

    for row in reader:
        try:
            name = row.get('SALES PERSON NAME', '').strip().upper()
            phone = row.get('PHONE NUMBER', '').strip()
            if not name:
                skipped += 1
                continue
            existing = SalesPerson.query.filter_by(name=name).first()
            if existing:
                skipped += 1
                continue
            sp = SalesPerson(name=name, phone_number=phone)
            db.session.add(sp)
            success += 1
        except Exception:
            continue

    db.session.commit()
    return jsonify({'message': 'Salesperson import complete!', 'success': success, 'skipped': skipped}), 200


# =========================
# IMPORT CITIES
# =========================

@import_bp.route('/cities', methods=['POST'])
@jwt_required()
def import_cities():
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Only admin can import'}), 403
    if 'file' not in request.files:
        return jsonify({'message': 'CSV file required'}), 400

    file = request.files['file']
    stream = io.StringIO(file.stream.read().decode('UTF-8'))
    reader = csv.DictReader(stream)

    success = 0
    skipped = 0
    mbd_names = ['MBD', 'MORADABAD']

    for row in reader:
        try:
            name = row.get('CITY', '').strip().upper()
            state = row.get('STATE', '').strip()
            if not name:
                skipped += 1
                continue
            existing = City.query.filter_by(name=name).first()
            if existing:
                skipped += 1
                continue
            city = City(name=name, state=state, is_moradabad=name in mbd_names)
            db.session.add(city)
            success += 1
        except Exception:
            continue

    db.session.commit()
    return jsonify({'message': 'City import complete!', 'success': success, 'skipped': skipped}), 200


# =========================
# IMPORT TALLY
# =========================

@import_bp.route('/tally', methods=['POST'])
@jwt_required()
def import_tally():
    claims = get_jwt()
    if claims['role'] not in ['admin', 'calculation']:
        return jsonify({'message': 'Access denied'}), 403
    if 'file' not in request.files:
        return jsonify({'message': 'CSV file required'}), 400

    file = request.files['file']
    stream = io.StringIO(file.stream.read().decode('UTF-8'))
    lines = stream.readlines()

    # Party name + date range extract karo
    party_name = ''
    date_range = ''

    for i, line in enumerate(lines):
        line_stripped = line.strip().strip('"').strip(',')
        if i == 9:
            party_name = line_stripped.split(',')[0].strip().strip('"')
        if i == 11:
            date_range = line_stripped.split(',')[0].strip().strip('"')

    if not party_name:
        return jsonify({'message': 'Party name nahi mila CSV mein'}), 400

    # Date range parse karo
    start_date = None
    end_date = None
    try:
        parts = date_range.split(' to ')
        if len(parts) == 2:
            start_date = datetime.strptime(parts[0].strip(), '%d-%b-%y')
            end_date = datetime.strptime(parts[1].strip(), '%d-%b-%y')
    except:
        pass

    # Party dhundho
    party = find_party_by_name(party_name)
    if not party:
        return jsonify({
            'message': f'Party "{party_name}" DB mein nahi mili',
            'hint': 'Party name spelling ya punctuation check karo'
        }), 404

    # Grand Total qty nikalo
    tally_total_grams = 0
    for line in lines:
        if 'Grand Total' in line or 'GRAND TOTAL' in line:
            cols = line.strip().split(',')
            for col in cols:
                if 'kg' in col.lower() or 'gm' in col.lower():
                    tally_total_grams = parse_tally_qty(col)
                    break
            break

    # Samples dhundho — pehle party_id se, date filter ke saath
    samples = Sample.query.filter(Sample.party_id == party.id).all()

    # Agar party_id se nahi mile — party_name_direct se try karo
    if not samples:
        samples = Sample.query.filter(
            Sample.party_name_direct.ilike(f'%{party_name}%')
        ).all()

    # Ab date filter apply karo agar dates hain
    if samples and start_date and end_date:
        samples = [
            s for s in samples
            if s.order_received_date and start_date <= s.order_received_date <= end_date
        ]

    if not samples:
        return jsonify({
            'message': f'Party "{party.party_name}" ke koi samples nahi mile',
            'party_found': party.party_name,
            'date_range': date_range,
            'hint': 'Samples import kiye hain is party ke? Date range check karo.'
        }), 404

    # Sample qty calculate karo
    total_sample_grams = 0
    for sample in samples:
        for product in sample.products:
            total_sample_grams += parse_quantity_to_grams(product.quantity)

    # Net order
    net_order_grams = max(0, tally_total_grams - total_sample_grams)
    net_order_kg = round(net_order_grams / 1000, 2)
    order_yes = net_order_grams > 0

    # Order details update karo
    updated = 0
    for sample in samples:
        for product in sample.products:
            from app.models.sample import OrderDetail
            order = product.order_detail
            if not order:
                order = OrderDetail(sample_product_id=product.id)
                db.session.add(order)
            order.order_yes_no = order_yes
            order.quantity_kg = net_order_kg if order_yes else 0.0
            order.total_order_qty = net_order_kg if order_yes else 0.0
            updated += 1

    db.session.commit()

    return jsonify({
        'message': 'Tally import successful!',
        'party': party.party_name,
        'party_code': party.party_code,
        'date_range': date_range,
        'tally_total_kg': round(tally_total_grams / 1000, 2),
        'sample_qty_kg': round(total_sample_grams / 1000, 2),
        'net_order_kg': net_order_kg,
        'order_yes': order_yes,
        'samples_updated': len(samples),
        'products_updated': updated
    }), 200