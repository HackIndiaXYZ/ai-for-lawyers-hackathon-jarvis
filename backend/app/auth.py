import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select

from app.database import get_session
from app.models import User

# Chamber Secret Key for cryptographic HMAC-SHA256 token signing
SECRET_KEY = "casepilot_ps01_legal_tech_secure_chamber_key_2026_super_secret"
security = HTTPBearer(auto_error=False)


def generate_salt() -> str:
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return key.hex()


def verify_password(plain_password: str, salt: str, hashed_password: str) -> bool:
    return hmac.compare_digest(hash_password(plain_password, salt), hashed_password)


def create_access_token(user_id: int, email: str, role: str, name: str, expires_hours: int = 24) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=expires_hours)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp())
    }
    raw_json = json.dumps(payload, separators=(",", ":"))
    b64_payload = base64.urlsafe_b64encode(raw_json.encode("utf-8")).decode("utf-8").rstrip("=")

    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        b64_payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    return f"{b64_payload}.{signature}"


def decode_access_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        b64_payload, signature = parts

        # Verify signature
        expected_sig = hmac.new(
            SECRET_KEY.encode("utf-8"),
            b64_payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            return None

        # Pad base64 if needed
        padding = 4 - (len(b64_payload) % 4)
        if padding != 4:
            b64_payload += "=" * padding

        raw_json = base64.urlsafe_b64decode(b64_payload.encode("utf-8")).decode("utf-8")
        payload = json.loads(raw_json)

        # Check expiry
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if payload.get("exp", 0) < now_ts:
            return None

        return payload
    except Exception:
        return None


def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: Session = Depends(get_session)
) -> Optional[User]:
    if not auth or not auth.credentials:
        return None
    payload = decode_access_token(auth.credentials)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = session.get(User, user_id)
    return user


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: Session = Depends(get_session)
) -> User:
    user = get_current_user_optional(auth, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_roles(allowed_roles: List[str]):
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for role '{user.role}'. Required role(s): {', '.join(allowed_roles)} (FR-001)."
            )
        return user
    return role_checker
