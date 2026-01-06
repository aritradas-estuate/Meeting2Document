"""simplify_project_status_enum

Revision ID: ac91e5366dd8
Revises: a1b2c3d4e5f6
Create Date: 2026-01-05 16:43:39.721318

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ac91e5366dd8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE projects SET status = 'ACTIVE' WHERE status IN ('PROCESSING', 'COMPLETED')")

    op.execute("ALTER TYPE projectstatus RENAME TO projectstatus_old")
    op.execute("CREATE TYPE projectstatus AS ENUM ('ACTIVE', 'ARCHIVED')")
    op.execute("""
        ALTER TABLE projects 
        ALTER COLUMN status TYPE projectstatus 
        USING status::text::projectstatus
    """)
    op.execute("DROP TYPE projectstatus_old")


def downgrade() -> None:
    op.execute("ALTER TYPE projectstatus RENAME TO projectstatus_old")
    op.execute(
        "CREATE TYPE projectstatus AS ENUM ('ACTIVE', 'PROCESSING', 'COMPLETED', 'ARCHIVED')"
    )
    op.execute("""
        ALTER TABLE projects 
        ALTER COLUMN status TYPE projectstatus 
        USING status::text::projectstatus
    """)
    op.execute("DROP TYPE projectstatus_old")
