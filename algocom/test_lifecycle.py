import random
import unittest
from lifecycle import ResearchState, STATES, TRANSITIONS, apply, replay
from engine import solve

class LifecycleTests(unittest.TestCase):
    def test_matrix(self):
        for source in STATES:
            for target in STATES:
                for method in ('table', 'conditional'):
                    state = ResearchState(source, '2026-01-01' if source == 'Completed' else None)
                    new, accepted = apply(state, (target, '2026-02-01'), method)
                    self.assertEqual(accepted, (source, target) in TRANSITIONS)
                    if not accepted:
                        self.assertIs(new, state)

    def test_independent_outcomes_and_dates(self):
        events = [(x, '2026-02-01') for x in ('Published', 'In-Progress', 'UnderReview', 'Completed')]
        state, accepted = replay(events)
        self.assertEqual(accepted, 4)
        new, ok = apply(state, ('Presented', '2026-04-01'))
        self.assertTrue(ok)
        self.assertEqual(new.completed_at, '2026-02-01')
        self.assertEqual(new.published_at, '2026-02-01')
        self.assertEqual(new.presented_at, '2026-04-01')
        self.assertEqual(apply(new, ('Published', '2026-05-01')), (new, False))

    def test_revision_and_rejections(self):
        state, count = replay([(x, '2026-02-01') for x in (
            'Completed', 'In-Progress', 'UnderReview', 'In-Progress', 'UnderReview', 'Completed', 'In-Progress')])
        self.assertEqual(count, 5)
        self.assertEqual(state.lifecycle, 'Completed')
        for event in (None, ('Published',), ('Presented', 'bad'), ('Presented', '2026-02-30'),
                      ('Presented', '20260201'), ('Presented', None), ('unknown', '2026-02-01')):
            self.assertEqual(apply(state, event), (state, False))

    def test_randomized_agreement(self):
        for seed in range(500):
            rng = random.Random(seed)
            events = [(rng.choice((*STATES, 'Presented', 'Published', 'bad')),
                       rng.choice(('2026-02-01', 'invalid'))) for _ in range(100)]
            self.assertEqual(replay(events), replay(events, 'conditional'))

    def test_dag_gate_example(self):
        payload = dict(steps=['review'], dependencies=[], completed_actions=[],
                       requirements={'review':[{'id':'approval','gate':'verified'}]},
                       evidence=[], durations={'review':10})
        state = ResearchState('UnderReview')
        # Caller combines an explicit evidence gate with the FSM; neither replaces the other.
        self.assertNotIn('review', solve(payload)['ready_steps'])
        self.assertEqual(state.lifecycle, 'UnderReview')
        payload['evidence'] = [{'id':'approval','state':'verified'}]
        self.assertIn('review', solve(payload)['ready_steps'])
        self.assertEqual(apply(state, ('Completed', '2026-02-01'))[0].lifecycle, 'Completed')

if __name__ == '__main__':
    unittest.main()
