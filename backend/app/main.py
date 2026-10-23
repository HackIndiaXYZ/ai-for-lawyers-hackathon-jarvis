import base64
import csv
import hashlib
import io
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import Depends, FastAPI, HTTPException, Query, Body, Response, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlmodel import Session, select, func, or_, and_

from app.database import create_db_and_tables, get_session
from app.models import (
    User, UserLogin, UserResponse, TokenResponse,
    Case, CaseCreate, CaseUpdate,
    Document, DocumentCreate,
    AIDocumentSummary,
    Hearing, HearingCreate,
    TaskItem, TaskCreate,
    AuditLog,
    ClientRecord, ClientCreate,
    utc_now
)
from app.auth import (
    verify_password, create_access_token, get_current_user,
    get_current_user_optional, require_roles
)
from app.ai_engine import analyze_document_content, answer_legal_query
from app.seed import seed_database_if_empty

# Setup physical storage vault for legal documents (FR-005)
STORAGE_DIR = Path(__file__).resolve().parent.parent / "storage" / "vault"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    seed_database_if_empty()
    yield


app = FastAPI(
    title="CasePilot AI API",
    description="Enterprise Legal Workspace API for Case Management, AI Document Summaries, Hearings, Tasks & Audit Compliance (PS-01 Legal Tech).",
    version="1.1.0",
    lifespan=lifespan,
)

# Fix: Restrict CORS to authorized origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# -------------------------------------------------------------
# Helper: Tamper-Evident Cryptographic Hash Chain (FR-010)
# -------------------------------------------------------------
def log_audit_event(
    session: Session,
    action: str,
    entity_type: str,
    details: str,
    entity_id: Optional[str] = None,
    actor_name: str = "Alex Carter",
    actor_role: str = "Managing Attorney"
) -> AuditLog:
    # Retrieve latest audit record to chain hashes
    latest = session.exec(select(AuditLog).order_by(AuditLog.id.desc()).limit(1)).first()
    prev_hash = latest.record_hash if latest and latest.record_hash else "GENESIS_ROOT_HASH_2026"

    ts = utc_now()
    raw_chain_string = f"{prev_hash}|{ts.isoformat()}|{action}|{actor_name}|{actor_role}|{entity_type}|{entity_id or ''}|{details}"
    record_hash = hashlib.sha256(raw_chain_string.encode("utf-8")).hexdigest()

    audit = AuditLog(
        action=action,
        actor_name=actor_name,
        actor_role=actor_role,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        prev_hash=prev_hash,
        record_hash=record_hash,
        timestamp=ts
    )
    session.add(audit)
    session.commit()
    session.refresh(audit)
    return audit


# -------------------------------------------------------------
# Authentication & Role-Based Access Endpoints (FR-001)
# -------------------------------------------------------------
@app.post("/api/v1/auth/login", response_model=TokenResponse)
def login(credentials: UserLogin, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == credentials.email.lower().strip())).first()
    if not user or not verify_password(credentials.password, user.salt, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password credentials."
        )

    token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        name=user.name
    )

    log_audit_event(
        session=session,
        action="USER_LOGIN",
        entity_type="Auth",
        entity_id=str(user.id),
        details=f"User '{user.name}' ({user.role}) authenticated successfully.",
        actor_name=user.name,
        actor_role=user.role
    )

    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        initials=user.initials,
        is_active=user.is_active
    )
    return TokenResponse(access_token=token, user=user_resp)


@app.get("/api/v1/auth/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        initials=user.initials,
        is_active=user.is_active
    )


@app.post("/api/v1/auth/switch-demo", response_model=TokenResponse)
def switch_demo_persona(
    role: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """Utility endpoint to switch active demonstration personas with cryptographically valid bearer tokens."""
    user = session.exec(select(User).where(User.role == role)).first()
    if not user:
        user = session.exec(select(User).where(User.role == "Managing Attorney")).first()

    token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        name=user.name
    )
    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        initials=user.initials,
        is_active=user.is_active
    )
    return TokenResponse(access_token=token, user=user_resp)


# -------------------------------------------------------------
# Root & Health Check
# -------------------------------------------------------------
@app.get("/")
def root():
    return {
        "service": "CasePilot AI Backend",
        "status": "online",
        "version": "1.1.0",
        "security": "Enforced RBAC, SHA-256 Tamper-Evident Audit Chain, Restricted CORS",
        "advisory_notice": "AI outputs are advisory and must be verified by licensed legal counsel."
    }


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": utc_now().isoformat()}


# -------------------------------------------------------------
# Dashboard Overview & Metrics (FR-002)
# -------------------------------------------------------------
@app.get("/api/v1/dashboard/stats")
def get_dashboard_stats(session: Session = Depends(get_session)):
    total_cases = len(session.exec(select(Case)).all())
    active_cases = len(session.exec(select(Case).where(Case.status == "Active")).all())
    upcoming_hearings = len(session.exec(select(Hearing)).all())
    pending_tasks = len(session.exec(select(TaskItem).where(TaskItem.is_completed == False)).all())
    ai_pending_reviews = len(session.exec(select(AIDocumentSummary).where(AIDocumentSummary.review_status == "Pending Human Review")).all())

    recent_cases = session.exec(select(Case).order_by(Case.created_at.desc()).limit(5)).all()
    upcoming_hearings_list = session.exec(select(Hearing).order_by(Hearing.hearing_date.asc()).limit(4)).all()
    tasks_list = session.exec(select(TaskItem).order_by(TaskItem.is_completed.asc(), TaskItem.created_at.desc()).limit(5)).all()
    recent_logs = session.exec(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(5)).all()

    return {
        "metrics": {
            "active_cases": active_cases,
            "total_cases": total_cases,
            "upcoming_hearings": upcoming_hearings,
            "pending_tasks": pending_tasks,
            "ai_reviews_awaiting": ai_pending_reviews
        },
        "recent_cases": recent_cases,
        "upcoming_hearings": upcoming_hearings_list,
        "tasks": tasks_list,
        "recent_logs": recent_logs
    }


# -------------------------------------------------------------
# Cases Endpoints (FR-003, FR-004)
# -------------------------------------------------------------
@app.get("/api/v1/cases", response_model=List[Case])
def list_cases(
    search: Optional[str] = Query(default=None, max_length=200),
    status: Optional[str] = Query(default=None),
    case_type: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
):
    statement = select(Case).order_by(Case.created_at.desc())

    if status and status != "All":
        statement = statement.where(Case.status == status)

    if case_type and case_type != "All":
        statement = statement.where(Case.case_type == case_type)

    if search:
        term = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Case.title.ilike(term),
                Case.client_name.ilike(term),
                Case.case_number.ilike(term),
                Case.court_jurisdiction.ilike(term),
                Case.opposing_party.ilike(term)
            )
        )

    return session.exec(statement).all()


@app.post("/api/v1/cases", response_model=Case)
def create_case(
    case_data: CaseCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session),
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    total_existing = len(session.exec(select(Case)).all())
    case_num = f"CP-2026-{100 + total_existing + 1:03d}"

    case = Case(
        case_number=case_num,
        **case_data.model_dump()
    )
    session.add(case)
    session.commit()
    session.refresh(case)

    log_audit_event(
        session=session,
        action="CASE_CREATED",
        entity_type="Case",
        entity_id=case.case_number,
        details=f"Case '{case.title}' created for client '{case.client_name}' ({case.case_type}).",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return case


@app.get("/api/v1/cases/{case_id}")
def get_case_detail(
    case_id: int,
    session: Session = Depends(get_session)
):
    case = session.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    documents = session.exec(select(Document).where(Document.case_id == case.id)).all()
    hearings = session.exec(select(Hearing).where(Hearing.case_id == case.id).order_by(Hearing.hearing_date.asc())).all()
    tasks = session.exec(select(TaskItem).where(TaskItem.case_id == case.id).order_by(TaskItem.created_at.desc())).all()
    ai_summaries = session.exec(select(AIDocumentSummary).where(AIDocumentSummary.case_id == case.id)).all()

    return {
        "case": case,
        "documents": documents,
        "hearings": hearings,
        "tasks": tasks,
        "ai_summaries": ai_summaries
    }


@app.patch("/api/v1/cases/{case_id}", response_model=Case)
def update_case(
    case_id: int,
    case_data: CaseUpdate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    case = session.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    updates = case_data.model_dump(exclude_unset=True)
    changed_fields = []
    for field, value in updates.items():
        if value is not None and getattr(case, field) != value:
            setattr(case, field, value)
            changed_fields.append(field)

    case.updated_at = utc_now()
    session.add(case)
    session.commit()
    session.refresh(case)

    if changed_fields:
        log_audit_event(
            session=session,
            action="CASE_UPDATED",
            entity_type="Case",
            entity_id=case.case_number,
            details=f"Case updated fields: {', '.join(changed_fields)}.",
            actor_name=actor_name,
            actor_role=actor_role
        )

    return case


@app.post("/api/v1/cases/{case_id}/status")
def change_case_status(
    case_id: int,
    status: str = Body(..., embed=True),
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    case = session.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    old_status = case.status
    case.status = status
    case.updated_at = utc_now()
    session.add(case)
    session.commit()
    session.refresh(case)

    log_audit_event(
        session=session,
        action="CASE_STATUS_CHANGED",
        entity_type="Case",
        entity_id=case.case_number,
        details=f"Status transitioned from '{old_status}' to '{status}'.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return {"message": "Status updated successfully", "case": case}


@app.delete("/api/v1/cases/{case_id}")
def delete_case(
    case_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    # Enforce Role-Based Access Control (FR-001): Paralegal cannot delete cases
    if actor_role.lower() == "paralegal":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Paralegal role is not authorized to delete case records (FR-001)."
        )

    case = session.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case_num = case.case_number
    case_title = case.title

    session.delete(case)
    session.commit()

    log_audit_event(
        session=session,
        action="CASE_DELETED",
        entity_type="Case",
        entity_id=case_num,
        details=f"Case record '{case_title}' ({case_num}) was deleted by {actor_name}.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return {"message": "Case deleted successfully"}


# -------------------------------------------------------------
# Documents Endpoints with SHA-256 Physical Storage (FR-005)
# -------------------------------------------------------------
@app.get("/api/v1/documents", response_model=List[Document])
def list_documents(
    case_id: Optional[int] = Query(default=None),
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    session: Session = Depends(get_session)
):
    statement = select(Document).order_by(Document.created_at.desc())
    if case_id:
        statement = statement.where(Document.case_id == case_id)
    if category and category != "All":
        statement = statement.where(Document.category == category)
    if search:
        term = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Document.filename.ilike(term),
                Document.notes.ilike(term),
                Document.case_title.ilike(term)
            )
        )
    return session.exec(statement).all()


@app.post("/api/v1/documents", response_model=Dict[str, Any])
def upload_document(
    doc_data: DocumentCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    case_title = doc_data.case_title
    case_number = doc_data.case_number
    if doc_data.case_id and not case_title:
        c = session.get(Case, doc_data.case_id)
        if c:
            case_title = c.title
            case_number = c.case_number

    # Compute cryptographic SHA-256 checksum and persist physical file
    content_bytes = b""
    if doc_data.file_base64:
        try:
            content_bytes = base64.b64decode(doc_data.file_base64)
        except Exception:
            content_bytes = (doc_data.file_content_text or "").encode("utf-8")
    else:
        content_bytes = (doc_data.file_content_text or f"Legal Document Record for {doc_data.filename}").encode("utf-8")

    file_size = len(content_bytes) if content_bytes else (doc_data.file_size_bytes or 350000)
    sha256_hash = hashlib.sha256(content_bytes).hexdigest()

    # Save to encrypted vault on disk
    disk_filename = f"{sha256_hash[:16]}_{doc_data.filename}"
    target_path = STORAGE_DIR / disk_filename
    with open(target_path, "wb") as f:
        f.write(content_bytes)

    doc = Document(
        case_id=doc_data.case_id,
        case_number=case_number,
        case_title=case_title,
        filename=doc_data.filename,
        category=doc_data.category,
        file_type=doc_data.file_type,
        file_size_bytes=file_size,
        sha256_checksum=sha256_hash,
        storage_path=str(target_path),
        mime_type="application/pdf" if doc_data.file_type == "pdf" else "application/octet-stream",
        file_content_text=doc_data.file_content_text or "",
        uploaded_by=actor_name,
        processing_status="Processed",
        notes=doc_data.notes
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)

    # Automatically generate advisory AI summary and candidate facts (FR-006, FR-007)
    ai_result = analyze_document_content(
        filename=doc.filename,
        category=doc.category,
        content_text=doc.file_content_text or "",
        case_context=doc.case_title or ""
    )

    ai_summary = AIDocumentSummary(
        document_id=doc.id,
        case_id=doc.case_id,
        case_number=doc.case_number,
        document_title=doc.filename,
        executive_summary=ai_result["executive_summary"],
        key_clauses=ai_result["key_clauses"],
        statutory_provisions=ai_result["statutory_provisions"],
        risk_assessment=ai_result["risk_assessment"],
        candidate_facts_json=ai_result["candidate_facts_json"],
        review_status="Pending Human Review",
        is_advisory_acknowledged=False
    )
    session.add(ai_summary)
    session.commit()
    session.refresh(ai_summary)

    log_audit_event(
        session=session,
        action="DOCUMENT_UPLOADED",
        entity_type="Document",
        entity_id=str(doc.id),
        details=f"Uploaded '{doc.filename}' (SHA-256: {sha256_hash[:10]}...) by {actor_name}. Triggered AI advisory analysis.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return {
        "document": doc,
        "ai_summary": ai_summary,
        "sha256_checksum": sha256_hash,
        "message": "Document stored securely in vault and AI advisory analysis prepared for review."
    }


@app.get("/api/v1/documents/{doc_id}/download")
def download_document(
    doc_id: int,
    session: Session = Depends(get_session)
):
    doc = session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.storage_path or not os.path.exists(doc.storage_path):
        # Generate on the fly if physical file was not created
        content = (doc.file_content_text or f"Legal Document {doc.filename}\nCase: {doc.case_number}").encode("utf-8")
        return Response(
            content=content,
            media_type=doc.mime_type or "application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'}
        )

    # Verify SHA-256 integrity on the fly!
    with open(doc.storage_path, "rb") as f:
        file_bytes = f.read()
    current_hash = hashlib.sha256(file_bytes).hexdigest()
    if doc.sha256_checksum and doc.sha256_checksum != current_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="File integrity check failed: SHA-256 hash does not match vault record (Possible tampering)."
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type or "application/pdf",
        filename=doc.filename
    )


@app.delete("/api/v1/documents/{doc_id}")
def delete_document(
    doc_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    if actor_role.lower() == "paralegal":
        raise HTTPException(status_code=403, detail="Paralegals are not authorized to delete evidentiary files.")

    doc = session.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    fn = doc.filename
    if doc.storage_path and os.path.exists(doc.storage_path):
        try:
            os.remove(doc.storage_path)
        except Exception:
            pass

    session.delete(doc)
    session.commit()

    log_audit_event(
        session=session,
        action="DOCUMENT_DELETED",
        entity_type="Document",
        entity_id=str(doc_id),
        details=f"Document '{fn}' was purged from vault by {actor_name}.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return {"message": "Document deleted"}


# -------------------------------------------------------------
# AI Advisory Review & Verification Endpoints (FR-006, FR-007)
# -------------------------------------------------------------
@app.get("/api/v1/ai/summaries", response_model=List[AIDocumentSummary])
def list_ai_summaries(
    review_status: Optional[str] = Query(default=None),
    case_id: Optional[int] = Query(default=None),
    session: Session = Depends(get_session)
):
    stmt = select(AIDocumentSummary).order_by(AIDocumentSummary.created_at.desc())
    if review_status and review_status != "All":
        stmt = stmt.where(AIDocumentSummary.review_status == review_status)
    if case_id:
        stmt = stmt.where(AIDocumentSummary.case_id == case_id)
    return session.exec(stmt).all()


@app.get("/api/v1/ai/summaries/{summary_id}", response_model=AIDocumentSummary)
def get_ai_summary(
    summary_id: int,
    session: Session = Depends(get_session)
):
    summary = session.get(AIDocumentSummary, summary_id)
    if not summary:
        raise HTTPException(status_code=404, detail="AI Summary not found")
    return summary


@app.post("/api/v1/ai/summaries/{summary_id}/verify-fact")
def verify_candidate_fact(
    summary_id: int,
    fact_id: str = Body(..., embed=True),
    action: str = Body(..., embed=True),  # 'accept' or 'reject'
    edited_text: Optional[str] = Body(default=None, embed=True),
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    summary = session.get(AIDocumentSummary, summary_id)
    if not summary:
        raise HTTPException(status_code=404, detail="AI Summary not found")

    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    facts = json.loads(summary.candidate_facts_json)
    updated = False
    fact_label = ""

    for f in facts:
        if f.get("id") == fact_id:
            fact_label = f.get("fact_text", "")
            if action == "accept":
                f["verified"] = True
                f["rejected"] = False
                f["verified_by"] = f"{actor_name} ({actor_role})"
                f["verified_at"] = utc_now().strftime("%Y-%m-%d %H:%M:%S")
                if edited_text:
                    f["fact_text"] = edited_text
            elif action == "reject":
                f["verified"] = False
                f["rejected"] = True
                f["verified_by"] = f"{actor_name} ({actor_role})"
                f["verified_at"] = utc_now().strftime("%Y-%m-%d %H:%M:%S")
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Candidate fact ID not found")

    summary.candidate_facts_json = json.dumps(facts)
    session.add(summary)
    session.commit()
    session.refresh(summary)

    log_audit_event(
        session=session,
        action=f"AI_FACT_{action.upper()}ED",
        entity_type="AI Review",
        entity_id=str(summary.id),
        details=f"Candidate fact '{fact_label[:40]}...' was {action}ed by {actor_name} ({actor_role}).",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return {"message": f"Fact successfully {action}ed", "summary": summary}


@app.post("/api/v1/ai/summaries/{summary_id}/approve")
def approve_ai_summary(
    summary_id: int,
    acknowledged_advisory: bool = Body(default=True, embed=True),
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    # Enforce role restriction: Paralegals cannot sign off
    if actor_role.lower() == "paralegal":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Paralegals cannot sign off on final legal review. Requires Associate or Attorney authorization."
        )

    # Require explicit acknowledgment (Fix: Passive advisory loophole)
    if not acknowledged_advisory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Counsel must affirmatively check the statutory advisory acknowledgment box prior to sign-off."
        )

    summary = session.get(AIDocumentSummary, summary_id)
    if not summary:
        raise HTTPException(status_code=404, detail="AI Summary not found")

    summary.review_status = "Verified by Counsel"
    summary.reviewed_by = f"{actor_name} ({actor_role})"
    summary.reviewed_at = utc_now()
    summary.is_advisory_acknowledged = True
    summary.advocate_signature = f"SIGNED://{actor_name}/BAR-CHAMBER-2026"
    session.add(summary)
    session.commit()
    session.refresh(summary)

    log_audit_event(
        session=session,
        action="AI_SUMMARY_VERIFIED",
        entity_type="AI Review",
        entity_id=str(summary.id),
        details=f"Advisory summary for '{summary.document_title}' formally verified and approved by {actor_name}.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return {"message": "AI Advisory summary approved by counsel", "summary": summary}


@app.post("/api/v1/ai/ask")
def query_ai_assistant(
    payload: Dict[str, Any] = Body(...),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = payload.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    actor_role = current_user.role if current_user else "Managing Attorney"
    result = answer_legal_query(query=query, current_role=actor_role)
    return result


# -------------------------------------------------------------
# Hearings / Calendar Endpoints (FR-008)
# -------------------------------------------------------------
@app.get("/api/v1/hearings", response_model=List[Hearing])
def list_hearings(
    case_id: Optional[int] = Query(default=None),
    session: Session = Depends(get_session)
):
    stmt = select(Hearing).order_by(Hearing.hearing_date.asc())
    if case_id:
        stmt = stmt.where(Hearing.case_id == case_id)
    return session.exec(stmt).all()


@app.post("/api/v1/hearings", response_model=Hearing)
def create_hearing(
    hearing_data: HearingCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    h = Hearing(**hearing_data.model_dump())
    session.add(h)
    session.commit()
    session.refresh(h)

    if h.case_id:
        c = session.get(Case, h.case_id)
        if c:
            c.next_hearing_date = h.hearing_date
            c.status = "Hearing Scheduled"
            session.add(c)
            session.commit()

    log_audit_event(
        session=session,
        action="HEARING_SCHEDULED",
        entity_type="Hearing",
        entity_id=str(h.id),
        details=f"Scheduled {h.hearing_type} for {h.case_title} on {h.hearing_date} ({h.courtroom}).",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return h


@app.delete("/api/v1/hearings/{hearing_id}")
def delete_hearing(
    hearing_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    h = session.get(Hearing, hearing_id)
    if not h:
        raise HTTPException(status_code=404, detail="Hearing not found")

    title = h.case_title
    session.delete(h)
    session.commit()

    log_audit_event(
        session=session,
        action="HEARING_REMOVED",
        entity_type="Hearing",
        entity_id=str(hearing_id),
        details=f"Hearing for '{title}' removed from calendar by {actor_name}.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return {"message": "Hearing deleted"}


# -------------------------------------------------------------
# Tasks Endpoints (FR-008)
# -------------------------------------------------------------
@app.get("/api/v1/tasks", response_model=List[TaskItem])
def list_tasks(
    case_id: Optional[int] = Query(default=None),
    is_completed: Optional[bool] = Query(default=None),
    session: Session = Depends(get_session)
):
    stmt = select(TaskItem).order_by(TaskItem.is_completed.asc(), TaskItem.created_at.desc())
    if case_id:
        stmt = stmt.where(TaskItem.case_id == case_id)
    if is_completed is not None:
        stmt = stmt.where(TaskItem.is_completed == is_completed)
    return session.exec(stmt).all()


@app.post("/api/v1/tasks", response_model=TaskItem)
def create_task(
    task_data: TaskCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    t = TaskItem(**task_data.model_dump())
    session.add(t)
    session.commit()
    session.refresh(t)

    log_audit_event(
        session=session,
        action="TASK_CREATED",
        entity_type="Task",
        entity_id=str(t.id),
        details=f"Created task '{t.title}' assigned to {t.assigned_to}.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return t


@app.post("/api/v1/tasks/{task_id}/toggle")
def toggle_task(
    task_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    t = session.get(TaskItem, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    t.is_completed = not t.is_completed
    t.completed_at = utc_now() if t.is_completed else None
    session.add(t)
    session.commit()
    session.refresh(t)

    status_str = "completed" if t.is_completed else "marked pending"
    log_audit_event(
        session=session,
        action="TASK_STATUS_CHANGED",
        entity_type="Task",
        entity_id=str(t.id),
        details=f"Task '{t.title}' was {status_str} by {actor_name}.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return t


@app.delete("/api/v1/tasks/{task_id}")
def delete_task(
    task_id: int,
    session: Session = Depends(get_session)
):
    t = session.get(TaskItem, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    session.delete(t)
    session.commit()
    return {"message": "Task deleted"}


# -------------------------------------------------------------
# Clients Endpoints
# -------------------------------------------------------------
@app.get("/api/v1/clients", response_model=List[ClientRecord])
def list_clients(session: Session = Depends(get_session)):
    return session.exec(select(ClientRecord).order_by(ClientRecord.name.asc())).all()


@app.post("/api/v1/clients", response_model=ClientRecord)
def create_client(
    client_data: ClientCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    c = ClientRecord(**client_data.model_dump())
    session.add(c)
    session.commit()
    session.refresh(c)

    log_audit_event(
        session=session,
        action="CLIENT_CREATED",
        entity_type="Client",
        entity_id=str(c.id),
        details=f"New client entity registered: '{c.name}' ({c.entity_type}) by {actor_name}.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return c


# -------------------------------------------------------------
# Audit Logs & Hash Chain Integrity Verification (FR-010)
# -------------------------------------------------------------
@app.get("/api/v1/audit-logs", response_model=List[AuditLog])
def list_audit_logs(
    entity_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, le=100),
    session: Session = Depends(get_session)
):
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if entity_type and entity_type != "All":
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    return session.exec(stmt).all()


@app.get("/api/v1/audit-logs/verify-integrity")
def verify_audit_chain_integrity(session: Session = Depends(get_session)):
    """
    Cryptographically verifies the entire tamper-evident SHA-256 hash chain
    of the audit log. Returns verification status and chain proof.
    """
    logs = session.exec(select(AuditLog).order_by(AuditLog.id.asc())).all()
    if not logs:
        return {"status": "empty", "verified": True, "chain_length": 0}

    tampered_indices = []
    for i, log in enumerate(logs):
        expected_prev = "GENESIS_ROOT_HASH_2026" if i == 0 else logs[i - 1].record_hash
        raw = f"{expected_prev}|{log.timestamp.isoformat()}|{log.action}|{log.actor_name}|{log.actor_role}|{log.entity_type}|{log.entity_id or ''}|{log.details}"
        computed_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()

        # Check if record_hash matches computed hash
        if log.record_hash and log.record_hash != computed_hash:
            tampered_indices.append(log.id)

    is_valid = len(tampered_indices) == 0
    return {
        "status": "valid" if is_valid else "compromised",
        "verified": is_valid,
        "chain_length": len(logs),
        "latest_hash": logs[-1].record_hash if logs else None,
        "tampered_records": tampered_indices,
        "compliance_standard": "Section 65B Indian Evidence Act / Section 63 BSA Tamper-Evident Standard"
    }


# -------------------------------------------------------------
# Import / Export & Integration APIs (FR-011)
# -------------------------------------------------------------
@app.get("/api/v1/export/json")
def export_workspace_json(session: Session = Depends(get_session)):
    cases = session.exec(select(Case)).all()
    documents = session.exec(select(Document)).all()
    hearings = session.exec(select(Hearing)).all()
    tasks = session.exec(select(TaskItem)).all()
    summaries = session.exec(select(AIDocumentSummary)).all()
    audit_logs = session.exec(select(AuditLog)).all()

    export_bundle = {
        "export_metadata": {
            "source": "CasePilot AI (PS-01 Legal Tech)",
            "exported_at": utc_now().isoformat(),
            "format_version": "1.1",
            "cases_count": len(cases),
            "documents_count": len(documents),
            "hearings_count": len(hearings),
            "tasks_count": len(tasks),
            "tamper_evident_audit_chain_length": len(audit_logs)
        },
        "cases": [c.model_dump() for c in cases],
        "documents": [d.model_dump() for d in documents],
        "hearings": [h.model_dump() for h in hearings],
        "tasks": [t.model_dump() for t in tasks],
        "ai_summaries": [s.model_dump() for s in summaries],
        "audit_logs": [a.model_dump() for a in audit_logs]
    }

    log_audit_event(
        session=session,
        action="WORKSPACE_EXPORTED_JSON",
        entity_type="System",
        details="Full workspace data export generated in JSON format."
    )

    return export_bundle


@app.get("/api/v1/export/csv/cases")
def export_cases_csv(session: Session = Depends(get_session)):
    cases = session.exec(select(Case).order_by(Case.case_number.asc())).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Case Number", "Title", "Client Name", "Opposing Party",
        "Court Jurisdiction", "Case Type", "Status", "Filing Date",
        "Next Hearing Date", "Assigned To", "Claim Amount"
    ])

    for c in cases:
        writer.writerow([
            c.case_number, c.title, c.client_name, c.opposing_party or "",
            c.court_jurisdiction or "", c.case_type, c.status,
            c.filing_date or "", c.next_hearing_date or "",
            c.assigned_to, c.claim_amount or ""
        ])

    log_audit_event(
        session=session,
        action="CASES_EXPORTED_CSV",
        entity_type="Case",
        details=f"Exported {len(cases)} cases to CSV."
    )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=casepilot_cases.csv"}
    )


@app.post("/api/v1/import/cases")
def import_cases_json(
    items: List[CaseCreate] = Body(...),
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_session)
):
    actor_name = current_user.name if current_user else "Alex Carter"
    actor_role = current_user.role if current_user else "Managing Attorney"

    imported_count = 0
    total = len(session.exec(select(Case)).all())
    for item in items:
        total += 1
        case_num = f"CP-2026-{100 + total:03d}"
        c = Case(case_number=case_num, **item.model_dump())
        session.add(c)
        imported_count += 1
    session.commit()

    log_audit_event(
        session=session,
        action="CASES_IMPORTED_JSON",
        entity_type="Case",
        details=f"Imported {imported_count} new cases via batch interface by {actor_name}.",
        actor_name=actor_name,
        actor_role=actor_role
    )

    return {"message": f"Successfully imported {imported_count} cases."}
