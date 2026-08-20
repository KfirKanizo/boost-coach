"""add routine_id to workout_sessions

Revision ID: c5d6e7f8a9b0
Revises: a1b2c3d4e5f6
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = "c5d6e7f8a9b0"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workout_sessions",
        sa.Column(
            "routine_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("routines.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_workout_sessions_routine_id",
        "workout_sessions",
        ["routine_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_workout_sessions_routine_id", table_name="workout_sessions")
    op.drop_column("workout_sessions", "routine_id")
