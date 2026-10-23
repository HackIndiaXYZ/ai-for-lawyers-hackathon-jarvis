import hashlib
import json
import os
from pathlib import Path
from datetime import datetime
from sqlmodel import Session, select
from app.database import engine
from app.models import (
    User, Case, Document, AIDocumentSummary, Hearing, TaskItem, AuditLog, ClientRecord, utc_now
)
from app.auth import generate_salt, hash_password
from app.ai_engine import analyze_document_content

STORAGE_DIR = Path(__file__).resolve().parent.parent / "storage" / "vault"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def seed_database_if_empty():
    with Session(engine) as session:
        # Check if users already exist
        existing_users = session.exec(select(User)).first()
        if existing_users:
            return  # Already seeded

        print("Seeding initial CasePilot AI database with security & authentication...")

        # 1. Seed Real Users (FR-001)
        users_seed = [
            ("arjun.kapoor@lexford.legal", "Arjun Kapoor", "Managing Attorney", "attorney123", "AK"),
            ("priya.nair@lexford.legal", "Priya Nair", "Senior Associate", "associate123", "PN"),
            ("rohan.gupta@lexford.legal", "Rohan Gupta", "Paralegal", "paralegal123", "RG"),
            ("kavita.desai@lexford.legal", "Kavita Desai", "Compliance Officer", "compliance123", "KD"),
        ]

        created_users = []
        for email, name, role, plain_pw, initials in users_seed:
            salt = generate_salt()
            hashed_pw = hash_password(plain_pw, salt)
            u = User(
                email=email,
                name=name,
                role=role,
                hashed_password=hashed_pw,
                salt=salt,
                initials=initials,
                is_active=True
            )
            session.add(u)
            created_users.append(u)
        session.commit()

        # 2. Seed Clients
        c1 = ClientRecord(
            name="Aarav Sharma",
            entity_type="Individual",
            contact_email="aarav.sharma@sharmatech.in",
            contact_phone="+91 98110 24510",
            address="Vasant Vihar, New Delhi",
            active_cases_count=1,
            notes="Managing Director, Sharma Heavy Precision Systems."
        )
        c2 = ClientRecord(
            name="Priya Mehta",
            entity_type="Individual",
            contact_email="priya.mehta@outlook.com",
            contact_phone="+91 98201 88921",
            address="Greater Kailash II, New Delhi",
            active_cases_count=1,
            notes="Co-owner in partition and ancestral property injunction."
        )
        c3 = ClientRecord(
            name="Northstar Trading Pte Ltd",
            entity_type="Corporate",
            contact_email="legal@northstartrading.sg",
            contact_phone="+65 6721 9010",
            address="Marina Bay Financial Centre, Singapore",
            active_cases_count=1,
            notes="International commodities & technology trading firm."
        )
        c4 = ClientRecord(
            name="K. Rao",
            entity_type="Individual",
            contact_email="k.rao@cyberinfra.net",
            contact_phone="+91 97410 44321",
            address="Indiranagar, Bengaluru",
            active_cases_count=1,
            notes="Former VP Engineering challenging wrongful termination."
        )
        session.add_all([c1, c2, c3, c4])
        session.commit()

        # 3. Seed Cases
        case1 = Case(
            case_number="CP-2026-024",
            title="Sharma vs. Eastern Industries",
            client_name="Aarav Sharma",
            client_email="aarav.sharma@sharmatech.in",
            client_phone="+91 98110 24510",
            opposing_party="Eastern Heavy Industries Ltd.",
            opposing_counsel="Adv. Vikram Malhotra & Associates",
            court_jurisdiction="District Civil Court Saket · Courtroom 4",
            judge_name="Hon'ble Judge R. K. Singhal",
            case_type="Commercial Dispute",
            status="Active",
            filing_date="2026-07-22",
            next_hearing_date="2026-10-23",
            assigned_to="Arjun Kapoor",
            priority="High",
            claim_amount="₹45,00,000",
            notes="Action for damages and specific performance following breach of machinery supply contract."
        )

        case2 = Case(
            case_number="CP-2026-018",
            title="Mehta Property Dispute",
            client_name="Priya Mehta",
            client_email="priya.mehta@outlook.com",
            client_phone="+91 98201 88921",
            opposing_party="Sunil Mehta & Rajesh Mehta",
            opposing_counsel="Adv. S. Sundaram",
            court_jurisdiction="Civil Court Saket · Courtroom 2",
            judge_name="Hon'ble Judge Ananya Sen",
            case_type="Property Partition",
            status="Active",
            filing_date="2026-08-10",
            next_hearing_date="2026-10-26",
            assigned_to="Arjun Kapoor",
            priority="High",
            claim_amount="₹2,10,00,000",
            notes="Partition suit & Order 39 interim injunction restraining co-owners from alienating ancestral bungalow."
        )

        case3 = Case(
            case_number="CP-2026-031",
            title="Verma Contract Review",
            client_name="Northstar Trading Pte Ltd",
            client_email="legal@northstartrading.sg",
            client_phone="+65 6721 9010",
            opposing_party="Verma Enterprise Systems",
            opposing_counsel="In-house Counsel (Bangalore)",
            court_jurisdiction="Arbitration Tribunal · Room A",
            judge_name="Justice (Retd.) B. N. Srikrishna",
            case_type="Commercial Contract",
            status="In Review",
            filing_date="2026-09-01",
            next_hearing_date="2026-10-29",
            assigned_to="Arjun Kapoor",
            priority="Medium",
            claim_amount="₹85,00,000",
            notes="Cross-border master SaaS software licensing agreement renegotiation and SLA violation audit."
        )

        case4 = Case(
            case_number="CP-2026-012",
            title="Rao Employment Matter",
            client_name="K. Rao",
            client_email="k.rao@cyberinfra.net",
            client_phone="+91 97410 44321",
            opposing_party="CyberInfra Global Ltd.",
            opposing_counsel="Khaitan Legal Associates",
            court_jurisdiction="Labour & Industrial Court",
            judge_name="Presiding Officer D. Joshi",
            case_type="Employment",
            status="On Hold",
            filing_date="2026-06-15",
            next_hearing_date="2026-11-12",
            assigned_to="Priya Nair",
            priority="Low",
            claim_amount="₹32,00,000",
            notes="Wrongful termination, clawback of vested stock options, and ungrounded non-compete enforcement."
        )

        case5 = Case(
            case_number="CP-2026-045",
            title="Apex Pharma Patent Infringement",
            client_name="Apex Life Sciences",
            client_email="counsel@apexpharma.com",
            client_phone="+91 99000 12345",
            opposing_party="BioGenetics Laboratories",
            opposing_counsel="Shardul Amarchand Legal",
            court_jurisdiction="High Court Commercial Bench · Courtroom 1",
            judge_name="Hon'ble Justice P. S. Narayana",
            case_type="Intellectual Property",
            status="Active",
            filing_date="2026-09-18",
            next_hearing_date="2026-11-04",
            assigned_to="Arjun Kapoor",
            priority="High",
            claim_amount="₹5,50,00,000",
            notes="Suit under Section 108 of Patents Act 1970 for interim injunction on biosimilar composition."
        )

        session.add_all([case1, case2, case3, case4, case5])
        session.commit()

        # 4. Helper to create physical files with SHA-256 hash (FR-005)
        def create_vault_file(filename: str, sample_text: str):
            content_bytes = sample_text.encode("utf-8")
            h = hashlib.sha256(content_bytes).hexdigest()
            path = STORAGE_DIR / f"{h[:16]}_{filename}"
            with open(path, "wb") as f:
                f.write(content_bytes)
            return str(path), h, len(content_bytes)

        path1, fhash1, sz1 = create_vault_file("Notice_of_Breach_Eastern_Industries.pdf", "LEGAL NOTICE: Formal default notice dated 10 April 2026 demanding delivery under Master Supply Agreement.")
        doc1 = Document(
            case_id=case1.id,
            case_number=case1.case_number,
            case_title=case1.title,
            filename="Notice_of_Breach_Eastern_Industries.pdf",
            category="Notice",
            file_type="pdf",
            file_size_bytes=sz1,
            sha256_checksum=fhash1,
            storage_path=path1,
            file_content_text="Legal Demand Notice issued on 10 April 2026 demanding delivery under Master Supply Agreement.",
            uploaded_by="Arjun Kapoor",
            processing_status="Processed",
            notes="Formal demand notice before civil suit."
        )

        path2, fhash2, sz2 = create_vault_file("Commercial_Supply_Agreement_2024.docx", "AGREEMENT: Master Agreement dated March 12, 2024 containing liquidated damages clause 14 and jurisdiction clause 22.")
        doc2 = Document(
            case_id=case1.id,
            case_number=case1.case_number,
            case_title=case1.title,
            filename="Commercial_Supply_Agreement_2024.docx",
            category="Contract",
            file_type="docx",
            file_size_bytes=sz2,
            sha256_checksum=fhash2,
            storage_path=path2,
            file_content_text="Master Agreement dated March 12, 2024 containing liquidated damages clause 14 and jurisdiction clause 22.",
            uploaded_by="Arjun Kapoor",
            processing_status="Processed",
            notes="Governing supply contract."
        )

        path3, fhash3, sz3 = create_vault_file("Saket_Court_Interim_Injunction_Application.pdf", "INJUNCTION APPLICATION: Application under Order 39 Rules 1 & 2 read with Section 151 CPC for urgent status quo orders.")
        doc3 = Document(
            case_id=case2.id,
            case_number=case2.case_number,
            case_title=case2.title,
            filename="Saket_Court_Interim_Injunction_Application.pdf",
            category="Petition",
            file_type="pdf",
            file_size_bytes=sz3,
            sha256_checksum=fhash3,
            storage_path=path3,
            file_content_text="Application under Order 39 Rules 1 & 2 read with Section 151 CPC for urgent status quo orders.",
            uploaded_by="Arjun Kapoor",
            processing_status="Processed",
            notes="Urgent ad-interim stay application."
        )

        path4, fhash4, sz4 = create_vault_file("Software_Licensing_Master_Agreement_v3.pdf", "SOFTWARE LICENSING AGREEMENT: SaaS master agreement between Northstar Trading and Verma Tech with SIAC arbitration.")
        doc4 = Document(
            case_id=case3.id,
            case_number=case3.case_number,
            case_title=case3.title,
            filename="Software_Licensing_Master_Agreement_v3.pdf",
            category="Contract",
            file_type="pdf",
            file_size_bytes=sz4,
            sha256_checksum=fhash4,
            storage_path=path4,
            file_content_text="SaaS master agreement between Northstar Trading and Verma Tech. Contains SIAC arbitration clause.",
            uploaded_by="Arjun Kapoor",
            processing_status="Processed",
            notes="Audit copy with redline comments."
        )

        session.add_all([doc1, doc2, doc3, doc4])
        session.commit()

        # 5. Seed AI Advisory Summaries (FR-006, FR-007)
        ai1_data = analyze_document_content(doc1.filename, doc1.category, doc1.file_content_text, case1.title)
        ai_summary1 = AIDocumentSummary(
            document_id=doc1.id,
            case_id=case1.id,
            case_number=case1.case_number,
            document_title=doc1.filename,
            executive_summary=ai1_data["executive_summary"],
            key_clauses=ai1_data["key_clauses"],
            statutory_provisions=ai1_data["statutory_provisions"],
            risk_assessment=ai1_data["risk_assessment"],
            candidate_facts_json=ai1_data["candidate_facts_json"],
            review_status="Pending Human Review",
            is_advisory_acknowledged=False
        )

        ai2_data = analyze_document_content(doc3.filename, doc3.category, doc3.file_content_text, case2.title)
        ai_summary2 = AIDocumentSummary(
            document_id=doc3.id,
            case_id=case2.id,
            case_number=case2.case_number,
            document_title=doc3.filename,
            executive_summary=ai2_data["executive_summary"],
            key_clauses=ai2_data["key_clauses"],
            statutory_provisions=ai2_data["statutory_provisions"],
            risk_assessment=ai2_data["risk_assessment"],
            candidate_facts_json=ai2_data["candidate_facts_json"],
            review_status="Pending Human Review",
            is_advisory_acknowledged=False
        )

        ai3_data = analyze_document_content(doc4.filename, doc4.category, doc4.file_content_text, case3.title)
        ai_summary3 = AIDocumentSummary(
            document_id=doc4.id,
            case_id=case3.id,
            case_number=case3.case_number,
            document_title=doc4.filename,
            executive_summary=ai3_data["executive_summary"],
            key_clauses=ai3_data["key_clauses"],
            statutory_provisions=ai3_data["statutory_provisions"],
            risk_assessment=ai3_data["risk_assessment"],
            candidate_facts_json=ai3_data["candidate_facts_json"],
            review_status="Verified by Counsel",
            reviewed_by="Arjun Kapoor (Managing Attorney)",
            reviewed_at=utc_now(),
            advocate_signature="SIGNED://Arjun Kapoor/BAR-CHAMBER-2026",
            is_advisory_acknowledged=True
        )

        session.add_all([ai_summary1, ai_summary2, ai_summary3])
        session.commit()

        # 6. Seed Hearings (FR-008)
        h1 = Hearing(
            case_id=case1.id,
            case_number=case1.case_number,
            case_title=case1.title,
            hearing_date="2026-10-23",
            hearing_time="10:30 AM",
            court_name="District Civil Court Saket",
            courtroom="Courtroom 4",
            judge="Hon'ble Judge R. K. Singhal",
            hearing_type="Preliminary Hearing & Service Check",
            preparation_status="Preparation Needed",
            notes="Check if Respondent Eastern Industries filed reply to injunction application."
        )
        h2 = Hearing(
            case_id=case2.id,
            case_number=case2.case_number,
            case_title=case2.title,
            hearing_date="2026-10-26",
            hearing_time="11:00 AM",
            court_name="Civil Court Saket",
            courtroom="Courtroom 2",
            judge="Hon'ble Judge Ananya Sen",
            hearing_type="Order 39 Ad-Interim Arguments",
            preparation_status="Documents Ready",
            notes="Brief Senior Counsel on status of physical possession of GK-II property."
        )
        h3 = Hearing(
            case_id=case3.id,
            case_number=case3.case_number,
            case_title=case3.title,
            hearing_date="2026-10-29",
            hearing_time="02:30 PM",
            court_name="Arbitration Tribunal",
            courtroom="Room A (Virtual Hybrid)",
            judge="Justice (Retd.) B. N. Srikrishna",
            hearing_type="Preliminary Procedural Meeting",
            preparation_status="Preparation Needed",
            notes="Finalize timetable for statement of claim and witness affidavits."
        )
        session.add_all([h1, h2, h3])
        session.commit()

        # 7. Seed Tasks (FR-008)
        t1 = TaskItem(
            case_id=case1.id,
            case_number=case1.case_number,
            title="Review draft petition and rejoinder in Sharma case",
            description="Examine respondent's affidavit disputing receipt of default notice dated April 10.",
            assigned_to="Arjun Kapoor",
            due_date="Today · 4:00 PM",
            priority="Urgent",
            is_completed=False
        )
        t2 = TaskItem(
            case_id=case2.id,
            case_number=case2.case_number,
            title="Prepare hearing documents and indexed exhibits for Mehta suit",
            description="Bind certified copy of 1991 Conveyance Deed and family tree chart.",
            assigned_to="Arjun Kapoor",
            due_date="Tomorrow · 11:00 AM",
            priority="High",
            is_completed=False
        )
        session.add_all([t1, t2])
        session.commit()

        # 8. Seed Cryptographic Hash-Chained Audit Logs (FR-010)
        audit_events = [
            ("WORKSPACE_INITIALIZED", "System", "WP-LEXFORD", "CasePilot AI legal workspace initialized with RBAC & cryptographic audit chain.", "Arjun Kapoor", "Managing Attorney"),
            ("USER_ENROLLED", "User", "1", "Managing Attorney Arjun Kapoor enrolled with PBKDF2 authentication.", "System", "System"),
            ("CASE_CREATED", "Case", "CP-2026-024", "Commercial litigation matter 'Sharma vs. Eastern Industries' registered.", "Arjun Kapoor", "Managing Attorney"),
            ("DOCUMENT_UPLOADED", "Document", str(doc1.id), f"Uploaded Notice_of_Breach_Eastern_Industries.pdf (SHA-256: {fhash1[:12]}...).", "Arjun Kapoor", "Managing Attorney"),
            ("AI_ANALYSIS_EXECUTED", "AI Review", str(ai_summary1.id), "Automated advisory extraction executed with statutory provisions mapped.", "System AI Engine", "System"),
            ("HEARING_SCHEDULED", "Hearing", str(h1.id), "Preliminary hearing scheduled before Hon'ble Judge R. K. Singhal in Courtroom 4.", "Arjun Kapoor", "Managing Attorney")
        ]

        prev_hash = "GENESIS_ROOT_HASH_2026"
        for action, entity_type, entity_id, details, actor_name, actor_role in audit_events:
            ts = utc_now()
            raw = f"{prev_hash}|{ts.isoformat()}|{action}|{actor_name}|{actor_role}|{entity_type}|{entity_id}|{details}"
            rec_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
            log = AuditLog(
                action=action,
                actor_name=actor_name,
                actor_role=actor_role,
                entity_type=entity_type,
                entity_id=entity_id,
                details=details,
                prev_hash=prev_hash,
                record_hash=rec_hash,
                timestamp=ts
            )
            session.add(log)
            session.commit()
            prev_hash = rec_hash

        print("Database seeded with cryptographic audit chain, authenticated users, and SHA-256 vault documents!")
