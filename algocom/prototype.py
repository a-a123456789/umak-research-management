"""CRM service-step tracking: algorithm module. No UI, no database, stdlib only.

evaluate_proposed : Kahn validation + set-based readiness check, O(V + E + Q) under average-case hash operations
evaluate_baseline : repeated-scan validation + loop-based readiness check, O(V * (V + E) + Q) worst-case upper bound

Both take identical inputs and return the same output contract. Inputs are never mutated.
Optional stats dict receives counters: requirement_checks, passes (baseline only).
"""
from collections import deque


def _err(kind, msg):
    return {"status": "ERROR", "error_type": kind, "message": msg}


def _build(steps, deps):
    """Shared setup, O(V + E): structural checks and adjacency/prerequisite maps."""
    if not steps:
        return None, _err("EMPTY_WORKFLOW", "Workflow has no steps.")
    if len(set(steps)) != len(steps):
        return None, _err("DUPLICATE_STEP_ID", "Step identifiers must be unique.")
    adj = {v: [] for v in steps}
    prereqs = {v: set() for v in steps}
    indeg = {v: 0 for v in steps}
    for u, v in deps:
        if u not in adj or v not in adj:
            return None, _err("INVALID_WORKFLOW_GRAPH", "Dependency contains an unknown step identifier.")
        adj[u].append(v)
        prereqs[v].add(u)
        indeg[v] += 1
    return (adj, prereqs, indeg), None


def _check_state(prereqs, completed, step_reqs):
    """Shared record-consistency checks, O(V + E + number of requirement keys)."""
    for c in completed:
        if c not in prereqs:
            return _err("UNKNOWN_COMPLETED_STEP", "Completed set contains an unknown step identifier.")
    for c in completed:
        if prereqs[c] - completed:
            return _err("INCONSISTENT_COMPLETION", "A completed step has an unfinished prerequisite.")
    for k in step_reqs:
        if k not in prereqs:
            return _err("UNKNOWN_REQUIREMENT_STEP", "Requirements reference an unknown step identifier.")
    return None


COMPLETE = {"status": "COMPLETE", "ready_steps": [], "blocked_steps": []}


def evaluate_proposed(steps, deps, completed, verified, step_reqs, stats=None):
    built, err = _build(steps, deps)
    if err:
        return err
    adj, prereqs, indeg = built

    # Kahn's algorithm: cycle detection, O(V + E)
    queue = deque(v for v in steps if indeg[v] == 0)
    processed = 0
    while queue:
        cur = queue.popleft()
        processed += 1
        for nb in adj[cur]:
            indeg[nb] -= 1
            if indeg[nb] == 0:
                queue.append(nb)
    if processed != len(steps):
        return _err("CYCLIC_DEPENDENCY_DETECTED", "Workflow graph contains an invalid cyclic dependency.")

    err = _check_state(prereqs, completed, step_reqs)
    if err:
        return err
    if len(completed) == len(steps):
        return {"status": "COMPLETE", "ready_steps": [], "blocked_steps": []}

    # Readiness: set differences, O(V + E + Q)
    ready, blocked, checks = [], [], 0
    for v in steps:
        if v in completed:
            continue
        missing_p = prereqs[v] - completed
        req = step_reqs.get(v, ())
        checks += len(req)
        missing_r = [q for q in req if q not in verified]
        if not missing_p and not missing_r:
            ready.append(v)
        else:
            reasons = ["Unsatisfied prerequisite: " + p for p in missing_p]
            reasons += ["Unsatisfied requirement: " + q for q in missing_r]
            blocked.append({"step": v, "reasons": reasons})
    if stats is not None:
        stats["requirement_checks"] = checks
    return {"status": "SUCCESS", "ready_steps": ready, "blocked_steps": blocked}


def evaluate_baseline(steps, deps, completed, verified, step_reqs, stats=None):
    built, err = _build(steps, deps)
    if err:
        return err
    _, prereqs, _ = built

    # Repeated scan: each pass visits every unresolved step in list order and resolves it
    # when all its prerequisites are resolved. Stop when a pass resolves nothing.
    resolved, passes, changed = set(), 0, True
    while changed:
        changed = False
        passes += 1
        for v in steps:
            if v in resolved:
                continue
            ok = True
            for p in prereqs[v]:
                if p not in resolved:
                    ok = False
                    break
            if ok:
                resolved.add(v)
                changed = True
    if stats is not None:
        stats["passes"] = passes
    if len(resolved) != len(steps):
        return _err("CYCLIC_DEPENDENCY_DETECTED", "Workflow graph contains an invalid cyclic dependency.")

    err = _check_state(prereqs, completed, step_reqs)
    if err:
        return err
    if len(completed) == len(steps):
        return {"status": "COMPLETE", "ready_steps": [], "blocked_steps": []}

    ready, blocked, checks = [], [], 0
    for v in steps:
        if v in completed:
            continue
        reasons = []
        for p in prereqs[v]:
            if p not in completed:
                reasons.append("Unsatisfied prerequisite: " + p)
        for q in step_reqs.get(v, ()):
            checks += 1
            if q not in verified:
                reasons.append("Unsatisfied requirement: " + q)
        if reasons:
            blocked.append({"step": v, "reasons": reasons})
        else:
            ready.append(v)
    if stats is not None:
        stats["requirement_checks"] = checks
    return {"status": "SUCCESS", "ready_steps": ready, "blocked_steps": blocked}


def canonical(result):
    """Order-independent form used to compare the two methods."""
    if result["status"] == "ERROR":
        return ("ERROR", result["error_type"])
    return (result["status"], tuple(sorted(result["ready_steps"])),
            tuple(sorted((b["step"], tuple(sorted(b["reasons"]))) for b in result["blocked_steps"])))
