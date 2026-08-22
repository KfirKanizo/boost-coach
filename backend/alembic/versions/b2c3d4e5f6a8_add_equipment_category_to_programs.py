"""add equipment_category to pre_built_programs

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a8"
down_revision = "a1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pre_built_programs",
        sa.Column(
            "equipment_category",
            sa.String(),
            nullable=False,
            server_default="gym",
        ),
    )


def downgrade() -> None:
    op.drop_column("pre_built_programs", "equipment_category")
