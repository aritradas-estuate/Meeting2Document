"""
Background workers package.

Contains Celery tasks for async processing.
"""

from workers.celery_app import celery_app

__all__ = ["celery_app"]
