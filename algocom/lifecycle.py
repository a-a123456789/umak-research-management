"""Pure lifecycle region with independent presentation/publication outcomes.
No persistence or authorization is implied. Dates are supplied ISO calendar dates.
"""
from dataclasses import dataclass, replace
from datetime import date

STATES = ('Registered', 'In-Progress', 'UnderReview', 'Completed')
TRANSITIONS = {
    ('Registered', 'In-Progress'),
    ('In-Progress', 'UnderReview'),
    ('UnderReview', 'In-Progress'),
    ('UnderReview', 'Completed'),
}

@dataclass(frozen=True)
class ResearchState:
    lifecycle: str = 'Registered'
    completed_at: str | None = None
    presented_at: str | None = None
    published_at: str | None = None


def apply(state, event, method='table'):
    """Return (new immutable state, accepted); rejected events leave state intact.

    Event is (action, ISO date). Dates describe occurrence, not receipt order.
    Outcomes can precede completion. Duplicate outcome records are rejected.
    """
    if method not in ('table', 'conditional'):
        raise ValueError('Unknown method')
    if not isinstance(state, ResearchState) or state.lifecycle not in STATES:
        raise ValueError('Invalid lifecycle state')
    if not isinstance(event, tuple) or len(event) != 2:
        return state, False
    action, occurred_at = event
    if not isinstance(occurred_at, str):
        return state, False
    try:
        parsed = date.fromisoformat(occurred_at)
        if parsed.isoformat() != occurred_at:
            return state, False
    except ValueError:
        return state, False
    if action in ('Presented', 'Published'):
        field = 'presented_at' if action == 'Presented' else 'published_at'
        if getattr(state, field) is not None:
            return state, False
        return replace(state, **{field: occurred_at}), True
    if method == 'table':
        allowed = (state.lifecycle, action) in TRANSITIONS
    else:
        allowed = (
            (state.lifecycle == 'Registered' and action == 'In-Progress') or
            (state.lifecycle == 'In-Progress' and action == 'UnderReview') or
            (state.lifecycle == 'UnderReview' and action in ('In-Progress', 'Completed'))
        )
    if not allowed:
        return state, False
    return replace(state, lifecycle=action,
                   completed_at=occurred_at if action == 'Completed' else state.completed_at), True


def replay(events, method='table'):
    state = ResearchState()
    accepted = 0
    for event in events:
        state, ok = apply(state, event, method)
        accepted += ok
    return state, accepted
