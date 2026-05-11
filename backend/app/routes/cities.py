from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app import db
from app.models.city import City

cities_bp = Blueprint('cities', __name__)

# India ke saare cities/towns ka data
INDIA_CITIES = [
    {"city": "Agra", "state": "Uttar Pradesh"},
    {"city": "Ahmedabad", "state": "Gujarat"},
    {"city": "Aizawl", "state": "Mizoram"},
    {"city": "Ajmer", "state": "Rajasthan"},
    {"city": "Alappuzha", "state": "Kerala"},
    {"city": "Aligarh", "state": "Uttar Pradesh"},
    {"city": "Allahabad", "state": "Uttar Pradesh"},
    {"city": "Alwar", "state": "Rajasthan"},
    {"city": "Ambala", "state": "Haryana"},
    {"city": "Amravati", "state": "Maharashtra"},
    {"city": "Amritsar", "state": "Punjab"},
    {"city": "Anantnag", "state": "Jammu & Kashmir"},
    {"city": "Asansol", "state": "West Bengal"},
    {"city": "Aurangabad", "state": "Maharashtra"},
    {"city": "Ayodhya", "state": "Uttar Pradesh"},
    {"city": "Azamgarh", "state": "Uttar Pradesh"},
    {"city": "Bahadurgarh", "state": "Haryana"},
    {"city": "Ballari", "state": "Karnataka"},
    {"city": "Ballia", "state": "Uttar Pradesh"},
    {"city": "Balasore", "state": "Odisha"},
    {"city": "Baramulla", "state": "Jammu & Kashmir"},
    {"city": "Bareilly", "state": "Uttar Pradesh"},
    {"city": "Basti", "state": "Uttar Pradesh"},
    {"city": "Bathinda", "state": "Punjab"},
    {"city": "Belgaum", "state": "Karnataka"},
    {"city": "Bengaluru", "state": "Karnataka"},
    {"city": "Bhagalpur", "state": "Bihar"},
    {"city": "Bharatpur", "state": "Rajasthan"},
    {"city": "Bhilai", "state": "Chhattisgarh"},
    {"city": "Bhopal", "state": "Madhya Pradesh"},
    {"city": "Bhubaneswar", "state": "Odisha"},
    {"city": "Bikaner", "state": "Rajasthan"},
    {"city": "Bilaspur", "state": "Chhattisgarh"},
    {"city": "Bokaro", "state": "Jharkhand"},
    {"city": "Chandigarh", "state": "Chandigarh"},
    {"city": "Chennai", "state": "Tamil Nadu"},
    {"city": "Coimbatore", "state": "Tamil Nadu"},
    {"city": "Cuttack", "state": "Odisha"},
    {"city": "Daman", "state": "Daman & Diu"},
    {"city": "Darbhanga", "state": "Bihar"},
    {"city": "Davanagere", "state": "Karnataka"},
    {"city": "Dehradun", "state": "Uttarakhand"},
    {"city": "Deoghar", "state": "Jharkhand"},
    {"city": "Deoria", "state": "Uttar Pradesh"},
    {"city": "Delhi", "state": "Delhi"},
    {"city": "Dhanbad", "state": "Jharkhand"},
    {"city": "Dibrugarh", "state": "Assam"},
    {"city": "Dimapur", "state": "Nagaland"},
    {"city": "Durgapur", "state": "West Bengal"},
    {"city": "Erode", "state": "Tamil Nadu"},
    {"city": "Etawah", "state": "Uttar Pradesh"},
    {"city": "Faizabad", "state": "Uttar Pradesh"},
    {"city": "Faridabad", "state": "Haryana"},
    {"city": "Firozabad", "state": "Uttar Pradesh"},
    {"city": "Gangtok", "state": "Sikkim"},
    {"city": "Gaya", "state": "Bihar"},
    {"city": "Ghaziabad", "state": "Uttar Pradesh"},
    {"city": "Gorakhpur", "state": "Uttar Pradesh"},
    {"city": "Guntur", "state": "Andhra Pradesh"},
    {"city": "Gurgaon", "state": "Haryana"},
    {"city": "Guwahati", "state": "Assam"},
    {"city": "Gwalior", "state": "Madhya Pradesh"},
    {"city": "Hapur", "state": "Uttar Pradesh"},
    {"city": "Haridwar", "state": "Uttarakhand"},
    {"city": "Hazaribagh", "state": "Jharkhand"},
    {"city": "Hisar", "state": "Haryana"},
    {"city": "Howrah", "state": "West Bengal"},
    {"city": "Hubli", "state": "Karnataka"},
    {"city": "Hyderabad", "state": "Telangana"},
    {"city": "Imphal", "state": "Manipur"},
    {"city": "Indore", "state": "Madhya Pradesh"},
    {"city": "Itanagar", "state": "Arunachal Pradesh"},
    {"city": "Jabalpur", "state": "Madhya Pradesh"},
    {"city": "Jaipur", "state": "Rajasthan"},
    {"city": "Jalandhar", "state": "Punjab"},
    {"city": "Jalgaon", "state": "Maharashtra"},
    {"city": "Jammu", "state": "Jammu & Kashmir"},
    {"city": "Jamnagar", "state": "Gujarat"},
    {"city": "Jamshedpur", "state": "Jharkhand"},
    {"city": "Jhansi", "state": "Uttar Pradesh"},
    {"city": "Jodhpur", "state": "Rajasthan"},
    {"city": "Jorhat", "state": "Assam"},
    {"city": "Kargil", "state": "Ladakh"},
    {"city": "Karimnagar", "state": "Telangana"},
    {"city": "Kanpur", "state": "Uttar Pradesh"},
    {"city": "Karnal", "state": "Haryana"},
    {"city": "Khammam", "state": "Telangana"},
    {"city": "Kharagpur", "state": "West Bengal"},
    {"city": "Kochi", "state": "Kerala"},
    {"city": "Kolhapur", "state": "Maharashtra"},
    {"city": "Kolkata", "state": "West Bengal"},
    {"city": "Korba", "state": "Chhattisgarh"},
    {"city": "Kota", "state": "Rajasthan"},
    {"city": "Kozhikode", "state": "Kerala"},
    {"city": "Kurnool", "state": "Andhra Pradesh"},
    {"city": "Leh", "state": "Ladakh"},
    {"city": "Lucknow", "state": "Uttar Pradesh"},
    {"city": "Ludhiana", "state": "Punjab"},
    {"city": "Madurai", "state": "Tamil Nadu"},
    {"city": "Malda", "state": "West Bengal"},
    {"city": "Mangalore", "state": "Karnataka"},
    {"city": "Mathura", "state": "Uttar Pradesh"},
    {"city": "Meerut", "state": "Uttar Pradesh"},
    {"city": "Moradabad", "state": "Uttar Pradesh"},
    {"city": "Mumbai", "state": "Maharashtra"},
    {"city": "Muzaffarnagar", "state": "Uttar Pradesh"},
    {"city": "Muzaffarpur", "state": "Bihar"},
    {"city": "Mysore", "state": "Karnataka"},
    {"city": "Nagpur", "state": "Maharashtra"},
    {"city": "Nagercoil", "state": "Tamil Nadu"},
    {"city": "Nanded", "state": "Maharashtra"},
    {"city": "Nashik", "state": "Maharashtra"},
    {"city": "Navi Mumbai", "state": "Maharashtra"},
    {"city": "Nellore", "state": "Andhra Pradesh"},
    {"city": "Nizamabad", "state": "Telangana"},
    {"city": "Noida", "state": "Uttar Pradesh"},
    {"city": "Panipat", "state": "Haryana"},
    {"city": "Patiala", "state": "Punjab"},
    {"city": "Patna", "state": "Bihar"},
    {"city": "Puducherry", "state": "Puducherry"},
    {"city": "Port Blair", "state": "Andaman & Nicobar Islands"},
    {"city": "Prayagraj", "state": "Uttar Pradesh"},
    {"city": "Pune", "state": "Maharashtra"},
    {"city": "Raebareli", "state": "Uttar Pradesh"},
    {"city": "Raipur", "state": "Chhattisgarh"},
    {"city": "Rajahmundry", "state": "Andhra Pradesh"},
    {"city": "Rajkot", "state": "Gujarat"},
    {"city": "Rampur", "state": "Uttar Pradesh"},
    {"city": "Ranchi", "state": "Jharkhand"},
    {"city": "Rewa", "state": "Madhya Pradesh"},
    {"city": "Rewari", "state": "Haryana"},
    {"city": "Rohtak", "state": "Haryana"},
    {"city": "Rourkela", "state": "Odisha"},
    {"city": "Rudrapur", "state": "Uttarakhand"},
    {"city": "Sagar", "state": "Madhya Pradesh"},
    {"city": "Saharanpur", "state": "Uttar Pradesh"},
    {"city": "Salem", "state": "Tamil Nadu"},
    {"city": "Sambalpur", "state": "Odisha"},
    {"city": "Satara", "state": "Maharashtra"},
    {"city": "Satna", "state": "Madhya Pradesh"},
    {"city": "Shahjahanpur", "state": "Uttar Pradesh"},
    {"city": "Shillong", "state": "Meghalaya"},
    {"city": "Shimla", "state": "Himachal Pradesh"},
    {"city": "Shimoga", "state": "Karnataka"},
    {"city": "Sikar", "state": "Rajasthan"},
    {"city": "Silchar", "state": "Assam"},
    {"city": "Siliguri", "state": "West Bengal"},
    {"city": "Silvassa", "state": "Dadra & Nagar Haveli"},
    {"city": "Sitapur", "state": "Uttar Pradesh"},
    {"city": "Solapur", "state": "Maharashtra"},
    {"city": "Sonipat", "state": "Haryana"},
    {"city": "Srinagar", "state": "Jammu & Kashmir"},
    {"city": "Sultanpur", "state": "Uttar Pradesh"},
    {"city": "Surat", "state": "Gujarat"},
    {"city": "Thane", "state": "Maharashtra"},
    {"city": "Thiruvananthapuram", "state": "Kerala"},
    {"city": "Thoothukudi", "state": "Tamil Nadu"},
    {"city": "Thrissur", "state": "Kerala"},
    {"city": "Tiruchirappalli", "state": "Tamil Nadu"},
    {"city": "Tirupati", "state": "Andhra Pradesh"},
    {"city": "Tiruppur", "state": "Tamil Nadu"},
    {"city": "Udaipur", "state": "Rajasthan"},
    {"city": "Ujjain", "state": "Madhya Pradesh"},
    {"city": "Unnao", "state": "Uttar Pradesh"},
    {"city": "Vadodara", "state": "Gujarat"},
    {"city": "Varanasi", "state": "Uttar Pradesh"},
    {"city": "Vellore", "state": "Tamil Nadu"},
    {"city": "Vijayawada", "state": "Andhra Pradesh"},
    {"city": "Visakhapatnam", "state": "Andhra Pradesh"},
    {"city": "Warangal", "state": "Telangana"},
]


@cities_bp.route('/', methods=['GET'])
@jwt_required()
def get_cities():
    cities = City.query.order_by(City.name).all()
    return jsonify([c.to_dict() for c in cities]), 200


@cities_bp.route('/search', methods=['GET'])
@jwt_required()
def search_cities():
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify([]), 200

    # Pehle DB mein search karo
    db_cities = City.query.filter(
        City.name.ilike(f'%{query}%')
    ).order_by(City.name).limit(5).all()

    db_results = [{'id': c.id, 'name': c.name, 'state': c.state,
                   'is_moradabad': c.is_moradabad, 'from_db': True}
                  for c in db_cities]

    # Phir static list mein search karo
    static_results = [
        {'id': None, 'name': c['city'], 'state': c['state'],
         'is_moradabad': c['city'].upper() in ['MORADABAD', 'MBD'],
         'from_db': False}
        for c in INDIA_CITIES
        if query in c['city'].lower()
        and c['city'].upper() not in [r['name'].upper() for r in db_results]
    ][:5]

    return jsonify(db_results + static_results), 200


@cities_bp.route('/add-or-get', methods=['POST'])
@jwt_required()
def add_or_get_city():
    """City ko DB mein add karo agar nahi hai"""
    data = request.get_json()
    name = data.get('name', '').strip().upper()
    state = data.get('state', '').strip()

    if not name:
        return jsonify({'message': 'City name chahiye'}), 400

    existing = City.query.filter_by(name=name).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    mbd_names = ['MORADABAD', 'MBD']
    city = City(
        name=name,
        state=state,
        is_moradabad=name in mbd_names
    )
    db.session.add(city)
    db.session.commit()
    return jsonify(city.to_dict()), 201


@cities_bp.route('/', methods=['POST'])
@jwt_required()
def add_city():
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin city add kar sakta hai'}), 403

    data = request.get_json()
    if not data.get('name'):
        return jsonify({'message': 'City name chahiye'}), 400

    existing = City.query.filter_by(name=data['name'].upper().strip()).first()
    if existing:
        return jsonify({'message': 'Yeh city already exist karti hai'}), 409

    city = City(
        name=data['name'].upper().strip(),
        state=data.get('state', '').strip(),
        is_moradabad=data.get('is_moradabad', False)
    )
    db.session.add(city)
    db.session.commit()
    return jsonify(city.to_dict()), 201


@cities_bp.route('/<int:city_id>', methods=['PUT'])
@jwt_required()
def update_city(city_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin city update kar sakta hai'}), 403

    city = City.query.get_or_404(city_id)
    data = request.get_json()

    if data.get('name'):
        city.name = data['name'].upper().strip()
    if 'state' in data:
        city.state = data['state'].strip()
    if 'is_moradabad' in data:
        city.is_moradabad = data['is_moradabad']

    db.session.commit()
    return jsonify(city.to_dict()), 200


@cities_bp.route('/<int:city_id>', methods=['DELETE'])
@jwt_required()
def delete_city(city_id):
    claims = get_jwt()
    if claims['role'] != 'admin':
        return jsonify({'message': 'Sirf admin city delete kar sakta hai'}), 403

    city = City.query.get_or_404(city_id)
    db.session.delete(city)
    db.session.commit()
    return jsonify({'message': 'City delete ho gayi'}), 200