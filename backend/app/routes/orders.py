from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app import db
from app.models.sample import Sample, SampleProduct, OrderDetail
from app.models.party import Party
from datetime import datetime, timedelta
from sqlalchemy.orm import joinedload

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('/<int:sample_product_id>', methods=['PUT'])
@jwt_required()
def update_order(sample_product_id):
    claims = get_jwt()
    user_id = get_jwt_identity()

    if claims['role'] not in ['calculation', 'admin']:
        return jsonify({'message': 'Access nahi hai'}), 403

    sample_product = SampleProduct.query.get_or_404(sample_product_id)
    data = request.get_json()

    order = sample_product.order_detail
    if not order:
        order = OrderDetail(sample_product_id=sample_product_id)
        db.session.add(order)

    if 'order_yes_no' in data:
        order.order_yes_no = data['order_yes_no']
        if not data['order_yes_no']:
            order.quantity_kg = 0.0

    if 'quantity_kg' in data:
        order.quantity_kg = float(data['quantity_kg'])

    if 'notes' in data:
        order.notes = data['notes']

    order.filled_by = int(user_id)
    order.filled_at = datetime.utcnow()

    db.session.commit()
    return jsonify(order.to_dict()), 200


@orders_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    claims = get_jwt()
    if claims['role'] not in ['calculation', 'admin']:
        return jsonify({'message': 'Access nahi hai'}), 403

    duration = request.args.get('duration', 3)
    party_id = request.args.get('party_id', None)

    months = int(duration)
    start_date = datetime.utcnow() - timedelta(days=30 * months)

    query = Sample.query.options(
        joinedload(Sample.products)
    ).filter(
        Sample.order_received_date >= start_date
    )
    if party_id:
        query = query.filter(Sample.party_id == party_id)

    samples = query.all()

    total_samples = 0
    samples_with_order = 0
    total_order_qty = 0.0

    for sample in samples:
        for product in sample.products:
            total_samples += 1
            if product.order_detail:
                if product.order_detail.order_yes_no:
                    samples_with_order += 1
                    total_order_qty += product.order_detail.quantity_kg

    estimated_qty_per_sample = (
        total_order_qty / total_samples if total_samples > 0 else 0
    )

    conversion_avg = (
        (samples_with_order / total_samples * 100)
        if total_samples > 0 else 0
    )

    return jsonify({
        'total_samples': total_samples,
        'samples_with_order': samples_with_order,
        'total_order_qty_kg': total_order_qty,
        'estimated_qty_per_sample_kg': round(estimated_qty_per_sample, 2),
        'sample_conversion_avg': round(conversion_avg, 2)
    }), 200