"""Encoding regression: python -m unittest discover -s scripts -p 'test_history.py'.

Simulates cp949 defaults and Windows newline translation; does not emulate Windows.
"""
import contextlib
import importlib.util
import io
from pathlib import Path
import shutil
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfoNotFoundError

SPEC = importlib.util.spec_from_file_location('history', Path(__file__).with_name('history.py'))
history = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(history)


class HistoryEncodingTest(unittest.TestCase):
    def test_missing_timezone_has_actionable_error(self):
        with patch('zoneinfo.ZoneInfo', side_effect=ZoneInfoNotFoundError('Asia/Seoul')):
            with self.assertRaisesRegex(SystemExit, 'Asia/Seoul timezone data is required'):
                runpy.run_path(str(Path(__file__).with_name('history.py')), run_name='history_missing_timezone')

    def test_cp949_defaults_and_crlf_translation(self):
        original_open = io.open
        original_check_output = subprocess.check_output

        def windows_open(file, mode='r', buffering=-1, encoding=None, errors=None,
                         newline=None, closefd=True, opener=None):
            if 'b' not in mode:
                if encoding in (None, 'locale'):
                    encoding = 'cp949'
                if 'w' in mode and newline is None:
                    newline = '\r\n'
            return original_open(file, mode, buffering, encoding, errors, newline, closefd, opener)

        def git_output(*args, **kwargs):
            self.assertEqual(kwargs.get('encoding'), 'utf-8')
            return original_check_output(*args, **kwargs)

        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / 'history'
            shutil.copytree(history.HISTORY, destination)
            outputs = [destination / 'data/phases.json', destination / 'appendix.md']
            # Normalize the fixture even if Git checked it out with CRLF on Windows.
            for path in outputs:
                path.write_bytes(path.read_text(encoding='utf-8').encode('utf-8'))
            before = {p: p.read_bytes() for p in outputs}
            with patch('io.open', windows_open):
                # Confirm the harness actually reproduces the reported default-decoding failure.
                with self.assertRaises(UnicodeDecodeError):
                    (destination / 'data/phases.json').read_text()
            with patch.object(history, 'HISTORY', destination), patch.object(history, 'DATA', destination / 'data'), patch('io.open', windows_open), patch('subprocess.check_output', git_output):
                for flags in ([], ['--write'], ['--verify-git'], ['--write'], []):
                    with self.subTest(flags=flags), patch('sys.argv', ['history.py'] + flags), contextlib.redirect_stdout(io.StringIO()) as output:
                        history.main()
                        self.assertEqual(output.getvalue().strip(), 'OK: 656 commits, 163 PRs, 159 issues; phase commits: 9, 36, 80, 116, 90, 33, 130, 37, 125')
                        for path in outputs:
                            raw = path.read_bytes()
                            raw.decode('utf-8')
                            self.assertNotIn(b'\r', raw)
                            self.assertEqual(raw, before[path])


if __name__ == '__main__':
    unittest.main()
