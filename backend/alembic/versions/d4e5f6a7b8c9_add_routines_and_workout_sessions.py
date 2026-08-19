"""add routines and workout_sessions tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "routines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            index=True,
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("exercises", JSONB(), nullable=False, server_default="[]"),
        sa.Column("schedule_days", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "workout_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            index=True,
            nullable=False,
        ),
        sa.Column("session_type", sa.String(), nullable=False),
        sa.Column("total_reps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "total_duration_seconds", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("exercise_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("workout_sessions")
    op.drop_table("routines")
