from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField
from wtforms.validators import DataRequired, Email
from werkzeug.security import generate_password_hash, check_password_hash
import os
import secrets

# Configuration and Initialization
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(16)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///newsletter.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

# Flask App Configuration
app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)

# Forms
class LoginForm(FlaskForm):
    password = PasswordField('Password', validators=[DataRequired()])

class EmailForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])

# Models
class NewsletterEmail(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def __repr__(self):
        return f'<Email {self.email}>'

# Helper Functions
def create_tables():
    """Create database tables if they don't exist."""
    with app.app_context():
        db.create_all()

def validate_email(email):
    """Enhanced email validation."""
    try:
        from email_validator import validate_email, EmailNotValidError
        validate_email(email)
        return True
    except EmailNotValidError:
        return False

# Authentication Decorator
def login_required(func):
    def wrapper(*args, **kwargs):
        if not session.get('logged_in'):
            flash('Please log in to access this page', 'error')
            return redirect(url_for('login'))
        return func(*args, **kwargs)
    return wrapper

# Routes
@app.route('/', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        if check_password_hash(generate_password_hash(app.config['ADMIN_PASSWORD']), form.password.data):
            session['logged_in'] = True
            flash('Login successful', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid credentials', 'error')
    return render_template('login.html', form=form)

@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    email_form = EmailForm()
    if email_form.validate_on_submit():
        email = email_form.email.data
        if validate_email(email):
            try:
                new_email = NewsletterEmail(email=email)
                db.session.add(new_email)
                db.session.commit()
                flash(f'Email {email} added successfully', 'success')
            except Exception as e:
                db.session.rollback()
                flash(f'Error adding email: {str(e)}', 'error')
        else:
            flash('Invalid email format', 'error')
    
    emails = NewsletterEmail.query.order_by(NewsletterEmail.created_at.desc()).all()
    return render_template('dashboard.html', emails=emails, email_form=email_form)

@app.route('/delete-email/<int:email_id>', methods=['POST'])
@login_required
def delete_email(email_id):
    email_entry = NewsletterEmail.query.get_or_404(email_id)
    try:
        db.session.delete(email_entry)
        db.session.commit()
        flash(f'Email {email_entry.email} deleted successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting email: {str(e)}', 'error')
    return redirect(url_for('dashboard'))

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    flash('You have been logged out', 'success')
    return redirect(url_for('login'))

# API Endpoints
@app.route('/api/newsletter/subscribe', methods=['POST'])
def subscribe_email():
    data = request.get_json()
    email = data.get('email')
    
    if not validate_email(email):
        return jsonify({"error": "Invalid email format"}), 400

    existing_email = NewsletterEmail.query.filter_by(email=email).first()
    if existing_email:
        return jsonify({"error": "Email already subscribed"}), 409

    try:
        new_email = NewsletterEmail(email=email)
        db.session.add(new_email)
        db.session.commit()
        return jsonify({"message": "Subscription successful", "email": email}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/newsletter/unsubscribe', methods=['POST'])
def unsubscribe_email():
    data = request.get_json()
    email = data.get('email')

    email_entry = NewsletterEmail.query.filter_by(email=email).first()
    if not email_entry:
        return jsonify({"error": "Email not found"}), 404

    try:
        db.session.delete(email_entry)
        db.session.commit()
        return jsonify({"message": f"Email {email} unsubscribed successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# Error Handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('500.html'), 500

# Application Entry Point
if __name__ == '__main__':
    create_tables()
    app.run(
        host='0.0.0.0', 
        port=int(os.environ.get('PORT', 5000)), 
        debug=os.environ.get('FLASK_DEBUG', 'False') == 'True'
    )
