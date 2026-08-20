"""add is_active to exercises

Revision ID: d5e6f7a8b9c0
Revises: c5d6e7f8a9b0
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = "d5e6f7a8b9c0"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exercises",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("exercises", "is_active", server_default=None)


def downgrade() -> None:
    op.drop_column("exercises", "is_active")
