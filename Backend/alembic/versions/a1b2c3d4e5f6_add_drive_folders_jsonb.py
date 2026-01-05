"""add_drive_folders_jsonb

Revision ID: a1b2c3d4e5f6
Revises: 5e13d4dc979d
Create Date: 2026-01-02 11:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "5e13d4dc979d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("drive_folders", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.execute(
        """
        UPDATE projects 
        SET drive_folders = CASE 
            WHEN drive_folder_id IS NOT NULL AND drive_folder_name IS NOT NULL
            THEN jsonb_build_array(jsonb_build_object('id', drive_folder_id, 'name', drive_folder_name))
            ELSE '[]'::jsonb
        END
    """
    )

    op.drop_column("projects", "drive_folder_id")
    op.drop_column("projects", "drive_folder_name")


def downgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("drive_folder_id", sa.String(), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("drive_folder_name", sa.String(), nullable=True),
    )

    op.execute(
        """
        UPDATE projects 
        SET 
            drive_folder_id = drive_folders->0->>'id',
            drive_folder_name = drive_folders->0->>'name'
        WHERE drive_folders IS NOT NULL AND jsonb_array_length(drive_folders) > 0
    """
    )

    op.drop_column("projects", "drive_folders")
