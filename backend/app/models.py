from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import SQLModel, Field
import uuid


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# -------------------------------------------------------------
# User & Authentication Models (FR-001)
# -------------------------------------------------------------
class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=150)
    name: str = Field(max_length=100)
    role: str = Field(max_length=60)  # Managing Attorney, Senior Associate, Paralegal, Compliance Officer
    hashed_password: str = Field(max_length=255)
    salt: str = Field(max_length=64)
    initials: str = Field(default="AC", max_length=10)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)


class UserLogin(SQLModel):
    email: str
    password: str


class UserResponse(SQLModel):
    id: int
    email: str
    name: str
    role: str
    initials: str
    is_active: bool


class TokenResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# -------------------------------------------------------------
# Case Models (FR-003, FR-004)
# -------------------------------------------------------------
class Case(SQLModel, table=True):
    __tablename__ = "cases"

    id: Optional[int] = Field(default=None, primary_key=True)
    case_number: str = Field(index=True, unique=True, max_length=50)
    title: str = Field(index=True, max_length=255)
    client_name: str = Field(index=True, max_length=200)
    client_email: Optional[str] = Field(default=None, max_length=150)
    client_phone: Optional[str] = Field(default=None, max_length=50)
    opposing_party: Optional[str] = Field(default=None, max_length=200)
    opposing_counsel: Optional[str] = Field(default=None, max_length=200)
    court_jurisdiction: Optional[str] = Field(default="High Court of Delhi", max_length=200)
    judge_name: Optional[str] = Field(default=None, max_length=150)
    case_type: str = Field(default="Civil Litigation", max_length=100)
    status: str = Field(default="Active", max_length=50)  # Active, In Review, Hearing Scheduled, Closed, Archived
    filing_date: Optional[str] = Field(default=None, max_length=50)
    next_hearing_date: Optional[str] = Field(default=None, max_length=50)
    assigned_to: str = Field(default="Arjun Kapoor", max_length=100)
    priority: str = Field(default="Medium", max_length=30)  # High, Medium, Low
    claim_amount: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class CaseCreate(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    client_name: str = Field(min_length=1, max_length=200)
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    opposing_party: Optional[str] = None
    opposing_counsel: Optional[str] = None
    court_jurisdiction: Optional[str] = "High Court of Delhi"
    judge_name: Optional[str] = None
    case_type: str = "Civil Litigation"
    status: str = "Active"
    filing_date: Optional[str] = None
    next_hearing_date: Optional[str] = None
    assigned_to: str = "Arjun Kapoor"
    priority: str = "Medium"
    claim_amount: Optional[str] = None
    notes: Optional[str] = None


class CaseUpdate(SQLModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    opposing_party: Optional[str] = None
    opposing_counsel: Optional[str] = None
    court_jurisdiction: Optional[str] = None
    judge_name: Optional[str] = None
    case_type: Optional[str] = None
    status: Optional[str] = None
    filing_date: Optional[str] = None
    next_hearing_date: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    claim_amount: Optional[str] = None
    notes: Optional[str] = None


# -------------------------------------------------------------
# Document Models with Cryptographic Integrity (FR-005)
# -------------------------------------------------------------
class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: Optional[int] = Field(default=None, index=True)
    case_number: Optional[str] = Field(default=None, max_length=50)
    case_title: Optional[str] = Field(default=None, max_length=255)
    filename: str = Field(index=True, max_length=255)
    category: str = Field(default="Pleading", max_length=80)  # Petition, Affidavit, Contract, Evidence, Order, Notice
    file_type: str = Field(default="pdf", max_length=20)
    file_size_bytes: int = Field(default=0)
    sha256_checksum: str = Field(default="", max_length=64)  # For Sec 65B Indian Evidence Act / BSA verification
    storage_path: Optional[str] = Field(default=None, max_length=500)
    mime_type: str = Field(default="application/pdf", max_length=100)
    file_content_text: Optional[str] = None
    uploaded_by: str = Field(default="Arjun Kapoor", max_length=100)
    processing_status: str = Field(default="Processed", max_length=50)  # Ready, Analyzing, Processed, Error
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


class DocumentCreate(SQLModel):
    case_id: Optional[int] = None
    case_number: Optional[str] = None
    case_title: Optional[str] = None
    filename: str
    category: str = "Pleading"
    file_type: str = "pdf"
    file_size_bytes: int = 0
    file_content_text: Optional[str] = None
    file_base64: Optional[str] = None  # Raw bytes in base64 for real file persistence
    notes: Optional[str] = None


# -------------------------------------------------------------
# AI Advisory Review Models (FR-006, FR-007)
# -------------------------------------------------------------
class AIDocumentSummary(SQLModel, table=True):
    __tablename__ = "ai_document_summaries"

    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(index=True)
    case_id: Optional[int] = Field(default=None, index=True)
    case_number: Optional[str] = None
    document_title: str = Field(max_length=255)
    executive_summary: str
    key_clauses: str
    statutory_provisions: str
    risk_assessment: str
    candidate_facts_json: str  # JSON list of candidate facts with source refs, candidate dates, verification status
    review_status: str = Field(default="Pending Human Review", max_length=60)  # Pending Human Review, Verified by Counsel, Rejected
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    advocate_signature: Optional[str] = None  # Explicit lawyer sign-off identifier
    is_advisory_acknowledged: bool = Field(default=False)  # Requires active acknowledgment before reliance
    created_at: datetime = Field(default_factory=utc_now)


# -------------------------------------------------------------
# Hearings / Calendar Models (FR-008)
# -------------------------------------------------------------
class Hearing(SQLModel, table=True):
    __tablename__ = "hearings"

    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: Optional[int] = Field(default=None, index=True)
    case_number: str = Field(max_length=50)
    case_title: str = Field(max_length=255)
    hearing_date: str = Field(index=True, max_length=50)  # YYYY-MM-DD
    hearing_time: str = Field(default="10:30 AM", max_length=50)
    court_name: str = Field(default="Delhi High Court", max_length=200)
    courtroom: str = Field(default="Courtroom No. 4", max_length=100)
    judge: Optional[str] = Field(default=None, max_length=150)
    hearing_type: str = Field(default="Arguments", max_length=100)
    preparation_status: str = Field(default="Preparation Needed", max_length=80)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


class HearingCreate(SQLModel):
    case_id: Optional[int] = None
    case_number: str
    case_title: str
    hearing_date: str
    hearing_time: str = "10:30 AM"
    court_name: str = "Delhi High Court"
    courtroom: str = "Courtroom No. 4"
    judge: Optional[str] = None
    hearing_type: str = "Arguments"
    preparation_status: str = "Preparation Needed"
    notes: Optional[str] = None


# -------------------------------------------------------------
# Task Item Models (FR-008)
# -------------------------------------------------------------
class TaskItem(SQLModel, table=True):
    __tablename__ = "tasks"

    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: Optional[int] = Field(default=None, index=True)
    case_number: Optional[str] = Field(default=None, max_length=50)
    title: str = Field(max_length=255)
    description: Optional[str] = None
    assigned_to: str = Field(default="Arjun Kapoor", max_length=100)
    due_date: str = Field(max_length=50)
    priority: str = Field(default="Medium", max_length=30)  # Urgent, High, Medium, Low
    is_completed: bool = Field(default=False)
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)


class TaskCreate(SQLModel):
    case_id: Optional[int] = None
    case_number: Optional[str] = None
    title: str
    description: Optional[str] = None
    assigned_to: str = "Arjun Kapoor"
    due_date: str
    priority: str = "Medium"


# -------------------------------------------------------------
# Tamper-Evident Hash-Chained Audit Log (FR-010)
# -------------------------------------------------------------
class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    action: str = Field(index=True, max_length=100)
    actor_name: str = Field(default="Arjun Kapoor", max_length=100)
    actor_role: str = Field(default="Managing Attorney", max_length=100)
    entity_type: str = Field(index=True, max_length=80)
    entity_id: Optional[str] = Field(default=None, max_length=100)
    details: str
    prev_hash: str = Field(default="GENESIS", max_length=64)  # Previous record's hash
    record_hash: str = Field(default="", max_length=64)  # SHA-256(prev_hash + timestamp + action + actor + details)
    timestamp: datetime = Field(default_factory=utc_now)


# -------------------------------------------------------------
# Client Directory Models
# -------------------------------------------------------------
class ClientRecord(SQLModel, table=True):
    __tablename__ = "clients"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=200)
    entity_type: str = Field(default="Individual", max_length=80)  # Individual, Corporate, Trust/LLP
    contact_email: Optional[str] = Field(default=None, max_length=150)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = None
    active_cases_count: int = Field(default=1)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


class ClientCreate(SQLModel):
    name: str
    entity_type: str = "Individual"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
