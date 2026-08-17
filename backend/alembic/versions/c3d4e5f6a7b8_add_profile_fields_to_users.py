"""add profile fields to users

Revision ID: c3d4e5f6a7b8
Revises: f7a8b9c0d1e2
Create Date: 2026-08-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "c3d4e5f6a7b8"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("gender", sa.String(), nullable=True))
    op.add_column("users", sa.Column("age", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("fitness_goals", JSONB(), nullable=True))
    op.add_column("users", sa.Column("fitness_styles", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "fitness_styles")
    op.drop_column("users", "fitness_goals")
    op.drop_column("users", "age")
    op.drop_column("users", "gender")
