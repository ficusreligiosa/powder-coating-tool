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


def get_or_create_city(name):
    if not name or not name.strip():
        return None

    name = name.strip().upper()

    city = City.query.filter_by(name=name).first()

    if not city:
        mbd_names = ['MORADABAD', 'MBD']

        city = City(
            name=name,
            state='',
            is_moradabad=name in mbd_names
        )

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
        return jsonify({
            'message': 'Access denied'
        }), 403

    if 'file' not in request.files:
        return jsonify({
            'message': 'CSV file required'
        }), 400

    file = request.files['file']

    stream = io.StringIO(
        file.stream.read().decode('UTF-8')
    )

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

            sales_person = row.get(
                'SALES PERSON NAME',
                ''
            ).strip()

            if not party_code or not party_name:
                skipped += 1

                errors.append(
                    f"BLANK ROW: code='{party_code}' name='{party_name}'"
                )

                continue

            existing = Party.query.filter_by(
                party_code=party_code
            ).first()

            if existing:
                skipped += 1

                errors.append(
                    f"DUPLICATE: {party_code} - {party_name}"
                )

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

    return jsonify({
        'message': 'Party import complete!',
        'success': success,
        'skipped': skipped,
        'errors': errors
    }), 200


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

    # Pre-load all parties and cities into memory — DB calls minimize honge
    all_parties_by_code = {p.party_code.upper(): p for p in Party.query.all()}
    all_parties_by_name = {p.party_name.upper(): p for p in Party.query.all()}
    all_cities = {c.name.upper(): c for c in City.query.all()}
    all_salespersons = {s.name.upper(): s for s in SalesPerson.query.all()}

    new_cities = {}
    new_salespersons = {}

    rows = list(reader)

    for row in rows:
        try:
            # Entry date
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

            # Order date
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

            # Salesperson — memory se lo
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

            # Party — memory se lo
            party_name = row.get('Party Name', '').strip()
            party_code = row.get('Party Code', '').strip()
            if not party_code:
                party_code = row.get('Party ID', '').strip()

            party = None
            if party_code:
                party = all_parties_by_code.get(party_code.upper())
            if not party and party_name:
                party = all_parties_by_name.get(party_name.upper())

            # City — memory se lo
            station = row.get('Station', '').strip().upper()
            city = all_cities.get(station)
            if not city and station:
                if station not in new_cities:
                    mbd_names = ['MORADABAD', 'MBD']
                    c = City(
                        name=station,
                        state='',
                        is_moradabad=station in mbd_names
                    )
                    db.session.add(c)
                    db.session.flush()
                    new_cities[station] = c
                    all_cities[station] = c
                city = new_cities[station]

            # Sample banao
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

            # Products
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

            # Har 100 rows pe commit karo
            if success % 100 == 0:
                db.session.commit()

        except Exception as e:
            errors.append(f"Row error: {str(e)}")
            db.session.rollback()
            continue

    db.session.commit()

    return jsonify({
        'message': 'Sample import complete!',
        'success': success,
        'skipped': skipped,
        'errors': errors[:10]
    }), 200


# =========================
# IMPORT SALESPERSONS
# =========================

@import_bp.route('/salespersons', methods=['POST'])
@jwt_required()
def import_salespersons():

    claims = get_jwt()

    if claims['role'] != 'admin':
        return jsonify({
            'message': 'Only admin can import'
        }), 403

    if 'file' not in request.files:
        return jsonify({
            'message': 'CSV file required'
        }), 400

    file = request.files['file']

    stream = io.StringIO(
        file.stream.read().decode('UTF-8')
    )

    reader = csv.DictReader(stream)

    success = 0
    skipped = 0

    for row in reader:

        try:
            name = row.get(
                'SALES PERSON NAME',
                ''
            ).strip().upper()

            phone = row.get(
                'PHONE NUMBER',
                ''
            ).strip()

            if not name:
                skipped += 1
                continue

            existing = SalesPerson.query.filter_by(
                name=name
            ).first()

            if existing:
                skipped += 1
                continue

            sp = SalesPerson(
                name=name,
                phone_number=phone
            )

            db.session.add(sp)

            success += 1

        except Exception:
            continue

    db.session.commit()

    return jsonify({
        'message': 'Salesperson import complete!',
        'success': success,
        'skipped': skipped
    }), 200


# =========================
# IMPORT CITIES
# =========================

@import_bp.route('/cities', methods=['POST'])
@jwt_required()
def import_cities():

    claims = get_jwt()

    if claims['role'] != 'admin':
        return jsonify({
            'message': 'Only admin can import'
        }), 403

    if 'file' not in request.files:
        return jsonify({
            'message': 'CSV file required'
        }), 400

    file = request.files['file']

    stream = io.StringIO(
        file.stream.read().decode('UTF-8')
    )

    reader = csv.DictReader(stream)

    success = 0
    skipped = 0

    mbd_names = ['MBD', 'MORADABAD']

    for row in reader:

        try:
            name = row.get(
                'CITY',
                ''
            ).strip().upper()

            state = row.get(
                'STATE',
                ''
            ).strip()

            if not name:
                skipped += 1
                continue

            existing = City.query.filter_by(
                name=name
            ).first()

            if existing:
                skipped += 1
                continue

            city = City(
                name=name,
                state=state,
                is_moradabad=name in mbd_names
            )

            db.session.add(city)

            success += 1

        except Exception:
            continue

    db.session.commit()

    return jsonify({
        'message': 'City import complete!',
        'success': success,
        'skipped': skipped
    }), 200