from flask import Flask, request, jsonify, render_template_string, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
import os
import re  # For email validation

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "hard-to-guess-secret")

# Database Configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize Database
db = SQLAlchemy(app)

# Password Configuration
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "eK1!g9Z#8rT$4")

# Define the NewsletterEmail model
class NewsletterEmail(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False, unique=True)

    def __init__(self, email):
        self.email = email

# Helper Function: Validate Email
def is_valid_email(email: str) -> bool:
    """Basic email validation: checks for '@' and '.'."""
    if email and re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return True
    return False

# Endpoint: Newsletter Email Subscription
@app.route('/newsletter/07/email/subscribe', methods=['POST'])
def subscribe_email():
    try:
        data = request.get_json()
        email = data.get('email')

        # Validate email format
        if not is_valid_email(email):
            return jsonify({"error": "Invalid email format"}), 400

        # Check if email already exists
        if NewsletterEmail.query.filter_by(email=email).first():
            return jsonify({"error": "Email already subscribed"}), 409

        # Save to database
        new_email = NewsletterEmail(email=email)
        db.session.add(new_email)
        db.session.commit()
        return jsonify({"message": "Subscription successful", "email": email}), 201

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# Endpoint: Delete Email
@app.route('/newsletter/07/email/delete', methods=['POST'])
def delete_email():
    try:
        data = request.get_json()
        email = data.get('email')

        # Check if email exists
        email_entry = NewsletterEmail.query.filter_by(email=email).first()
        if not email_entry:
            return jsonify({"error": "Email not found"}), 404

        # Delete email
        db.session.delete(email_entry)
        db.session.commit()
        return jsonify({"message": f"Email {email} deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# Admin Login Page
@app.route('/', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == ADMIN_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('admin_dashboard'))
        else:
            return "<h3>Incorrect Password</h3>", 401

    return render_template_string('''
        <html>
        <head><title>Admin Login</title></head>
        <body>
            <h2>Admin Login</h2>
            <form method="post">
                <label for="password">Password:</label>
                <input type="password" name="password" required>
                <button type="submit">Login</button>
            </form>
        </body>
        </html>
    ''')

# Admin Dashboard with Delete Feature
@app.route('/dashboard', methods=['GET', 'POST'])
def admin_dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('admin_login'))

    if request.method == 'POST':
        email = request.form.get('email')
        if email and is_valid_email(email):
            if not NewsletterEmail.query.filter_by(email=email).first():
                new_email = NewsletterEmail(email=email)
                db.session.add(new_email)
                db.session.commit()
        return redirect(url_for('admin_dashboard'))

    emails = NewsletterEmail.query.all()
    email_list = [e.email for e in emails]

    return render_template_string('''
        <html>
        <head>
            <title>Admin Dashboard</title>
            <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                table, th, td { border: 1px solid black; }
                th, td { padding: 10px; text-align: left; }
                button { padding: 5px 10px; cursor: pointer; }
            </style>
        </head>
        <body>
            <h2>Newsletter Subscribers</h2>
            <table>
                <tr>
                    <th>Email</th>
                    <th>Actions</th>
                </tr>
                {% for email in emails %}
                <tr>
                    <td>{{ email }}</td>
                    <td>
                        <form method="post" action="{{ url_for('delete_email_dashboard') }}">
                            <input type="hidden" name="email" value="{{ email }}">
                            <button type="submit">Delete</button>
                        </form>
                    </td>
                </tr>
                {% endfor %}
            </table>
            <br>
            <h3>Add Email</h3>
            <form method="post">
                <label for="email">Email:</label>
                <input type="email" name="email" required>
                <button type="submit">Add</button>
            </form>
        </body>
        </html>
    ''', emails=email_list)

# Endpoint for Dashboard Email Deletion
@app.route('/delete-email', methods=['POST'])
def delete_email_dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('admin_login'))

    email = request.form.get('email')
    email_entry = NewsletterEmail.query.filter_by(email=email).first()
    if email_entry:
        db.session.delete(email_entry)
        db.session.commit()
    return redirect(url_for('admin_dashboard'))

# Logout Route
@app.route('/logout')
def logout():
    session['logged_in'] = False
    return redirect(url_for('admin_login'))

# Run the app
if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
  
