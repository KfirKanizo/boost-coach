"""add pre_built_programs table

Revision ID: a1b2c3d4e5f7
Revises: d5e6f7a8b9c0
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "a1b2c3d4e5f7"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pre_built_programs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False, server_default=""),
        sa.Column("muscle_tags", JSONB(), nullable=False, server_default="[]"),
        sa.Column("exercises", JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )


def downgrade() -> None:
    op.drop_table("pre_built_programs")
