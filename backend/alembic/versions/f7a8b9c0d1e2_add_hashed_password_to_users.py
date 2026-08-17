"""add hashed_password to users

Revision ID: f7a8b9c0d1e2
Revises: 04fcfcee7f01
Create Date: 2026-08-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = '04fcfcee7f01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("hashed_password", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "hashed_password")
