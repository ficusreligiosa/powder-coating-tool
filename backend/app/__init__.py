from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import Config
from datetime import timedelta

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.url_map.strict_slashes = False

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.routes.auth import auth_bp
    from app.routes.samples import samples_bp
    from app.routes.parties import parties_bp
    from app.routes.cities import cities_bp
    from app.routes.orders import orders_bp
    from app.routes.salespersons import salespersons_bp
    from app.routes.users import users_bp
    from app.routes.import_data import import_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(samples_bp, url_prefix='/api/samples')
    app.register_blueprint(parties_bp, url_prefix='/api/parties')
    app.register_blueprint(cities_bp, url_prefix='/api/cities')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(salespersons_bp, url_prefix='/api/salespersons')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(import_bp, url_prefix='/api/import')

    return app