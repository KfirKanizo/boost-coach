"""migrate push_subscriptions to fcm_token

Revision ID: e1f2a3b4c5d6
Revises: d6e7f8a9b0c1
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa

revision = "e1f2a3b4c5d6"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old web-push columns
    op.drop_column("push_subscriptions", "p256dh")
    op.drop_column("push_subscriptions", "auth")
    op.drop_column("push_subscriptions", "endpoint")
    # Add FCM token column (unique, not null)
    op.add_column(
        "push_subscriptions",
        sa.Column("fcm_token", sa.String(), nullable=False, unique=True),
    )


def downgrade() -> None:
    op.drop_column("push_subscriptions", "fcm_token")
    op.add_column(
        "push_subscriptions",
        sa.Column("endpoint", sa.String(), nullable=False, unique=True),
    )
    op.add_column(
        "push_subscriptions",
        sa.Column("p256dh", sa.String(), nullable=False),
    )
    op.add_column(
        "push_subscriptions",
        sa.Column("auth", sa.String(), nullable=False),
    )
