import copy, random, unittest
from prototype import evaluate_proposed, evaluate_baseline, canonical

IMPLS = [evaluate_proposed, evaluate_baseline]
SPSS_STEPS = [f"S{i}" for i in range(1, 10)]
SPSS_EDGES = [(f"S{i}", f"S{i+1}") for i in range(1, 9)]


class Cases(unittest.TestCase):
    def each(self, args):
        for f in IMPLS:
            with self.subTest(impl=f.__name__):
                yield f(*copy.deepcopy(args))

    def test_sequence(self):
        for r in self.each((["a", "b"], [("a", "b")], {"a"}, set(), {})):
            self.assertEqual((r["status"], r["ready_steps"], r["blocked_steps"]), ("SUCCESS", ["b"], []))

    def test_branching(self):
        for r in self.each((["a", "b", "c"], [("a", "b"), ("a", "c")], {"a"}, set(), {})):
            self.assertEqual(sorted(r["ready_steps"]), ["b", "c"])

    def test_branch_join_needs_both(self):
        for r in self.each((["a", "b", "c"], [("a", "c"), ("b", "c")], {"a"}, set(), {})):
            self.assertEqual(sorted(x["step"] for x in r["blocked_steps"]), ["c"])
            self.assertEqual(r["blocked_steps"][0]["reasons"], ["Unsatisfied prerequisite: b"])
            self.assertEqual(r["ready_steps"], ["b"])

    def test_unmet_requirement(self):
        for r in self.each((["a", "b"], [("a", "b")], {"a"}, set(), {"b": {"proof"}})):
            self.assertEqual(r["ready_steps"], [])
            self.assertEqual(r["blocked_steps"], [{"step": "b", "reasons": ["Unsatisfied requirement: proof"]}])

    def test_completed_workflow(self):
        for r in self.each((["a", "b"], [("a", "b")], {"a", "b"}, set(), {})):
            self.assertEqual(r, {"status": "COMPLETE", "ready_steps": [], "blocked_steps": []})

    def test_cycle(self):
        for r in self.each((["a", "b"], [("a", "b"), ("b", "a")], set(), set(), {})):
            self.assertEqual(r["error_type"], "CYCLIC_DEPENDENCY_DETECTED")
            self.assertNotIn("ready_steps", r)

    def test_self_loop_and_cycle_with_entry(self):
        for r in self.each((["a"], [("a", "a")], set(), set(), {})):
            self.assertEqual(r["error_type"], "CYCLIC_DEPENDENCY_DETECTED")
        for r in self.each((["s", "a", "b"], [("s", "a"), ("a", "b"), ("b", "a")], set(), set(), {})):
            self.assertEqual(r["error_type"], "CYCLIC_DEPENDENCY_DETECTED")

    def test_spss_scenario_1_and_2(self):
        reqs = {"S5": {"proof_of_payment"}}
        for r in self.each((SPSS_STEPS, SPSS_EDGES, {"S1", "S2", "S3", "S4"}, set(), reqs)):
            self.assertEqual(r["ready_steps"], [])
            self.assertEqual([b["step"] for b in r["blocked_steps"]], ["S5", "S6", "S7", "S8", "S9"])
            self.assertEqual(r["blocked_steps"][0]["reasons"], ["Unsatisfied requirement: proof_of_payment"])
            self.assertEqual(r["blocked_steps"][1]["reasons"], ["Unsatisfied prerequisite: S5"])
        for r in self.each((SPSS_STEPS, SPSS_EDGES, {"S1", "S2", "S3", "S4"}, {"proof_of_payment"}, reqs)):
            self.assertEqual(r["ready_steps"], ["S5"])
            self.assertEqual(len(r["blocked_steps"]), 4)

    def test_invalid_inputs(self):
        bad = {
            "EMPTY_WORKFLOW": ([], [], set(), set(), {}),
            "DUPLICATE_STEP_ID": (["a", "a"], [], set(), set(), {}),
            "INVALID_WORKFLOW_GRAPH": (["a"], [("a", "z")], set(), set(), {}),
            "UNKNOWN_COMPLETED_STEP": (["a"], [], {"z"}, set(), {}),
            "INCONSISTENT_COMPLETION": (["a", "b"], [("a", "b")], {"b"}, set(), {}),
            "UNKNOWN_REQUIREMENT_STEP": (["a"], [], set(), set(), {"z": {"x"}}),
        }
        for kind, args in bad.items():
            for r in self.each(args):
                self.assertEqual(r["error_type"], kind)

    def test_inputs_not_mutated(self):
        args = (SPSS_STEPS, SPSS_EDGES, {"S1"}, {"x"}, {"S2": {"x"}})
        for f in IMPLS:
            snap = copy.deepcopy(args)
            f(*args)
            self.assertEqual(args, snap)

    def test_requirement_check_counter(self):
        args = (["a", "b", "c"], [("a", "b"), ("b", "c")], {"a"}, set(), {"a": {"x"}, "b": {"y", "z"}, "c": {"w"}})
        for f in IMPLS:
            st = {}
            f(*args, stats=st)
            self.assertEqual(st["requirement_checks"], 3)  # completed step a is skipped

    def test_random_agreement(self):
        rng, ok, err = random.Random(7), 0, 0
        for _ in range(1000):
            n = rng.randint(1, 8)
            steps = [f"s{i}" for i in range(n)]
            edges = [(rng.choice(steps), rng.choice(steps)) for _ in range(rng.randint(0, 12))]
            if rng.random() < 0.6:
                edges = [(u, v) for u, v in edges if u < v]
            pre = {v: {u for u, w in edges if w == v} for v in steps}
            comp = {v for v in steps if rng.random() < 0.4}
            if rng.random() < 0.7:
                while True:
                    bad = {c for c in comp if pre[c] - comp}
                    if not bad:
                        break
                    comp -= bad
            reqs = {v: set(rng.sample("abc", rng.randint(0, 2))) for v in steps if rng.random() < 0.5}
            ver = set(rng.sample("abc", rng.randint(0, 3)))
            a = canonical(evaluate_proposed(steps, edges, comp, ver, reqs))
            b = canonical(evaluate_baseline(steps, edges, comp, ver, reqs))
            self.assertEqual(a, b)
            ok += a[0] != "ERROR"
            err += a[0] == "ERROR"
        self.assertGreater(ok, 100)
        self.assertGreater(err, 100)


if __name__ == "__main__":
    unittest.main()
