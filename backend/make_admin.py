"""Promote a user to admin by email address.

Usage (run from the backend/ directory or anywhere with PYTHONPATH set):

    python make_admin.py
    python make_admin.py --email kfir.kanizo@gmail.com
    python make_admin.py -e alice@example.com

Requires DATABASE_URL env var or falls back to the local Docker-Compose
default with host rewritten to localhost (so it works outside the container).
"""

import argparse
import asyncio
import os
import sys

# ---------------------------------------------------------------------------
# Rewrite the default URL so the script runs from the host, not from inside
# the Docker network where "db" resolves.  honour an explicit DATABASE_URL
# env-var if the user sets one.
# ---------------------------------------------------------------------------
_DEFAULT_DB_URL = (
    "postgresql+asyncpg://boostcoach:boostcoach@localhost:5432/boostcoach"
)
DATABASE_URL = os.getenv("DATABASE_URL", _DEFAULT_DB_URL)

# Ensure the app package is importable when invoked from the backend dir.
sys.path.insert(0, os.path.dirname(__file__) or ".")

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.models import User  # noqa: E402


async def make_admin(email: str) -> None:
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        result = await session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if user is None:
            print(f"User not found: {email}")
            await engine.dispose()
            sys.exit(1)

        if user.is_admin:
            print(f"{email} is already an admin — nothing to do.")
            await engine.dispose()
            return

        user.is_admin = True
        await session.commit()
        print(f"Promoted {email} to admin successfully.")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote a user to admin.")
    parser.add_argument(
        "-e",
        "--email",
        default="kfir.kanizo@gmail.com",
        help="Email of the user to promote (default: kfir.kanizo@gmail.com)",
    )
    args = parser.parse_args()
    asyncio.run(make_admin(args.email))


if __name__ == "__main__":
    main()
