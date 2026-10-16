"""Pure helpers for reporting source-ingestion freshness."""

from datetime import datetime, timedelta, timezone


def freshness_state(last_run_at, max_age_days, now=None):
    """Classify a source timestamp as fresh, stale, missing, or in the future."""
    if max_age_days < 1:
        raise ValueError("max_age_days must be a positive integer")
    if last_run_at is None:
        return "missing"
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if last_run_at.tzinfo is None:
        last_run_at = last_run_at.replace(tzinfo=timezone.utc)

    age = now - last_run_at
    if age < timedelta(minutes=-5):
        return "future"
    if age > timedelta(days=max_age_days):
        return "stale"
    return "fresh"


def freshness_age_days(last_run_at, now=None):
    """Return age in fractional days, or None when no successful refresh exists."""
    if last_run_at is None:
        return None
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if last_run_at.tzinfo is None:
        last_run_at = last_run_at.replace(tzinfo=timezone.utc)
    return round(max(0.0, (now - last_run_at).total_seconds() / 86400), 1)
