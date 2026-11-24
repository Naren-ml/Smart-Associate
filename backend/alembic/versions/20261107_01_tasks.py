from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261107_01"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    if "tasks" in inspect(bind).get_table_names():
        return
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(1000)),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="Medium"),
        sa.Column("status", sa.String(30), nullable=False, server_default="Pending"),
        sa.Column("assigned_to", sa.Integer(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_by", sa.Integer(), sa.ForeignKey("employees.id", ondelete="SET NULL")),
        sa.Column("due_date", sa.String(10)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime()),
    )
    for name, columns in [("ix_tasks_category", ["category"]), ("ix_tasks_priority", ["priority"]), ("ix_tasks_status", ["status"]), ("ix_tasks_assigned_to", ["assigned_to"]), ("ix_tasks_assigned_by", ["assigned_by"]), ("ix_tasks_due_date", ["due_date"]), ("ix_tasks_assignee_status_due", ["assigned_to", "status", "due_date"]), ("ix_tasks_assigner_created", ["assigned_by", "created_at"])]:
        op.create_index(name, "tasks", columns)

def downgrade():
    if "tasks" in inspect(op.get_bind()).get_table_names():
        op.drop_table("tasks")
