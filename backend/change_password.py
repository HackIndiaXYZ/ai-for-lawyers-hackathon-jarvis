"""
CLI Utility to change demo user credentials in CasePilot AI.

Usage:
    python change_password.py
    python change_password.py arjun.kapoor@lexford.legal MyNewPassword123
"""

import sys
from sqlmodel import Session, select
from app.database import engine
from app.models import User
from app.auth import generate_salt, hash_password


def list_users():
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        print("\n--- Available Users in CasePilot AI ---")
        for idx, u in enumerate(users, 1):
            print(f"[{idx}] {u.name} ({u.role}) — Email: {u.email}")
        print("---------------------------------------\n")
        return users


def update_password(email: str, new_password: str):
    email = email.strip().lower()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            print(f"[ERROR] User with email '{email}' not found.")
            return False

        # Generate new salt and salted PBKDF2 hash
        salt = generate_salt()
        user.salt = salt
        user.hashed_password = hash_password(new_password, salt)
        session.add(user)
        session.commit()

        print(f"[SUCCESS] Password for '{user.name}' ({user.email}) has been updated.")
        print(f"   New Password: {new_password}\n")
        return True


def main():
    if len(sys.argv) == 3:
        email = sys.argv[1]
        new_pw = sys.argv[2]
        update_password(email, new_pw)
    else:
        users = list_users()
        if not users:
            print("No users found in database.")
            return

        choice = input("Enter email or user number to update: ").strip()
        selected_email = None

        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(users):
                selected_email = users[idx].email
        else:
            selected_email = choice

        if not selected_email:
            print("Invalid selection.")
            return

        new_pw = input("Enter new password: ").strip()
        if not new_pw:
            print("Password cannot be empty.")
            return

        update_password(selected_email, new_pw)


if __name__ == "__main__":
    main()
