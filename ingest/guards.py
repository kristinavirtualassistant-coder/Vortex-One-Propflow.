"""Scope guards for source-ingestion freshness bookkeeping."""


def is_complete_refresh(limit=None, where=None):
    """Return True only when a load covers the configured source scope.

    A row limit is a sample, and an explicit query override is potentially
    narrower than the configured source selection. Neither may advance the
    source's full-refresh timestamp or mark unseen rows as seen.
    """
    return limit is None and not (where and where.strip())
