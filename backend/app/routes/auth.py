from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models.user import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Username aur password dono chahiye'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Username ya password galat hai'}), 401
    
    if not user.is_active:
        return jsonify({'message': 'Account inactive hai, admin se contact karo'}), 403
    
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            'username': user.username,
            'role': user.role,
            'full_name': user.full_name,
            'salesperson_id': user.salesperson_id
        }
    )
    
    return jsonify({
        'access_token': access_token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    claims = get_jwt()
    return jsonify({
        'id': get_jwt_identity(),
        'username': claims['username'],
        'role': claims['role'],
        'full_name': claims['full_name'],
        'salesperson_id': claims.get('salesperson_id')
    }), 200