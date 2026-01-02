"""
Celery application configuration.
"""

from celery import Celery

from app.config import settings

# Create Celery app
celery_app = Celery(
    "meetings_to_document",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "workers.tasks.process_job",
    ],
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task execution settings
    task_acks_late=True,  # Acknowledge after task completes
    task_reject_on_worker_lost=True,  # Reject task if worker dies
    worker_prefetch_multiplier=1,  # Only fetch one task at a time
    # Result backend settings
    result_expires=86400,  # Results expire after 24 hours
    # Task routing
    task_routes={
        "workers.tasks.process_job.*": {"queue": "processing"},
    },
    # Task time limits
    task_soft_time_limit=3600,  # 1 hour soft limit
    task_time_limit=3900,  # 1 hour 5 min hard limit
    # Retry settings
    task_default_retry_delay=60,  # 1 minute between retries
    task_max_retries=3,
)

# Optional: Configure task queues
celery_app.conf.task_queues = {
    "default": {
        "binding_key": "default",
    },
    "processing": {
        "binding_key": "processing",
    },
}
