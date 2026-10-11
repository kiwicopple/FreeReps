"""Synthetic Git/backup regression tests; never contact Docker or a real database."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]

class PrivateOperationsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.run_cmd('git', 'init', '-q')
        self.run_cmd('git', 'config', 'user.name', 'Synthetic')
        self.run_cmd('git', 'config', 'user.email', 'test@example.invalid')
        (self.root / '.gitignore').write_text('backups/\n*.dump\n')
        self.run_cmd('git', 'add', '.')
        self.run_cmd('git', 'commit', '-qm', 'synthetic baseline')

    def run_cmd(self, *args, check=True, **kwargs):
        return subprocess.run(args, cwd=self.root, text=True, capture_output=True, check=check, **kwargs)

    def test_force_add_and_deleted_secret_history_are_blocked(self):
        """Ignore rules alone miss forced additions and secrets removed in a later commit."""
        checker = str(SOURCE / 'check-private-files.py')
        self.assertEqual(self.run_cmd('python3', checker).returncode, 0)
        base = self.run_cmd('git', 'rev-parse', 'HEAD').stdout.strip()
        (self.root / 'backups').mkdir()
        (self.root / 'backups/test.dump').write_bytes(b'PGDMP synthetic test')
        self.run_cmd('git', 'add', '-f', 'backups/test.dump')
        self.assertEqual(self.run_cmd('python3', checker, check=False).returncode, 1)
        self.run_cmd('git', 'commit', '-qm', 'bad synthetic commit')
        self.run_cmd('git', 'rm', 'backups/test.dump')
        self.run_cmd('git', 'commit', '-qm', 'delete synthetic fixture')
        head = self.run_cmd('git', 'rev-parse', 'HEAD').stdout.strip()
        result = self.run_cmd('python3', checker, '--push', check=False,
            input=f'refs/heads/main {head} refs/heads/main {base}\n')
        self.assertEqual(result.returncode, 1)

    def test_private_backup_and_failure_cleanup(self):
        """Failed dumps must never appear as successful archives or leave partial data."""
        (self.root / 'tools').mkdir()
        shutil.copy(SOURCE / 'backup-db.sh', self.root / 'tools/backup-db.sh')
        bin_dir = self.root / 'bin'
        bin_dir.mkdir()
        fake = bin_dir / 'docker'
        fake.write_text('#!/bin/sh\ncase "$*" in\n*pg_dump*) printf "PGDMP synthetic"; exit "${FAIL_DUMP:-0}";;\n*pg_restore*) cat >/dev/null;;\n*) exit 1;;\nesac\n')
        fake.chmod(0o700)
        env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ['PATH'])
        self.run_cmd('bash', 'tools/backup-db.sh', env=env)
        directory = self.root / 'backups/postgres'
        archive, = directory.glob('*.dump')
        self.assertEqual(archive.stat().st_mode & 0o777, 0o600)
        self.assertEqual(directory.stat().st_mode & 0o777, 0o700)
        self.assertTrue(Path(str(archive) + '.sha256').exists())
        env['FAIL_DUMP'] = '1'
        self.assertNotEqual(self.run_cmd('bash', 'tools/backup-db.sh', env=env, check=False).returncode, 0)
        self.assertEqual(len(list(directory.glob('*.dump'))), 1)
        self.assertFalse([p for p in directory.glob('.partial-*') if p.suffix != '.log'])

if __name__ == '__main__':
    unittest.main()
