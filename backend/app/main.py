import os
import re
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager

import jwt
from pwdlib import PasswordHash
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy import (
    create_engine,
    String,
    Integer,
    ForeignKey,
    UniqueConstraint,
    DateTime,
    desc,
    and_,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    sessionmaker,
    Session,
)


# --------------------------------------------------
# CONFIGURATION & FIRM WORK SCHEDULE SETTINGS
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'smart_associate.db')}"

SECRET_KEY = os.getenv("SMART_ASSOCIATE_SECRET_KEY")

if not SECRET_KEY:
    SECRET_KEY = os.urandom(32).hex()
    print(
        "WARNING: Using a temporary JWT secret. "
        "Set SMART_ASSOCIATE_SECRET_KEY before deployment."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60

# Configurable Firm Schedule Settings (Aravind & Associates, India IST UTC+5:30)
APP_TIMEZONE_OFFSET_HOURS = float(os.getenv("APP_TIMEZONE_OFFSET_HOURS", "5.5"))
OFFICIAL_WORK_START_HOUR = int(os.getenv("OFFICIAL_WORK_START_HOUR", "9"))     # 09:30 AM
OFFICIAL_WORK_START_MINUTE = int(os.getenv("OFFICIAL_WORK_START_MINUTE", "30"))
GRACE_PERIOD_MINUTES = int(os.getenv("GRACE_PERIOD_MINUTES", "15"))           # Up to 09:45 AM

password_hasher = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


# --------------------------------------------------
# DATABASE & MODELS
# --------------------------------------------------

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(30),
        default="staff",
        nullable=False,
    )


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    employee_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    date: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )  # ISO Date: YYYY-MM-DD

    check_in: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )  # Stored in UTC

    check_out: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )  # Stored in UTC

    total_minutes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="present",
        nullable=False,
    )  # 'present', 'late', 'incomplete'

    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "date",
            name="uq_employee_workdate",
        ),
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------
# TIMEZONE & HELPER UTILITIES
# --------------------------------------------------

def get_local_now() -> datetime:
    """Returns the current datetime in the configured local timezone."""
    local_tz = timezone(timedelta(hours=APP_TIMEZONE_OFFSET_HOURS))
    return datetime.now(local_tz)


def get_today_date_str() -> str:
    """Returns today's date string YYYY-MM-DD in the configured local timezone."""
    return get_local_now().strftime("%Y-%m-%d")


def to_local_datetime(dt: datetime | None) -> datetime | None:
    """Converts a UTC datetime into the configured local timezone."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local_tz = timezone(timedelta(hours=APP_TIMEZONE_OFFSET_HOURS))
    return dt.astimezone(local_tz)


def format_time_display(dt: datetime | None) -> str:
    """Formats datetime to local 12-hour time string (e.g. 09:02 AM)."""
    if dt is None:
        return "—"
    loc = to_local_datetime(dt)
    return loc.strftime("%I:%M %p")


def format_date_display(date_str: str) -> str:
    """Formats YYYY-MM-DD into a readable format (e.g. 05 Oct 2026)."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return d.strftime("%d %b %Y")
    except Exception:
        return date_str


def serialize_attendance(att: Attendance, employee: Employee | None = None) -> dict:
    """Serializes an Attendance ORM instance into clean JSON matching enterprise UI needs."""
    duration_minutes = att.total_minutes
    is_active = att.check_out is None

    # Calculate live elapsed session if check-out has not yet occurred
    if is_active and att.check_in:
        now_utc = datetime.now(timezone.utc)
        chk_in = (
            att.check_in.replace(tzinfo=timezone.utc)
            if att.check_in.tzinfo is None
            else att.check_in
        )
        duration_minutes = max(0, int((now_utc - chk_in).total_seconds() / 60))

    hours = duration_minutes // 60 if duration_minutes is not None else 0
    mins = duration_minutes % 60 if duration_minutes is not None else 0
    duration_str = f"{hours}h {mins}m" if duration_minutes is not None else "—"

    status_display = (
        "Late Arrival"
        if att.status == "late"
        else "Incomplete"
        if att.status == "incomplete"
        else "Present"
    )

    data = {
        "id": att.id,
        "employee_id": att.employee_id,
        "date": att.date,
        "date_formatted": format_date_display(att.date),
        "check_in": att.check_in.isoformat() if att.check_in else None,
        "check_in_time": format_time_display(att.check_in),
        "check_out": att.check_out.isoformat() if att.check_out else None,
        "check_out_time": format_time_display(att.check_out),
        "total_minutes": att.total_minutes,
        "duration_minutes": duration_minutes,
        "duration_formatted": duration_str,
        "status": att.status,
        "status_display": status_display,
        "is_active": is_active,
        "notes": att.notes,
        "created_at": att.created_at.isoformat() if att.created_at else None,
        "updated_at": att.updated_at.isoformat() if att.updated_at else None,
    }

    if employee:
        data["employee"] = {
            "id": employee.id,
            "name": employee.name,
            "email": employee.email,
            "role": employee.role,
        }

    return data


# --------------------------------------------------
# REQUEST & RESPONSE SCHEMAS
# --------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CheckInRequest(BaseModel):
    notes: str | None = None


class CheckOutRequest(BaseModel):
    notes: str | None = None


# --------------------------------------------------
# SECURITY
# --------------------------------------------------

def create_access_token(employee: Employee) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(employee.id),
        "email": employee.email,
        "role": employee.role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_employee(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Employee:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        employee_id = int(payload["sub"])

    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    employee = db.get(Employee, employee_id)

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee account not found.",
        )

    return employee


# --------------------------------------------------
# STARTUP & SEEDING
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables safely (idempotent, preserves existing data)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # 1. Ensure demo accounts for all 3 roles (staff, manager, admin)
        demo_accounts = [
            ("Demo Staff", "staff@smartassociate.com", "staff"),
            ("Priya S.", "manager@smartassociate.com", "manager"),
            ("CA Aravind", "admin@smartassociate.com", "admin"),
        ]

        staff_employee = None

        for name, email, role in demo_accounts:
            employee = (
                db.query(Employee)
                .filter(Employee.email == email)
                .first()
            )

            if employee is None:
                employee = Employee(
                    name=name,
                    email=email,
                    password_hash=password_hasher.hash("123456"),
                    role=role,
                )
                db.add(employee)
                db.commit()
                db.refresh(employee)
                print(f"Demo {role} account created ({email}).")

            if email == "staff@smartassociate.com":
                staff_employee = employee

        # 2. Seed past attendance records for demo staff if none exist
        if staff_employee:
            existing_count = (
                db.query(Attendance)
                .filter(Attendance.employee_id == staff_employee.id)
                .count()
            )

            if existing_count == 0:
                local_now = get_local_now()
                # Create historical records for preceding business days
                sample_history = [
                    (1, "09:02", "18:14", 552, "present", "Head Office • Biometric"),
                    (2, "09:05", "18:03", 538, "present", "Head Office"),
                    (3, "09:48", "18:20", 512, "late", "Traffic delay • Client visit"),
                    (4, "09:01", "18:05", 544, "present", "Head Office"),
                    (5, "09:04", "18:02", 538, "present", "Head Office"),
                ]

                local_tz = timezone(timedelta(hours=APP_TIMEZONE_OFFSET_HOURS))

                for day_offset, in_time, out_time, total_mins, att_status, note in sample_history:
                    rec_date = (local_now - timedelta(days=day_offset)).strftime("%Y-%m-%d")
                    in_h, in_m = map(int, in_time.split(":"))
                    out_h, out_m = map(int, out_time.split(":"))

                    d_in_local = datetime.strptime(rec_date, "%Y-%m-%d").replace(
                        hour=in_h, minute=in_m, second=0, tzinfo=local_tz
                    )
                    d_out_local = datetime.strptime(rec_date, "%Y-%m-%d").replace(
                        hour=out_h, minute=out_m, second=0, tzinfo=local_tz
                    )

                    d_in_utc = d_in_local.astimezone(timezone.utc)
                    d_out_utc = d_out_local.astimezone(timezone.utc)

                    att = Attendance(
                        employee_id=staff_employee.id,
                        date=rec_date,
                        check_in=d_in_utc,
                        check_out=d_out_utc,
                        total_minutes=total_mins,
                        status=att_status,
                        notes=note,
                        created_at=d_in_utc,
                        updated_at=d_out_utc,
                    )
                    db.add(att)

                db.commit()
                print("Seeded realistic historical attendance for demo staff.")

        print("Smart Associate database is ready.")

    finally:
        db.close()

    yield


# --------------------------------------------------
# APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="Smart Associate API",
    description="Staff Management & Practice Portal for Aravind & Associates, Chartered Accountants",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# GENERAL & HEALTH ENDPOINTS
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Smart Associate API is running",
        "firm": "Aravind & Associates, Chartered Accountants",
        "status": "success",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Smart Associate Backend",
        "timezone_offset": APP_TIMEZONE_OFFSET_HOURS,
    }


@app.get("/api/test")
def test_api():
    return {
        "message": "Backend is ready for frontend integration",
    }


# --------------------------------------------------
# AUTHENTICATION ENDPOINTS
# --------------------------------------------------

@app.post("/api/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    email = str(data.email).strip().lower()

    employee = (
        db.query(Employee)
        .filter(Employee.email == email)
        .first()
    )

    if employee is None or not password_hasher.verify(
        data.password,
        employee.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token = create_access_token(employee)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": employee.id,
            "name": employee.name,
            "email": employee.email,
            "role": employee.role,
        },
    }


@app.get("/api/auth/me")
def get_my_profile(
    employee: Employee = Depends(get_current_employee),
):
    return {
        "id": employee.id,
        "name": employee.name,
        "email": employee.email,
        "role": employee.role,
    }


# --------------------------------------------------
# ATTENDANCE ENDPOINTS
# --------------------------------------------------

@app.post("/api/attendance/check-in")
def check_in(
    data: CheckInRequest = None,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Records daily check-in for the authenticated employee.
    Enforces one check-in per employee per workday at the database level.
    """
    today_date = get_today_date_str()

    # 1. Prevent duplicate check-in for the same employee and workday
    existing = (
        db.query(Attendance)
        .filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today_date,
            )
        )
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have already checked in for today ({format_date_display(today_date)}) at {format_time_display(existing.check_in)}.",
        )

    # 2. Determine attendance status based on official start time and grace period
    local_now = get_local_now()
    official_start = local_now.replace(
        hour=OFFICIAL_WORK_START_HOUR,
        minute=OFFICIAL_WORK_START_MINUTE,
        second=0,
        microsecond=0,
    )
    grace_cutoff = official_start + timedelta(minutes=GRACE_PERIOD_MINUTES)

    status_value = "late" if local_now > grace_cutoff else "present"
    notes = data.notes.strip() if data and data.notes else None

    # 3. Create attendance record
    now_utc = datetime.now(timezone.utc)
    record = Attendance(
        employee_id=employee.id,
        date=today_date,
        check_in=now_utc,
        check_out=None,
        total_minutes=None,
        status=status_value,
        notes=notes,
        created_at=now_utc,
        updated_at=now_utc,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "message": "Check-in recorded successfully. Have a productive workday!",
        "record": serialize_attendance(record),
    }


@app.post("/api/attendance/check-out")
def check_out(
    data: CheckOutRequest = None,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Records daily check-out for the authenticated employee.
    Requires a valid check-in for today and prevents duplicate checkout.
    """
    today_date = get_today_date_str()

    # 1. Verify that check-in exists for today
    record = (
        db.query(Attendance)
        .filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today_date,
            )
        )
        .first()
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No check-in record found for today. You must check in before checking out.",
        )

    # 2. Prevent repeated checkout attempts
    if record.check_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have already checked out for today at {format_time_display(record.check_out)}.",
        )

    # 3. Calculate working duration
    now_utc = datetime.now(timezone.utc)
    chk_in = (
        record.check_in.replace(tzinfo=timezone.utc)
        if record.check_in.tzinfo is None
        else record.check_in
    )
    total_minutes = max(0, int((now_utc - chk_in).total_seconds() / 60))

    record.check_out = now_utc
    record.total_minutes = total_minutes
    record.updated_at = now_utc

    if data and data.notes:
        existing_notes = record.notes or ""
        record.notes = (
            f"{existing_notes} | Out note: {data.notes.strip()}".strip(" |")
        )

    db.commit()
    db.refresh(record)

    hours = total_minutes // 60
    mins = total_minutes % 60
    duration_str = f"{hours}h {mins}m"

    return {
        "message": f"Check-out recorded successfully. Total working duration: {duration_str}.",
        "record": serialize_attendance(record),
    }


@app.get("/api/attendance/today")
def get_today_attendance(
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Retrieves today's attendance status and record for the authenticated employee.
    """
    today_date = get_today_date_str()

    record = (
        db.query(Attendance)
        .filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date == today_date,
            )
        )
        .first()
    )

    checked_in = record is not None
    checked_out = record is not None and record.check_out is not None

    return {
        "today_date": today_date,
        "today_date_formatted": format_date_display(today_date),
        "checked_in": checked_in,
        "checked_out": checked_out,
        "record": serialize_attendance(record) if record else None,
    }


@app.get("/api/attendance/history")
def get_attendance_history(
    start_date: str | None = Query(
        None, description="Start date filter (YYYY-MM-DD)"
    ),
    end_date: str | None = Query(
        None, description="End date filter (YYYY-MM-DD)"
    ),
    status_filter: str | None = Query(
        None, alias="status", description="Filter by status (present, late, incomplete)"
    ),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Retrieves the authenticated employee's attendance records with date-range
    and status filtering, sorted descending by date.
    """
    date_regex = r"^\d{4}-\d{2}-\d{2}$"

    # Validate date formats
    if start_date:
        if not re.match(date_regex, start_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_date format. Must be YYYY-MM-DD.",
            )

    if end_date:
        if not re.match(date_regex, end_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_date format. Must be YYYY-MM-DD.",
            )

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be later than end_date.",
        )

    # Base query restricted strictly to the authenticated employee
    query = db.query(Attendance).filter(Attendance.employee_id == employee.id)

    if start_date:
        query = query.filter(Attendance.date >= start_date)

    if end_date:
        query = query.filter(Attendance.date <= end_date)

    if status_filter and status_filter.strip():
        query = query.filter(Attendance.status == status_filter.strip().lower())

    total_count = query.count()

    records = (
        query.order_by(desc(Attendance.date), desc(Attendance.check_in))
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "total": total_count,
        "count": len(records),
        "limit": limit,
        "skip": skip,
        "records": [serialize_attendance(r) for r in records],
    }


@app.get("/api/attendance/summary")
def get_attendance_summary(
    month: str | None = Query(
        None, description="Month in YYYY-MM format. Defaults to current month."
    ),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Calculates monthly attendance summary strictly from actual database records.
    """
    month_regex = r"^\d{4}-\d{2}$"

    if month:
        if not re.match(month_regex, month):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid month format. Must be YYYY-MM.",
            )
        target_month = month
    else:
        target_month = get_today_date_str()[:7]

    records = (
        db.query(Attendance)
        .filter(
            and_(
                Attendance.employee_id == employee.id,
                Attendance.date.startswith(target_month),
            )
        )
        .all()
    )

    days_present = len(records)
    days_completed = sum(1 for r in records if r.check_out is not None)
    days_late = sum(1 for r in records if r.status == "late")
    incomplete_days = sum(1 for r in records if r.check_out is None and r.date != get_today_date_str())

    total_minutes = sum(r.total_minutes or 0 for r in records if r.total_minutes is not None)
    avg_minutes = (total_minutes // days_completed) if days_completed > 0 else 0

    try:
        month_obj = datetime.strptime(target_month, "%Y-%m")
        month_display = month_obj.strftime("%B %Y")
    except Exception:
        month_display = target_month

    total_hours_formatted = f"{total_minutes // 60}h {total_minutes % 60}m"
    avg_hours_formatted = f"{avg_minutes // 60}h {avg_minutes % 60}m"

    return {
        "month": target_month,
        "month_display": month_display,
        "days_present": days_present,
        "days_completed": days_completed,
        "days_late": days_late,
        "days_incomplete": incomplete_days,
        "total_minutes": total_minutes,
        "total_hours_formatted": total_hours_formatted,
        "avg_minutes_per_day": avg_minutes,
        "avg_hours_per_day_formatted": avg_hours_formatted,
    }


@app.get("/api/attendance/team")
def get_team_attendance(
    target_date: str | None = Query(
        None, alias="date", description="Target date (YYYY-MM-DD)"
    ),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    Enables Managers and Admins to inspect the firm's team attendance for a given day.
    Staff members are rejected with HTTP 403 Forbidden.
    """
    if employee.role.lower() not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Manager or Admin role required to inspect team attendance.",
        )

    date_to_query = target_date or get_today_date_str()

    records = (
        db.query(Attendance)
        .filter(Attendance.date == date_to_query)
        .all()
    )

    # Map employee details
    team_data = []
    for r in records:
        emp = db.get(Employee, r.employee_id)
        team_data.append(serialize_attendance(r, emp))

    return {
        "date": date_to_query,
        "date_formatted": format_date_display(date_to_query),
        "total_present": len(records),
        "records": team_data,
    }
