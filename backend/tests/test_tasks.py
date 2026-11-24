import pytest
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import Base, Employee, Task, TaskCreateRequest, TaskStatusUpdateRequest, TaskUpdateRequest, LoginRequest, CheckInRequest, CheckOutRequest, password_hasher, login, check_in, check_out, create_task, delete_task, get_task, list_tasks, update_task, update_task_status


@pytest.fixture
def api():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)
    db = TestingSession()
    staff1 = Employee(name="Staff One", email="staff1@example.test", password_hash="x", role="staff")
    staff2 = Employee(name="Staff Two", email="staff2@example.test", password_hash="x", role="staff")
    manager = Employee(name="Manager One", email="manager@example.test", password_hash="x", role="manager")
    admin = Employee(name="Admin One", email="admin@example.test", password_hash="x", role="admin")
    db.add_all([staff1, staff2, manager, admin]); db.commit()
    yield db, TestingSession, staff1, staff2, manager, admin
    db.close(); engine.dispose()


def make_task(title, category, assigned_to, **kwargs):
    return TaskCreateRequest(title=title, category=category, assigned_to=assigned_to, **kwargs)


def test_manager_creates_and_staff_updates_own_task(api):
    db, _, staff1, _, manager, _ = api
    response = create_task(make_task("Prepare GST return", "GST", staff1.id, priority="High", due_date="2027-01-10"), manager, db)
    task = response["task"]
    listing = list_tasks(None, None, None, None, "newest", 50, 0, staff1, db)
    assert response["message"] == "Task created and assigned successfully."
    assert listing["total"] == 1 and listing["tasks"][0]["id"] == task["id"]
    changed = update_task_status(task["id"], TaskStatusUpdateRequest(status="In Progress"), staff1, db)
    assert changed["task"]["status"] == "In Progress"


def test_staff_cannot_view_or_change_another_staff_task(api):
    db, _, staff1, staff2, manager, _ = api
    task_id = create_task(make_task("Audit schedules", "Audit", staff1.id), manager, db)["task"]["id"]
    with pytest.raises(HTTPException) as view_error:
        get_task(task_id, staff2, db)
    assert view_error.value.status_code == 404
    with pytest.raises(HTTPException) as update_error:
        update_task_status(task_id, TaskStatusUpdateRequest(status="Completed"), staff2, db)
    assert update_error.value.status_code == 404


def test_manager_scope_and_admin_delete(api):
    db, _, staff2, _, manager, admin = api
    task_id = create_task(make_task("Admin managed task", "TDS", staff2.id), admin, db)["task"]["id"]
    with pytest.raises(HTTPException):
        get_task(task_id, manager, db)
    assert delete_task(task_id, admin, db)["message"] == "Task deleted successfully."


def test_manager_edits_reassigns_and_deletes_created_task(api):
    db, _, staff1, staff2, manager, _ = api
    task_id = create_task(make_task("Initial review", "GST", staff1.id), manager, db)["task"]["id"]
    edited = update_task(task_id, TaskUpdateRequest(title="Quarterly review", priority="Low", assigned_to=staff2.id), manager, db)
    assert edited["task"]["title"] == "Quarterly review"
    assert edited["task"]["priority"] == "Low"
    assert edited["task"]["assigned_to"] == staff2.id
    assert delete_task(task_id, manager, db)["message"] == "Task deleted successfully."


def test_validation_and_persistence(api):
    db, TestingSession, staff1, _, manager, _ = api
    with pytest.raises(HTTPException) as bad_date:
        create_task(make_task("Bad date task", "GST", staff1.id, due_date="2027-02-30"), manager, db)
    assert bad_date.value.status_code == 422

    path = Path("task_persistence_test.db").resolve()
    if path.exists(): path.unlink()
    first_engine = create_engine(f"sqlite:///{path.as_posix()}")
    Base.metadata.create_all(first_engine)
    FirstSession = sessionmaker(bind=first_engine)
    first_db = FirstSession()
    persisted_staff = Employee(name="Persisted Staff", email="persist@example.test", password_hash="x", role="staff")
    persisted_manager = Employee(name="Persisted Manager", email="persist-manager@example.test", password_hash="x", role="manager")
    first_db.add_all([persisted_staff, persisted_manager]); first_db.commit()
    task_id = create_task(make_task("Ledger review", "Accounting", persisted_staff.id), persisted_manager, first_db)["task"]["id"]
    first_db.close(); first_engine.dispose()

    restarted_engine = create_engine(f"sqlite:///{path.as_posix()}")
    RestartedSession = sessionmaker(bind=restarted_engine)
    restarted_db = RestartedSession()
    assert restarted_db.get(Task, task_id) is not None
    restarted_db.close(); restarted_engine.dispose(); path.unlink()


def test_existing_login_and_attendance_flow(api):
    db, _, staff1, _, _, _ = api
    staff1.email = "staff1@example.com"
    staff1.password_hash = password_hasher.hash("secure-pass")
    db.commit()
    result = login(LoginRequest(email=staff1.email, password="secure-pass"), db)
    assert result["access_token"] and result["user"]["id"] == staff1.id
    checked_in = check_in(CheckInRequest(), staff1, db)
    assert checked_in["record"]["employee_id"] == staff1.id
    checked_out = check_out(CheckOutRequest(), staff1, db)
    assert checked_out["record"]["check_out"] is not None
