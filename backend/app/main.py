import os
import re
import csv
import io
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager

import jwt
from pwdlib import PasswordHash
from fastapi import FastAPI, Depends, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy import (
    create_engine,
    Boolean,
    String,
    Integer,
    ForeignKey,
    UniqueConstraint,
    DateTime,
    desc,
    and_,
    or_,
    Index,
    inspect,
    text,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
    Session,
)


# --------------------------------------------------
# CONFIGURATION & FIRM WORK SCHEDULE SETTINGS
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'smart_associate.db')}"
DATABASE_URL = os.getenv("DATABASE_URL", DATABASE_URL).replace("postgres://", "postgresql://", 1)

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
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
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

    user_id: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=True,
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

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
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

TASK_CATEGORIES = {"GST", "TDS", "Audit", "Accounting"}
TASK_PRIORITIES = {"High", "Medium", "Low"}
TASK_STATUSES = {"Pending", "In Progress", "Completed"}


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_assignee_status_due", "assigned_to", "status", "due_date"),
        Index("ix_tasks_assigner_created", "assigned_by", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="Medium", index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="Pending", index=True)
    assigned_to: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    due_date: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    assignee: Mapped["Employee"] = relationship(foreign_keys=[assigned_to])
    assigner: Mapped["Employee | None"] = relationship(foreign_keys=[assigned_by])


class WorkLog(Base):
    __tablename__ = "work_logs"
    __table_args__ = (
        Index("ix_work_logs_employee_date", "employee_id", "work_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    work_date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(2000), nullable=False)
    minutes_spent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    task_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    task: Mapped["Task | None"] = relationship()


class TaskStatusEvent(Base):
    __tablename__ = "task_status_events"
    __table_args__ = (
        Index("ix_task_status_events_employee_time", "employee_id", "changed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    task_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    task_title: Mapped[str] = mapped_column(String(200), nullable=False)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str] = mapped_column(String(30), nullable=False)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


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


def serialize_task(task: Task) -> dict:
    today = get_today_date_str()
    return {
        "id": task.id, "title": task.title, "description": task.description,
        "category": task.category, "priority": task.priority, "status": task.status,
        "assigned_to": task.assigned_to, "assigned_by": task.assigned_by,
        "due_date": task.due_date,
        "is_overdue": bool(task.due_date and task.due_date < today and task.status != "Completed"),
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "assignee": {"id": task.assignee.id, "name": task.assignee.name, "email": task.assignee.email} if task.assignee else None,
        "assigner": {"id": task.assigner.id, "name": task.assigner.name} if task.assigner else None,
    }


# --------------------------------------------------
# REQUEST & RESPONSE SCHEMAS
# --------------------------------------------------

class LoginRequest(BaseModel):
    user_id: str | None = None
    email: EmailStr | None = None
    password: str


class StaffCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    user_id: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    password: str = Field(..., min_length=10, max_length=128)
    role: str = Field(default="staff", pattern=r"^(staff|admin)$")
    email: EmailStr | None = None


class StaffUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    user_id: str | None = Field(None, min_length=3, max_length=50, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    password: str | None = Field(None, min_length=10, max_length=128)
    role: str | None = Field(None, pattern=r"^(staff|manager|admin)$")
    email: EmailStr | None = None
    is_active: bool | None = None


class CheckInRequest(BaseModel):
    notes: str | None = None


class CheckOutRequest(BaseModel):
    notes: str | None = None


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str | None = Field(None, max_length=1000)
    category: str
    priority: str = "Medium"
    assigned_to: int
    due_date: str | None = None


class TaskUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    description: str | None = Field(None, max_length=1000)
    category: str | None = None
    priority: str | None = None
    assigned_to: int | None = None
    due_date: str | None = None


class TaskStatusUpdateRequest(BaseModel):
    status: str


class WorkLogCreateRequest(BaseModel):
    description: str = Field(..., min_length=3, max_length=2000)
    work_date: str | None = None
    minutes_spent: int | None = Field(None, ge=1, le=1440)
    task_id: int | None = None


# --------------------------------------------------
# SECURITY
# --------------------------------------------------

def create_access_token(employee: Employee) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(employee.id),
        "user_id": employee.user_id,
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

    if not employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account is inactive. Contact an administrator.",
        )

    return employee


# --------------------------------------------------
# STARTUP & SEEDING
# --------------------------------------------------

def ensure_employee_account_schema():
    """Adds account-management columns to databases created by older app versions."""
    columns = {column["name"] for column in inspect(engine).get_columns("employees")}

    with engine.begin() as connection:
        if "user_id" not in columns:
            connection.exec_driver_sql("ALTER TABLE employees ADD COLUMN user_id VARCHAR(50)")
        if "is_active" not in columns:
            connection.exec_driver_sql(
                "ALTER TABLE employees ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"
            )
        connection.execute(
            text("UPDATE employees SET is_active = TRUE WHERE is_active IS NULL")
        )
        missing_ids = connection.execute(
            text("SELECT id FROM employees WHERE user_id IS NULL OR TRIM(user_id) = ''")
        ).scalars().all()
        for employee_id in missing_ids:
            connection.execute(
                text("UPDATE employees SET user_id = :user_id WHERE id = :employee_id"),
                {"user_id": f"SA-{employee_id:06d}", "employee_id": employee_id},
            )

        indexes = {index["name"] for index in inspect(connection).get_indexes("employees")}
        if "ix_employees_user_id" not in indexes:
            connection.exec_driver_sql(
                "CREATE UNIQUE INDEX ix_employees_user_id ON employees (user_id)"
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables safely (idempotent, preserves existing data)
    Base.metadata.create_all(bind=engine)
    ensure_employee_account_schema()

    db = SessionLocal()

    try:
        staff_employee = None

        if os.getenv("SMART_ASSOCIATE_ENABLE_DEMO_ACCOUNTS", "").lower() == "true":
            demo_accounts = [
                ("Demo Staff", "staff@smartassociate.com", "DEMO-STAFF", "staff"),
                ("Priya S.", "manager@smartassociate.com", "DEMO-MANAGER", "manager"),
                ("CA Aravind", "admin@smartassociate.com", "DEMO-ADMIN", "admin"),
            ]
            for name, email, user_id, role in demo_accounts:
                employee = db.query(Employee).filter(Employee.email == email).first()
                if employee is None:
                    employee = Employee(
                        name=name,
                        email=email,
                        user_id=user_id,
                        password_hash=password_hasher.hash("123456"),
                        role=role,
                    )
                    db.add(employee)
                    db.commit()
                    db.refresh(employee)
                elif employee.user_id and employee.user_id.startswith("SA-"):
                    employee.user_id = user_id
                    db.commit()
                if email == "staff@smartassociate.com":
                    staff_employee = employee

        active_admin_exists = db.query(Employee).filter(
            Employee.role == "admin",
            Employee.is_active.is_(True),
        ).first()
        bootstrap_user_id = os.getenv("SMART_ASSOCIATE_BOOTSTRAP_ADMIN_ID", "").strip()
        bootstrap_password = os.getenv("SMART_ASSOCIATE_BOOTSTRAP_ADMIN_PASSWORD", "")
        if not active_admin_exists:
            if (
                len(bootstrap_password) < 10
                or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{2,49}", bootstrap_user_id)
            ):
                raise RuntimeError(
                    "No active admin exists. Set SMART_ASSOCIATE_BOOTSTRAP_ADMIN_ID "
                    "and SMART_ASSOCIATE_BOOTSTRAP_ADMIN_PASSWORD (10+ characters) "
                    "to initialize the first administrator."
                )
            bootstrap_employee = Employee(
                name=os.getenv("SMART_ASSOCIATE_BOOTSTRAP_ADMIN_NAME", "Practice Administrator"),
                user_id=bootstrap_user_id.upper(),
                email=f"{bootstrap_user_id.lower()}@staff.smartassociate.local",
                password_hash=password_hasher.hash(bootstrap_password),
                role="admin",
                is_active=True,
            )
            db.add(bootstrap_employee)
            db.commit()
            active_admin_exists = bootstrap_employee

        if staff_employee is None:
            staff_employee = db.query(Employee).filter(
                Employee.email == "staff@smartassociate.com"
            ).first()

        # Seed sample records only alongside explicitly enabled demo accounts.
        if os.getenv("SMART_ASSOCIATE_ENABLE_DEMO_ACCOUNTS", "").lower() == "true" and staff_employee:
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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://smart-associate-i57wd049p-naren22k2007-7040.vercel.app",
    ],
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
    if data.user_id:
        identity = data.user_id.strip().upper()
        employee = db.query(Employee).filter(Employee.user_id == identity).first()
    elif data.email:
        identity = str(data.email).strip().lower()
        employee = db.query(Employee).filter(Employee.email == identity).first()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter your User ID and password.",
        )

    if employee is None or not employee.is_active or not password_hasher.verify(
        data.password,
        employee.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid User ID or password.",
        )

    access_token = create_access_token(employee)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": employee.id,
            "name": employee.name,
            "user_id": employee.user_id,
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
        "user_id": employee.user_id,
        "email": employee.email,
        "role": employee.role,
        "is_active": employee.is_active,
    }


# --------------------------------------------------
# ATTENDANCE ENDPOINTS
# --------------------------------------------------

def _is_admin(employee: Employee) -> bool:
    return employee.role.lower() in {"admin", "chief auditor", "chief_auditor"}


def _is_manager(employee: Employee) -> bool:
    return employee.role.lower() == "manager"


def _task_scope(employee: Employee, db: Session):
    query = db.query(Task)
    if _is_admin(employee):
        return query
    if _is_manager(employee):
        return query.filter(or_(Task.assigned_by == employee.id, Task.assigned_to == employee.id))
    return query.filter(Task.assigned_to == employee.id)


def _require_task_manager(employee: Employee):
    if not (_is_admin(employee) or _is_manager(employee)):
        raise HTTPException(status_code=403, detail="Manager or admin role required to manage tasks.")


def _is_account_admin(employee: Employee) -> bool:
    return employee.role.lower() == "admin"


def _require_account_admin(employee: Employee):
    if not _is_account_admin(employee):
        raise HTTPException(status_code=403, detail="Admin role required.")


def serialize_employee(employee: Employee) -> dict:
    email = employee.email
    if email and email.endswith("@staff.smartassociate.local"):
        email = None
    return {
        "id": employee.id,
        "name": employee.name,
        "user_id": employee.user_id,
        "email": email,
        "role": employee.role,
        "is_active": employee.is_active,
    }


def _employee_email(user_id: str, email: str | None) -> str:
    if email:
        return str(email).strip().lower()
    return f"{user_id.lower()}@staff.smartassociate.local"


@app.get("/api/admin/staff")
def list_staff_accounts(
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    _require_account_admin(employee)
    employees = db.query(Employee).order_by(Employee.name, Employee.id).all()
    return {"employees": [serialize_employee(item) for item in employees]}


@app.post("/api/admin/staff", status_code=201)
def create_staff_account(
    data: StaffCreateRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    _require_account_admin(employee)
    user_id = data.user_id.strip().upper()
    email = _employee_email(user_id, data.email)
    if db.query(Employee).filter(Employee.user_id == user_id).first():
        raise HTTPException(status_code=409, detail="That User ID is already in use.")
    if db.query(Employee).filter(Employee.email == email).first():
        raise HTTPException(status_code=409, detail="That email address is already in use.")

    account = Employee(
        name=data.name.strip(),
        user_id=user_id,
        email=email,
        password_hash=password_hasher.hash(data.password),
        role=data.role,
        is_active=True,
    )
    try:
        db.add(account)
        db.commit()
        db.refresh(account)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User ID or email address is already in use.")
    return {"message": "Staff account created.", "employee": serialize_employee(account)}


@app.patch("/api/admin/staff/{staff_id}")
def update_staff_account(
    staff_id: int,
    data: StaffUpdateRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    _require_account_admin(employee)
    account = db.get(Employee, staff_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Staff account not found.")

    changes = data.model_dump(exclude_unset=True)
    next_role = changes.get("role", account.role)
    next_active = changes.get("is_active", account.is_active)
    if account.role.lower() == "admin" and (next_role != "admin" or not next_active):
        other_admin = db.query(Employee).filter(
            Employee.id != account.id,
            Employee.role == "admin",
            Employee.is_active.is_(True),
        ).first()
        if other_admin is None:
            raise HTTPException(
                status_code=400,
                detail="At least one active admin account must remain.",
            )

    if "user_id" in changes and changes["user_id"]:
        user_id = changes["user_id"].strip().upper()
        duplicate = db.query(Employee).filter(
            Employee.user_id == user_id,
            Employee.id != account.id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="That User ID is already in use.")
        account.user_id = user_id

    if "email" in changes:
        email = _employee_email(account.user_id or f"SA-{account.id:06d}", changes["email"])
        duplicate = db.query(Employee).filter(
            Employee.email == email,
            Employee.id != account.id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="That email address is already in use.")
        account.email = email

    if changes.get("name") is not None:
        account.name = changes["name"].strip()
    if changes.get("role") is not None:
        account.role = changes["role"]
    if changes.get("is_active") is not None:
        account.is_active = changes["is_active"]
    if changes.get("password"):
        account.password_hash = password_hasher.hash(changes["password"])

    try:
        db.commit()
        db.refresh(account)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User ID or email address is already in use.")
    return {"message": "Staff account updated.", "employee": serialize_employee(account)}


def _validate_iso_date(value: str, field_name: str):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        raise HTTPException(status_code=422, detail=f"{field_name} must use YYYY-MM-DD format.")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{field_name} must be a valid calendar date.")


def serialize_work_log(work_log: WorkLog) -> dict:
    return {
        "id": work_log.id,
        "employee_id": work_log.employee_id,
        "work_date": work_log.work_date,
        "description": work_log.description,
        "minutes_spent": work_log.minutes_spent,
        "task_id": work_log.task_id,
        "task_title": work_log.task.title if work_log.task else None,
        "created_at": work_log.created_at.isoformat() if work_log.created_at else None,
    }


@app.get("/api/work-logs")
def list_work_logs(
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    query = db.query(WorkLog).filter(WorkLog.employee_id == employee.id)
    if start_date:
        _validate_iso_date(start_date, "start_date")
        query = query.filter(WorkLog.work_date >= start_date)
    if end_date:
        _validate_iso_date(end_date, "end_date")
        query = query.filter(WorkLog.work_date <= end_date)
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date cannot be later than end_date.")
    records = query.order_by(desc(WorkLog.work_date), desc(WorkLog.created_at)).limit(limit).all()
    return {"count": len(records), "records": [serialize_work_log(record) for record in records]}


@app.post("/api/work-logs", status_code=201)
def create_work_log(
    data: WorkLogCreateRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    work_date = data.work_date or get_today_date_str()
    _validate_iso_date(work_date, "work_date")
    if work_date > get_today_date_str():
        raise HTTPException(status_code=422, detail="work_date cannot be in the future.")
    if data.task_id is not None:
        task = db.get(Task, data.task_id)
        if task is None or (task.assigned_to != employee.id and not _is_admin(employee)):
            raise HTTPException(status_code=404, detail="Task not found or you do not have access.")

    record = WorkLog(
        employee_id=employee.id,
        work_date=work_date,
        description=data.description.strip(),
        minutes_spent=data.minutes_spent,
        task_id=data.task_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"message": "Work log recorded.", "record": serialize_work_log(record)}


def _validate_task_values(category=None, priority=None, task_status=None, due_date=None):
    if category is not None and category not in TASK_CATEGORIES:
        raise HTTPException(status_code=422, detail="Category must be GST, TDS, Audit, or Accounting.")
    if priority is not None and priority not in TASK_PRIORITIES:
        raise HTTPException(status_code=422, detail="Priority must be High, Medium, or Low.")
    if task_status is not None and task_status not in TASK_STATUSES:
        raise HTTPException(status_code=422, detail="Status must be Pending, In Progress, or Completed.")
    if due_date is not None:
        try:
            datetime.strptime(due_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=422, detail="Due date must be a valid date in YYYY-MM-DD format.")


@app.get("/api/tasks/assignees")
def get_task_assignees(employee: Employee = Depends(get_current_employee), db: Session = Depends(get_db)):
    _require_task_manager(employee)
    q = db.query(Employee)
    if _is_manager(employee):
        q = q.filter(Employee.role == "staff")
    return {"employees": [{"id": e.id, "name": e.name, "email": e.email, "role": e.role} for e in q.order_by(Employee.name).all()]}


@app.get("/api/tasks/summary")
def task_summary(employee: Employee = Depends(get_current_employee), db: Session = Depends(get_db)):
    tasks = _task_scope(employee, db).all()
    today = get_today_date_str()
    return {"total": len(tasks), "pending": sum(t.status == "Pending" for t in tasks),
            "in_progress": sum(t.status == "In Progress" for t in tasks),
            "completed": sum(t.status == "Completed" for t in tasks),
            "overdue": sum(bool(t.due_date and t.due_date < today and t.status != "Completed") for t in tasks)}


@app.post("/api/tasks", status_code=201)
def create_task(data: TaskCreateRequest, employee: Employee = Depends(get_current_employee), db: Session = Depends(get_db)):
    _require_task_manager(employee)
    _validate_task_values(data.category, data.priority, due_date=data.due_date)
    assignee = db.get(Employee, data.assigned_to)
    if not assignee:
        raise HTTPException(status_code=404, detail="Assigned employee not found.")
    if _is_manager(employee) and assignee.role.lower() != "staff":
        raise HTTPException(status_code=403, detail="Managers can assign tasks to staff members only.")
    now = datetime.now(timezone.utc)
    task = Task(title=data.title.strip(), description=data.description.strip() if data.description else None,
                category=data.category, priority=data.priority, assigned_to=assignee.id,
                assigned_by=employee.id, due_date=data.due_date, created_at=now, updated_at=now)
    try:
        db.add(task); db.commit(); db.refresh(task)
        return {"message": "Task created and assigned successfully.", "task": serialize_task(task)}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not create task. Please try again.")


@app.get("/api/tasks")
def list_tasks(task_status: str | None = Query(None, alias="status"), category: str | None = None,
               priority: str | None = None, search: str | None = None, sort_by: str = "newest",
               limit: int = Query(50, ge=1, le=200), skip: int = Query(0, ge=0),
               employee: Employee = Depends(get_current_employee), db: Session = Depends(get_db)):
    _validate_task_values(category, priority, task_status)
    query = _task_scope(employee, db)
    if task_status: query = query.filter(Task.status == task_status)
    if category: query = query.filter(Task.category == category)
    if priority: query = query.filter(Task.priority == priority)
    if search: query = query.filter(or_(Task.title.ilike(f"%{search.strip()}%"), Task.description.ilike(f"%{search.strip()}%")))
    today = get_today_date_str()
    if sort_by == "upcoming": query = query.order_by(Task.due_date.is_(None), Task.due_date.asc(), Task.created_at.desc())
    elif sort_by == "overdue": query = query.filter(Task.due_date < today, Task.status != "Completed").order_by(Task.due_date.asc())
    elif sort_by == "newest": query = query.order_by(Task.created_at.desc())
    else: raise HTTPException(status_code=422, detail="sort_by must be newest, upcoming, or overdue.")
    total = query.count()
    rows = query.offset(skip).limit(limit).all()
    return {"total": total, "count": len(rows), "limit": limit, "skip": skip, "tasks": [serialize_task(t) for t in rows]}


@app.get("/api/tasks/{task_id}")
def get_task(task_id: int, employee: Employee = Depends(get_current_employee), db: Session = Depends(get_db)):
    task = _task_scope(employee, db).filter(Task.id == task_id).first()
    if not task: raise HTTPException(status_code=404, detail="Task not found or you do not have access.")
    return {"task": serialize_task(task)}


@app.put("/api/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdateRequest, employee: Employee = Depends(get_current_employee), db: Session = Depends(get_db)):
    _require_task_manager(employee)
    task = _task_scope(employee, db).filter(Task.id == task_id).first()
    if not task: raise HTTPException(status_code=404, detail="Task not found or you do not have access.")
    _validate_task_values(data.category, data.priority, due_date=data.due_date)
    if data.assigned_to is not None:
        assignee = db.get(Employee, data.assigned_to)
        if not assignee: raise HTTPException(status_code=404, detail="Assigned employee not found.")
        if _is_manager(employee) and assignee.role.lower() != "staff": raise HTTPException(status_code=403, detail="Managers can assign tasks to staff members only.")
        task.assigned_to = assignee.id
    for field in ("title", "description", "category", "priority", "due_date"):
        value = getattr(data, field)
        if value is not None: setattr(task, field, value.strip() if field in ("title", "description") and value else value)
    task.updated_at = datetime.now(timezone.utc)
    try:
        db.commit(); db.refresh(task)
        return {"message": "Task updated successfully.", "task": serialize_task(task)}
    except Exception:
        db.rollback(); raise HTTPException(status_code=500, detail="Could not update task. Please try again.")


@app.patch("/api/tasks/{task_id}/status")
def update_task_status(task_id: int, data: TaskStatusUpdateRequest, employee: Employee = Depends(get_current_employee), db: Session = Depends(get_db)):
    _validate_task_values(task_status=data.status)
    task = _task_scope(employee, db).filter(Task.id == task_id).first()
    if not task: raise HTTPException(status_code=404, detail="Task not found or you do not have access.")
    now = datetime.now(timezone.utc)
    previous_status = task.status
    task.status = data.status; task.updated_at = now
    task.completed_at = now if data.status == "Completed" else None
    if previous_status != data.status:
        db.add(TaskStatusEvent(
            task_id=task.id,
            task_title=task.title,
            employee_id=task.assigned_to,
            changed_by=employee.id,
            from_status=previous_status,
            to_status=data.status,
            changed_at=now,
        ))
    try:
        db.commit(); db.refresh(task)
        return {"message": "Task status updated.", "task": serialize_task(task)}
    except Exception:
        db.rollback(); raise HTTPException(status_code=500, detail="Could not update task status. Please try again.")


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, employee: Employee = Depends(get_current_employee), db: Session = Depends(get_db)):
    _require_task_manager(employee)
    task = _task_scope(employee, db).filter(Task.id == task_id).first()
    if not task: raise HTTPException(status_code=404, detail="Task not found or you do not have access.")
    try:
        db.delete(task); db.commit()
        return {"message": "Task deleted successfully."}
    except Exception:
        db.rollback(); raise HTTPException(status_code=500, detail="Could not delete task. Please try again.")


def _report_date_range(start_date: str | None, end_date: str | None) -> tuple[str, str]:
    today = get_today_date_str()
    start = start_date or f"{today[:7]}-01"
    end = end_date or today
    _validate_iso_date(start, "start_date")
    _validate_iso_date(end, "end_date")
    if start > end:
        raise HTTPException(status_code=422, detail="start_date cannot be later than end_date.")
    if (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days > 365:
        raise HTTPException(status_code=422, detail="Report date range cannot exceed 366 days.")
    return start, end


def _csv_safe(value) -> str:
    if value is None:
        return ""
    text_value = str(value)
    if text_value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{text_value}"
    return text_value


@app.get("/api/admin/reports.csv")
def download_staff_audit_report(
    start_date: str | None = None,
    end_date: str | None = None,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    _require_account_admin(employee)
    start, end = _report_date_range(start_date, end_date)
    local_tz = timezone(timedelta(hours=APP_TIMEZONE_OFFSET_HOURS))
    start_local = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=local_tz)
    end_local = (
        datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)
    ).replace(tzinfo=local_tz)
    start_utc = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(timezone.utc).replace(tzinfo=None)

    employees = {item.id: item for item in db.query(Employee).all()}
    daily = {}

    def row_for(employee_id: int, work_date: str):
        return daily.setdefault((employee_id, work_date), {
            "attendance": None,
            "work": [],
            "work_minutes": 0,
            "completed_tasks": set(),
        })

    for attendance in db.query(Attendance).filter(
        Attendance.date >= start,
        Attendance.date <= end,
    ).all():
        row_for(attendance.employee_id, attendance.date)["attendance"] = attendance

    for work_log in db.query(WorkLog).filter(
        WorkLog.work_date >= start,
        WorkLog.work_date <= end,
    ).all():
        row = row_for(work_log.employee_id, work_log.work_date)
        row["work"].append(work_log.description)
        row["work_minutes"] += work_log.minutes_spent or 0

    completion_events = db.query(TaskStatusEvent).filter(
        TaskStatusEvent.to_status == "Completed",
        TaskStatusEvent.changed_at >= start_utc,
        TaskStatusEvent.changed_at < end_utc,
    ).all()
    for event in completion_events:
        local_changed_at = to_local_datetime(event.changed_at)
        row_for(event.employee_id, local_changed_at.strftime("%Y-%m-%d"))[
            "completed_tasks"
        ].add(event.task_title)

    # Include completions that predate status-history tracking.
    for task in db.query(Task).filter(
        Task.status == "Completed",
        Task.completed_at.is_not(None),
        Task.completed_at >= start_utc,
        Task.completed_at < end_utc,
    ).all():
        local_completed_at = to_local_datetime(task.completed_at)
        row_for(task.assigned_to, local_completed_at.strftime("%Y-%m-%d"))[
            "completed_tasks"
        ].add(task.title)

    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow([
        "User ID",
        "Staff Name",
        "Role",
        "Date",
        "Check In",
        "Check Out",
        "Working Minutes",
        "Attendance Status",
        "Work Done",
        "Work Minutes",
        "Completed Tasks",
    ])
    for (employee_id, work_date), details in sorted(
        daily.items(),
        key=lambda item: (item[0][1], employees.get(item[0][0]).name if employees.get(item[0][0]) else ""),
    ):
        staff_member = employees.get(employee_id)
        if staff_member is None:
            continue
        attendance = details["attendance"]
        attendance_data = serialize_attendance(attendance) if attendance else {}
        writer.writerow([
            _csv_safe(staff_member.user_id),
            _csv_safe(staff_member.name),
            _csv_safe(staff_member.role),
            work_date,
            attendance_data.get("check_in_time"),
            attendance_data.get("check_out_time"),
            attendance_data.get("duration_minutes"),
            attendance_data.get("status_display"),
            _csv_safe(" | ".join(details["work"])),
            details["work_minutes"],
            _csv_safe(" | ".join(sorted(details["completed_tasks"]))),
        ])

    filename = f"staff-audit-{start}-to-{end}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
