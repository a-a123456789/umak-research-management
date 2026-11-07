import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('launcher', Path(__file__).resolve().parents[2]/'scripts/audit-sandbox.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)

class LauncherTests(unittest.TestCase):
    def test_command_has_no_shell_or_host_environment_passthrough(self):
        args = launcher.command('synthetic', '/staged-source', '/trusted-harness', 'workload')
        for flag in ['--network=none','--ipc=none','--read-only','--cap-drop=ALL','--pull=never','--log-driver=none']:
            self.assertIn(flag, args)
        self.assertEqual(args[args.index(launcher.IMAGE)+1], '-i')
        self.assertNotIn('-e', args)
        self.assertNotIn('--privileged', args)
        self.assertEqual(args[-2:], ['--test','/source/test/algorithm-result.test.js'])
        self.assertTrue(all('docker.sock' not in a for a in args))

    def test_staging_only_copies_explicit_workload_closure(self):
        with tempfile.TemporaryDirectory() as d:
            inventory = launcher.stage_source(Path(d))
            self.assertEqual(set(inventory), {'package.json','src/algorithm-result.js','test/algorithm-result.test.js'})
            self.assertFalse((Path(d)/'.env').exists())
            self.assertTrue(all(len(value)==64 for value in inventory.values()))

    def test_config_rejects_relaxed_controls(self):
        cfg = {'HostConfig':{'NetworkMode':'host'},'Config':{}}
        with self.assertRaisesRegex(ValueError, 'NetworkMode'):
            launcher.verify_config(cfg)

if __name__ == '__main__':
    unittest.main()
