import csv
import io
import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from fastapi.responses import Response
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import main as app_main
from app.main import (
    Attendance,
    Base,
    Employee,
    LoginRequest,
    StaffCreateRequest,
    StaffUpdateRequest,
    Task,
    TaskStatusUpdateRequest,
    WorkLogCreateRequest,
    create_staff_account,
    create_work_log,
    download_staff_audit_report,
    list_staff_accounts,
    list_work_logs,
    login,
    password_hasher,
    get_today_date_str,
    update_staff_account,
    update_task_status,
)


@pytest.fixture
def api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)
    db = testing_session()
    staff = Employee(
        name="Staff One",
        user_id="STAFF01",
        email="staff@example.test",
        password_hash=password_hasher.hash("staff-password"),
        role="staff",
    )
    admin = Employee(
        name="Admin One",
        user_id="ADMIN01",
        email="admin@example.test",
        password_hash=password_hasher.hash("admin-password"),
        role="admin",
    )
    db.add_all([staff, admin])
    db.commit()
    db.refresh(staff)
    db.refresh(admin)
    yield db, staff, admin
    db.close()
    engine.dispose()


def test_admin_creates_and_manages_accounts_by_user_id(api):
    db, staff, admin = api
    with pytest.raises(HTTPException) as forbidden:
        list_staff_accounts(staff, db)
    assert forbidden.value.status_code == 403
    manager = Employee(
        name="Manager One",
        user_id="MANAGER01",
        email="manager@example.test",
        password_hash=password_hasher.hash("manager-password"),
        role="manager",
    )
    db.add(manager)
    db.commit()
    with pytest.raises(HTTPException) as manager_forbidden:
        create_staff_account(
            StaffCreateRequest(
                name="Unauthorized Account",
                user_id="UNAUTHORIZED",
                password="unauthorized-password",
            ),
            manager,
            db,
        )
    assert manager_forbidden.value.status_code == 403

    created = create_staff_account(
        StaffCreateRequest(
            name="New Associate",
            user_id="associate-02",
            password="new-staff-password",
            role="staff",
        ),
        admin,
        db,
    )["employee"]
    assert created["user_id"] == "ASSOCIATE-02"
    assert created["email"] is None
    assert login(
        LoginRequest(user_id="associate-02", password="new-staff-password"),
        db,
    )["user"]["id"] == created["id"]

    updated = update_staff_account(
        created["id"],
        StaffUpdateRequest(password="changed-staff-password", is_active=False),
        admin,
        db,
    )["employee"]
    assert updated["is_active"] is False
    with pytest.raises(HTTPException) as inactive:
        login(LoginRequest(user_id="ASSOCIATE-02", password="changed-staff-password"), db)
    assert inactive.value.status_code == 401


def test_last_active_admin_cannot_be_disabled(api):
    db, _, admin = api
    with pytest.raises(HTTPException) as error:
        update_staff_account(
            admin.id,
            StaffUpdateRequest(is_active=False),
            admin,
            db,
        )
    assert error.value.status_code == 400


def test_work_logs_are_personal_and_admin_report_combines_audit_data(api):
    db, staff, admin = api
    work_date = get_today_date_str()
    task = Task(
        title="Quarterly GST review",
        description="Review the filing package",
        category="GST",
        priority="High",
        status="In Progress",
        assigned_to=staff.id,
        assigned_by=admin.id,
        due_date=work_date,
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 3, 4, 12, tzinfo=timezone.utc),
        completed_at=None,
    )
    db.add(task)
    db.add(Attendance(
        employee_id=staff.id,
        date=work_date,
        check_in=datetime(2026, 3, 4, 4, tzinfo=timezone.utc),
        check_out=datetime(2026, 3, 4, 12, 30, tzinfo=timezone.utc),
        total_minutes=510,
        status="present",
    ))
    db.commit()
    update_task_status(
        task.id,
        TaskStatusUpdateRequest(status="Completed"),
        staff,
        db,
    )

    work_log = create_work_log(
        WorkLogCreateRequest(
            work_date=work_date,
            description='=HYPERLINK("https://example.test")',
            minutes_spent=75,
            task_id=task.id,
        ),
        staff,
        db,
    )
    assert work_log["record"]["task_title"] == task.title
    assert list_work_logs(None, None, 100, staff, db)["count"] == 1

    response = download_staff_audit_report(work_date, work_date, admin, db)
    assert isinstance(response, Response)
    assert response.headers["content-type"].startswith("text/csv")
    report_rows = list(csv.DictReader(io.StringIO(response.body.decode("utf-8"))))
    assert len(report_rows) == 1
    assert report_rows[0]["Working Minutes"] == "510"
    assert report_rows[0]["Completed Tasks"] == task.title
    assert report_rows[0]["Work Done"].startswith("'=")

    update_task_status(task.id, TaskStatusUpdateRequest(status="In Progress"), staff, db)
    reopened_report = download_staff_audit_report(work_date, work_date, admin, db)
    reopened_row = next(csv.DictReader(io.StringIO(reopened_report.body.decode("utf-8"))))
    assert reopened_row["Completed Tasks"] == task.title

    with pytest.raises(HTTPException) as forbidden:
        download_staff_audit_report(work_date, work_date, staff, db)
    assert forbidden.value.status_code == 403


def test_staff_cannot_log_work_against_another_employees_task(api):
    db, staff, admin = api
    other_staff = Employee(
        name="Staff Two",
        user_id="STAFF02",
        email="staff2@example.test",
        password_hash=password_hasher.hash("other-password"),
        role="staff",
    )
    db.add(other_staff)
    db.flush()
    task = Task(
        title="Private task",
        category="Audit",
        priority="Medium",
        assigned_to=other_staff.id,
        assigned_by=admin.id,
    )
    db.add(task)
    db.commit()

    with pytest.raises(HTTPException) as error:
        create_work_log(
            WorkLogCreateRequest(description="Attempt to log another person's work", task_id=task.id),
            staff,
            db,
        )
    assert error.value.status_code == 404


def test_legacy_employee_schema_gets_stable_user_ids_and_active_flag(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE employees ("
            "id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL, "
            "email VARCHAR(255) NOT NULL, password_hash VARCHAR(500) NOT NULL, "
            "role VARCHAR(30) NOT NULL)"
        )
        connection.exec_driver_sql(
            "INSERT INTO employees (id, name, email, password_hash, role) "
            "VALUES (7, 'Existing Staff', 'existing@example.test', 'hash', 'staff')"
        )

    monkeypatch.setattr(app_main, "engine", engine)
    app_main.ensure_employee_account_schema()
    with engine.connect() as connection:
        employee = connection.exec_driver_sql(
            "SELECT user_id, is_active FROM employees WHERE id = 7"
        ).one()
        indexes = {index["name"] for index in inspect(connection).get_indexes("employees")}
    assert employee.user_id == "SA-000007"
    assert bool(employee.is_active)
    assert "ix_employees_user_id" in indexes
    engine.dispose()


def test_fresh_database_bootstraps_admin_from_environment(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(app_main, "engine", engine)
    monkeypatch.setattr(app_main, "SessionLocal", testing_session)
    monkeypatch.setenv("SMART_ASSOCIATE_BOOTSTRAP_ADMIN_ID", "first-admin")
    monkeypatch.setenv("SMART_ASSOCIATE_BOOTSTRAP_ADMIN_PASSWORD", "strong-bootstrap-password")
    monkeypatch.delenv("SMART_ASSOCIATE_ENABLE_DEMO_ACCOUNTS", raising=False)

    async def start_application():
        async with app_main.lifespan(app_main.app):
            with testing_session() as db:
                result = login(
                    LoginRequest(user_id="FIRST-ADMIN", password="strong-bootstrap-password"),
                    db,
                )
                assert result["user"]["role"] == "admin"

    asyncio.run(start_application())
    engine.dispose()
