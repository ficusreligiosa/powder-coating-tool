from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from werkzeug.security import generate_password_hash
from app import db
from app.models.user import User
from app.models.salesperson import SalesPerson

users_bp = Blueprint('users', __name__)


@users_bp.route('/', methods=['GET'])
@jwt_required()
def get_users():
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin dekh sakta hai'}), 403

    users = User.query.order_by(User.full_name).all()
    return jsonify([u.to_dict() for u in users]), 200


@users_bp.route('/', methods=['POST'])
@jwt_required()
def add_user():
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin user add kar sakta hai'}), 403

    data = request.get_json()

    if not data.get('username'):
        return jsonify({'message': 'Username chahiye'}), 400
    if not data.get('password'):
        return jsonify({'message': 'Password chahiye'}), 400
    if not data.get('full_name'):
        return jsonify({'message': 'Full name chahiye'}), 400
    if not data.get('role'):
        return jsonify({'message': 'Role chahiye'}), 400

    valid_roles = ['data_entry', 'calculation', 'admin', 'salesperson']
    if data['role'] not in valid_roles:
        return jsonify({'message': f'Role valid nahi hai. Valid roles: {valid_roles}'}), 400

    existing = User.query.filter_by(username=data['username']).first()
    if existing:
        return jsonify({'message': 'Yeh username already exist karta hai'}), 409

    salesperson_id = None

    # Salesperson role ke liye automatically salesperson record banao
    if data['role'] == 'salesperson':
        # Check karo already exist karta hai kya same name se
        existing_sp = SalesPerson.query.filter_by(
            name=data['full_name'].upper().strip()
        ).first()
        if existing_sp:
            salesperson_id = existing_sp.id
        else:
            sp = SalesPerson(
                name=data['full_name'].upper().strip(),
                phone_number=data.get('phone_number', '').strip(),
                is_active=True
            )
            db.session.add(sp)
            db.session.flush()
            salesperson_id = sp.id

    user = User(
        username=data['username'].strip(),
        password_hash=generate_password_hash(data['password']),
        full_name=data['full_name'].strip(),
        role=data['role'],
        salesperson_id=salesperson_id,
        is_active=True
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin update kar sakta hai'}), 403

    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if data.get('full_name'):
        user.full_name = data['full_name'].strip()
        # Salesperson record bhi update karo
        if user.salesperson_id:
            sp = SalesPerson.query.get(user.salesperson_id)
            if sp:
                sp.name = data['full_name'].upper().strip()
    if data.get('password'):
        user.password_hash = generate_password_hash(data['password'])
    if data.get('role'):
        valid_roles = ['data_entry', 'calculation', 'admin', 'salesperson']
        if data['role'] not in valid_roles:
            return jsonify({'message': 'Role valid nahi hai'}), 400
        user.role = data['role']
    if 'is_active' in data:
        user.is_active = data['is_active']
        # Salesperson record bhi update karo
        if user.salesperson_id:
            sp = SalesPerson.query.get(user.salesperson_id)
            if sp:
                sp.is_active = data['is_active']

    db.session.commit()
    return jsonify(user.to_dict()), 200


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin delete kar sakta hai'}), 403

    user = User.query.get_or_404(user_id)

    if str(user.id) == str(claims.get('sub')):
        return jsonify({'message': 'Aap khud ko delete nahi kar sakte'}), 400

    user.is_active = False
    if user.salesperson_id:
        sp = SalesPerson.query.get(user.salesperson_id)
        if sp:
            sp.is_active = False

    db.session.commit()
    return jsonify({'message': 'User inactive ho gaya'}), 200


@users_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    from flask_jwt_extended import get_jwt_identity
    user_id = get_jwt_identity()
    user = User.query.get_or_404(int(user_id))
    data = request.get_json()

    if not data.get('new_password'):
        return jsonify({'message': 'Naya password chahiye'}), 400

    user.password_hash = generate_password_hash(data['new_password'])
    db.session.commit()
    return jsonify({'message': 'Password change ho gaya'}), 200