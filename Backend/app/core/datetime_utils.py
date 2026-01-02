"""
Datetime utilities for consistent timezone handling.

All datetimes in this application should be timezone-aware UTC.
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return current UTC time as timezone-aware datetime.

    This should be used instead of datetime.utcnow() which returns
    timezone-naive datetimes. Using timezone-aware datetimes ensures
    consistency when storing to PostgreSQL and comparing datetimes.

    Returns:
        datetime: Current UTC time with timezone info
    """
    return datetime.now(timezone.utc)
