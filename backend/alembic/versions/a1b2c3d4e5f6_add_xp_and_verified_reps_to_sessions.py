"""add xp_earned and verified_reps to workout_sessions

Revision ID: a1b2c3d4e5f6
Revises: b8c9d0e1f2a3
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workout_sessions",
        sa.Column("verified_reps", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "workout_sessions",
        sa.Column("xp_earned", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("workout_sessions", "xp_earned")
    op.drop_column("workout_sessions", "verified_reps")
