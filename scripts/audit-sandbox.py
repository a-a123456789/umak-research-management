#!/usr/bin/env python3
"""Trusted host-side launcher. Never runs target code on the host."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import shutil
import subprocess
import tempfile
import time
import uuid

IMAGE = 'node@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9'
ROOT = Path(__file__).resolve().parents[1]
OUTPUT_LIMIT = 65536


def docker(*args, **kwargs):
    return subprocess.run(['docker', *args], check=True, capture_output=True, timeout=180 if args[0] == 'pull' else 30, **kwargs)


def command(name, source, harness, mode):
    args = ['create', '--name', name, '--pull=never', '--network=none', '--ipc=none',
            '--read-only', '--user=65534:65534', '--cap-drop=ALL',
            '--security-opt=no-new-privileges:true', '--cpus=0.5', '--memory=256m',
            '--memory-swap=256m', '--pids-limit=64', '--ulimit=cpu=2:2',
            '--ulimit=fsize=8388608:8388608', '--ulimit=nofile=128:128',
            '--tmpfs=/scratch:rw,noexec,nosuid,nodev,size=64m,mode=1777',
            '--mount', f'type=bind,src={source},dst=/source,readonly',
            '--mount', f'type=bind,src={harness},dst=/harness,readonly',
            '--workdir=/scratch', '--log-driver=none', '--entrypoint=/usr/bin/env', IMAGE,
            '-i', 'HOME=/scratch', 'TMPDIR=/scratch', 'XDG_CACHE_HOME=/scratch',
            'LANG=C.UTF-8', 'PATH=/usr/local/bin:/usr/bin:/bin', '/usr/local/bin/node']
    if mode == 'workload':
        return args + ['--test', '/source/test/algorithm-result.test.js']
    return args + ['/harness/probes.mjs', mode]


def verify_config(config):
    host, cfg = config['HostConfig'], config['Config']
    required = {'NetworkMode': 'none', 'IpcMode': 'none', 'ReadonlyRootfs': True,
                'Memory': 268435456, 'MemorySwap': 268435456, 'PidsLimit': 64,
                'NanoCpus': 500000000, 'Privileged': False}
    for key, value in required.items():
        if host.get(key) != value:
            raise ValueError(f'Unexpected sandbox configuration: {key}')
    if cfg['User'] != '65534:65534' or 'ALL' not in host['CapDrop'] or 'no-new-privileges:true' not in host['SecurityOpt']:
        raise ValueError('Privilege controls missing')
    if ({m['Destination'] for m in config['Mounts'] if m['Type'] == 'bind'} != {'/source', '/harness'} or
            any(m.get('RW') for m in config['Mounts'] if m['Type'] == 'bind') or
            any(m['Type'] not in ('bind', 'tmpfs') for m in config['Mounts']) or
            host.get('Tmpfs') != {'/scratch': 'rw,noexec,nosuid,nodev,size=64m,mode=1777'}):
        raise ValueError('Unexpected sandbox mounts')
    limits = {x['Name']: (x['Soft'], x['Hard']) for x in host['Ulimits']}
    if limits != {'cpu': (2, 2), 'fsize': (8388608, 8388608), 'nofile': (128, 128)}:
        raise ValueError('Resource limits missing')


def run_check(source, harness, mode):
    name = 'crm-audit-' + uuid.uuid4().hex
    timeout = 2 if mode == 'wall' else 20
    result = {'check': mode, 'passed': False}
    proc = None
    try:
        docker(*command(name, source, harness, mode))
        config = json.loads(docker('inspect', name).stdout)[0]
        verify_config(config)
        proc = subprocess.Popen(['docker', 'start', '--attach', name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        start = time.monotonic()
        count = 0
        reason = None
        selector = selectors.DefaultSelector()
        selector.register(proc.stdout, selectors.EVENT_READ)
        while True:
            if time.monotonic() - start >= timeout:
                reason = 'wall_limit'
                break
            events = selector.select(0.1)
            if events:
                data = os.read(proc.stdout.fileno(), 8192)
                if not data:
                    break
                count += len(data)
                if count > OUTPUT_LIMIT:
                    reason = 'output_limit'
                    break
            elif proc.poll() is not None:
                break
        selector.close()
        if reason:
            docker('kill', name)
        proc.wait(timeout=5)
        state = json.loads(docker('inspect', name).stdout)[0]['State']
        if state['Running']:
            raise ValueError('Container still running')
        if mode == 'wall':
            passed = reason == 'wall_limit'
        elif mode == 'output':
            passed = reason == 'output_limit'
        elif mode == 'memory':
            passed = state['OOMKilled'] and reason is None
        elif mode == 'cpu':
            passed = state['ExitCode'] == 137 and not state['OOMKilled'] and reason is None
        elif mode == 'file-size':
            # SIGXFSZ is an acceptable kernel-enforced denial as well as EFBIG.
            passed = state['ExitCode'] in (0, 153) and reason is None
        else:
            passed = state['ExitCode'] == 0 and reason is None
        result.update(passed=passed, exit_code=state['ExitCode'], oom_killed=state['OOMKilled'],
                      termination=reason or 'process_exit', output_bytes=count,
                      elapsed_seconds=round(time.monotonic()-start, 3))
    except Exception as exc:
        # Do not retain target output, environment, or arbitrary daemon diagnostics.
        result['error_type'] = type(exc).__name__
        if isinstance(exc, ValueError):
            result['configuration_error'] = str(exc)
    finally:
        subprocess.run(['docker', 'rm', '--force', name], capture_output=True, timeout=15)
        if proc and proc.poll() is None:
            proc.kill()
            proc.wait(timeout=5)
        if proc and proc.stdout:
            proc.stdout.close()
    return result


def stage_source(destination):
    # Explicit minimal workload closure: never mount a checkout, .env, .git,
    # node_modules, credentials, host home, or retained evidence directory.
    paths = ['package.json', 'src/algorithm-result.js', 'test/algorithm-result.test.js']
    inventory = {}
    for item in paths:
        path = ROOT / item
        if path.is_symlink() or any(p.is_symlink() for p in path.parents):
            raise ValueError('Symlink in staged source')
        target = destination / item
        target.parent.mkdir(parents=True, exist_ok=True)
        content = path.read_bytes()
        target.write_bytes(content)
        target.chmod(0o444)
        inventory[item] = hashlib.sha256(content).hexdigest()
    return inventory


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.exists():
        parser.error('Output must be a new directory')
    output.mkdir(parents=True, mode=0o700)
    receipt = {'version': 1, 'image': IMAGE, 'status': 'blocked', 'checks': [],
               'scope': 'isolation probes and dependency-free worker-result unit tests',
               'limits': {'memory_bytes':268435456, 'cpu_cores':0.5, 'cpu_seconds':2,
                          'processes':64, 'file_bytes':8388608, 'scratch_bytes':67108864,
                          'wall_seconds':20, 'output_bytes':OUTPUT_LIMIT}}
    try:
        if not shutil.which('docker'):
            raise RuntimeError('Docker unavailable')
        if docker('info', '--format', '{{.OSType}}').stdout.strip() != b'linux':
            raise RuntimeError('Linux Docker engine required')
        # Pull is a trusted preparation phase; no target content executes here.
        docker('pull', IMAGE)
        receipt['source_ref'] = subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip()
        receipt['worktree_dirty'] = bool(subprocess.check_output(['git','status','--porcelain'], cwd=ROOT))
        with tempfile.TemporaryDirectory(prefix='crm-audit-') as temp:
            base = Path(temp)
            source, harness = base/'source', base/'harness'
            source.mkdir(mode=0o755); harness.mkdir(mode=0o755)
            receipt['source_files'] = stage_source(source)
            probe = ROOT/'security/sandbox/probes.mjs'
            shutil.copyfile(probe, harness/'probes.mjs')
            receipt['harness_sha256'] = hashlib.sha256(probe.read_bytes()).hexdigest()
            for mode in ['boundaries','file-size','disk','processes','memory','cpu','wall','output']:
                result = run_check(source, harness, mode)
                receipt['checks'].append(result)
                print(f"{mode}: {'PASS' if result['passed'] else 'FAIL'}", flush=True)
                if not result['passed']:
                    raise RuntimeError('Isolation gate failed')
            result = run_check(source, harness, 'workload')
            receipt['checks'].append(result)
            receipt['status'] = 'passed' if result['passed'] else 'failed'
    except Exception as exc:
        receipt['blocker_type'] = type(exc).__name__
    finally:
        (output/'receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    return 0 if receipt['status']=='passed' else 1

if __name__ == '__main__':
    raise SystemExit(main())
