"""Checks that launcher labels are isolated across LCFS worktrees."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

REPO_ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = REPO_ROOT / "scripts" / "local-keycloak-stack.sh"


class LocalKeycloakStackTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix="lcfs-stack-test-")
        self.root = Path(self.temp_dir.name)
        self.state_dir = self.root / "state"
        self.bin_dir = self.root / "bin"
        self.bin_dir.mkdir()
        self.docker_log = self.root / "docker.jsonl"
        self.config_log = self.root / "compose-config.jsonl"
        self._install_docker_stub()

    def tearDown(self):
        self.temp_dir.cleanup()

    def _install_docker_stub(self):
        docker_stub = self.bin_dir / "docker"
        docker_stub.write_text(
            "#!/usr/bin/env python3\n"
            "import json, os, sys, time\n"
            "from pathlib import Path\n"
            "with open(os.environ['LCFS_TEST_DOCKER_LOG'], 'a') as log:\n"
            "    log.write(json.dumps(sys.argv[1:]) + '\\n')\n"
            "args = sys.argv[1:]\n"
            "env_file = Path(args[args.index('--env-file') + 1])\n"
            "config = dict(line.split('=', 1) for line in env_file.read_text().splitlines())\n"
            "with open(os.environ['LCFS_TEST_CONFIG_LOG'], 'a') as log:\n"
            "    log.write(json.dumps(config) + '\\n')\n"
            "if 'up' in args and os.environ.get('LCFS_TEST_PAUSE_COMPOSE_UP') == '1':\n"
            "    marker = Path(os.environ['LCFS_TEST_MARKER'])\n"
            "    marker.touch()\n"
            "    deadline = time.monotonic() + 10\n"
            "    while not marker.with_suffix('.release').exists():\n"
            "        if time.monotonic() > deadline:\n"
            "            raise SystemExit('test synchronization timed out')\n"
            "        time.sleep(0.01)\n"
        )
        docker_stub.chmod(0o755)

    def _install_pausing_python_stub(self):
        python_stub = self.bin_dir / "python3"
        python_stub.write_text(
            f"#!{sys.executable}\n"
            "import os, pathlib, subprocess, sys, time\n"
            "code = sys.stdin.read()\n"
            "result = subprocess.run([sys.executable, *sys.argv[1:]], input=code, text=True)\n"
            "if 'def write_config(config)' in code and os.environ.get('LCFS_TEST_PAUSE_CONFIG_WRITER') == '1':\n"
            "    marker = pathlib.Path(os.environ['LCFS_TEST_MARKER'])\n"
            "    marker.touch()\n"
            "    deadline = time.monotonic() + 10\n"
            "    while not marker.with_suffix('.release').exists():\n"
            "        if time.monotonic() > deadline:\n"
            "            raise SystemExit('test synchronization timed out')\n"
            "        time.sleep(0.01)\n"
            "raise SystemExit(result.returncode)\n"
        )
        python_stub.chmod(0o755)

    def _install_read_pausing_sitecustomize(self):
        (self.bin_dir / "sitecustomize.py").write_text(
            "import os, pathlib, time\n"
            "if os.environ.get('LCFS_TEST_PAUSE_EXISTING_READ') == '1':\n"
            "    original_read_text = pathlib.Path.read_text\n"
            "    def paused_read_text(path, *args, **kwargs):\n"
            "        if path.name.endswith('-agent-a.env'):\n"
            "            marker = pathlib.Path(os.environ['LCFS_TEST_MARKER'])\n"
            "            marker.touch()\n"
            "            deadline = time.monotonic() + 10\n"
            "            while not marker.with_suffix('.release').exists():\n"
            "                if time.monotonic() > deadline:\n"
            "                    raise RuntimeError('test synchronization timed out')\n"
            "                time.sleep(0.01)\n"
            "        return original_read_text(path, *args, **kwargs)\n"
            "    pathlib.Path.read_text = paused_read_text\n"
        )

    def _make_worktree(self, name):
        worktree = self.root / name
        scripts = worktree / "scripts"
        scripts.mkdir(parents=True)
        shutil.copy2(LAUNCHER, scripts / LAUNCHER.name)
        (worktree / "docker-compose.yml").touch()
        (worktree / "docker-compose.local-keycloak.yml").touch()
        return worktree

    def _run(self, worktree, *args):
        env = os.environ.copy()
        env.update(
            {
                "PATH": f"{self.bin_dir}:{env['PATH']}",
                "LCFS_LOCAL_KEYCLOAK_STATE_DIR": str(self.state_dir),
                "LCFS_TEST_DOCKER_LOG": str(self.docker_log),
                "LCFS_TEST_CONFIG_LOG": str(self.config_log),
            }
        )
        for name in (
            "LCFS_FRONTEND_PUBLISHED_PORT",
            "LCFS_BACKEND_PUBLISHED_PORT",
            "LCFS_BACKEND_DEBUG_PUBLISHED_PORT",
            "LCFS_DB_PUBLISHED_PORT",
            "LCFS_REDIS_PUBLISHED_PORT",
            "LCFS_RUSTFS_PUBLISHED_PORT",
            "LCFS_RUSTFS_CONSOLE_PUBLISHED_PORT",
            "LCFS_KEYCLOAK_PUBLISHED_PORT",
            "LCFS_LOCAL_KEYCLOAK_HOSTNAME",
        ):
            env.pop(name, None)

        result = subprocess.run(
            ["bash", str(worktree / "scripts" / LAUNCHER.name), *args],
            check=True,
            capture_output=True,
            text=True,
            env=env,
        )
        return result.stdout

    def _docker_calls(self):
        if not self.docker_log.exists():
            return []
        return [json.loads(line) for line in self.docker_log.read_text().splitlines()]

    def _compose_configs(self):
        if not self.config_log.exists():
            return []
        return [json.loads(line) for line in self.config_log.read_text().splitlines()]

    @staticmethod
    def _option_value(args, option):
        return args[args.index(option) + 1]

    def test_same_label_isolated_between_worktrees_and_stop_is_scoped(self):
        worktree_a = self._make_worktree("worktree-a")
        worktree_b = self._make_worktree("worktree-b")

        self._run(worktree_a, "start", "agent-a")
        self._run(worktree_b, "start", "agent-a")

        start_a, start_b = self._docker_calls()
        project_a = self._option_value(start_a, "--project-name")
        project_b = self._option_value(start_b, "--project-name")
        env_a = Path(self._option_value(start_a, "--env-file"))
        env_b = Path(self._option_value(start_b, "--env-file"))
        self.assertNotEqual(project_a, project_b)
        self.assertNotEqual(env_a, env_b)

        config_a = dict(line.split("=", 1) for line in env_a.read_text().splitlines())
        config_b = dict(line.split("=", 1) for line in env_b.read_text().splitlines())
        self.assertNotEqual(
            config_a["LCFS_LOCAL_KEYCLOAK_HOSTNAME"],
            config_b["LCFS_LOCAL_KEYCLOAK_HOSTNAME"],
        )
        ports_a = {value for key, value in config_a.items() if key.endswith("_PORT")}
        ports_b = {value for key, value in config_b.items() if key.endswith("_PORT")}
        self.assertTrue(ports_a.isdisjoint(ports_b))

        self._run(worktree_a, "stop", "agent-a")
        stop_call = self._docker_calls()[-1]
        self.assertEqual(self._option_value(stop_call, "--project-name"), project_a)
        self.assertFalse(env_a.exists())
        self.assertTrue(env_b.exists())

    def test_list_and_status_use_the_scoped_stack(self):
        worktree = self._make_worktree("worktree-a")
        self._run(worktree, "start", "agent-a")

        listed = self._run(worktree, "list")
        self._run(worktree, "status", "agent-a")

        project_name = self._option_value(self._docker_calls()[0], "--project-name")
        self.assertIn(project_name, listed)
        self.assertIn("http://localhost:", listed)
        self.assertGreaterEqual(len(self._docker_calls()), 3)
        self.assertIn("ps", self._docker_calls()[-1])
        self.assertEqual(
            self._option_value(self._docker_calls()[-1], "--project-name"),
            project_name,
        )

    def test_concurrent_start_never_reads_partial_stack_configuration(self):
        worktree = self._make_worktree("worktree-a")
        self._install_pausing_python_stub()
        env = os.environ.copy()
        env.update(
            {
                "PATH": f"{self.bin_dir}:{env['PATH']}",
                "LCFS_LOCAL_KEYCLOAK_STATE_DIR": str(self.state_dir),
                "LCFS_TEST_DOCKER_LOG": str(self.docker_log),
                "LCFS_TEST_CONFIG_LOG": str(self.config_log),
                "LCFS_TEST_MARKER": str(self.root / "config-written"),
                "LCFS_TEST_PAUSE_CONFIG_WRITER": "1",
            }
        )
        command = [
            "bash",
            str(worktree / "scripts" / LAUNCHER.name),
            "start",
            "agent-a",
        ]
        first_start = subprocess.Popen(
            command, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        second_start = None
        marker = self.root / "config-written"
        try:
            deadline = time.monotonic() + 10
            while not marker.exists():
                if first_start.poll() is not None or time.monotonic() > deadline:
                    self.fail("first launcher did not finish writing its configuration")
                time.sleep(0.01)

            second_env = env.copy()
            second_env.pop("LCFS_TEST_PAUSE_CONFIG_WRITER")
            second_start = subprocess.Popen(
                command,
                env=second_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            time.sleep(0.1)
            self.assertIsNone(
                second_start.poll(),
                "same stack starts must wait for its lifecycle lock",
            )
        finally:
            marker.with_suffix(".release").touch()
            first_start.communicate(timeout=10)
            if second_start is not None:
                second_start.communicate(timeout=10)

        self.assertEqual(first_start.returncode, 0)
        self.assertIsNotNone(second_start)
        self.assertEqual(second_start.returncode, 0)
        configs = self._compose_configs()
        self.assertEqual(len(configs), 2)
        hostnames = {config["LCFS_LOCAL_KEYCLOAK_HOSTNAME"] for config in configs}
        self.assertEqual(len(hostnames), 1)
        self.assertTrue(next(iter(hostnames)).endswith(".localhost"))

    def test_stopping_stack_waits_for_port_allocator_state_read(self):
        worktree = self._make_worktree("worktree-a")
        self._install_read_pausing_sitecustomize()
        command = ["bash", str(worktree / "scripts" / LAUNCHER.name)]
        self._run(worktree, "start", "agent-a")

        marker = self.root / "existing-state-read"
        env = os.environ.copy()
        env.update(
            {
                "PATH": f"{self.bin_dir}:{env['PATH']}",
                "PYTHONPATH": str(self.bin_dir),
                "LCFS_LOCAL_KEYCLOAK_STATE_DIR": str(self.state_dir),
                "LCFS_TEST_DOCKER_LOG": str(self.docker_log),
                "LCFS_TEST_CONFIG_LOG": str(self.config_log),
                "LCFS_TEST_MARKER": str(marker),
            }
        )
        new_stack_env = env.copy()
        new_stack_env["LCFS_TEST_PAUSE_EXISTING_READ"] = "1"
        starting = subprocess.Popen(
            [*command, "start", "agent-b"],
            env=new_stack_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stopping = None
        try:
            deadline = time.monotonic() + 10
            while not marker.exists():
                if starting.poll() is not None or time.monotonic() > deadline:
                    self.fail(
                        "new launcher did not start reading saved port assignments"
                    )
                time.sleep(0.01)

            stopping = subprocess.Popen(
                [*command, "stop", "agent-a"],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            time.sleep(0.1)
            self.assertIsNone(
                stopping.poll(), "stop must wait for the shared state lock"
            )
        finally:
            marker.with_suffix(".release").touch()
            starting.communicate(timeout=10)
            if stopping is not None:
                stopping.communicate(timeout=10)

        self.assertEqual(starting.returncode, 0)
        self.assertIsNotNone(stopping)
        self.assertEqual(stopping.returncode, 0)

    def test_stop_waits_until_same_stack_startup_finishes(self):
        worktree = self._make_worktree("worktree-a")
        marker = self.root / "compose-up-waiting"
        env = os.environ.copy()
        env.update(
            {
                "PATH": f"{self.bin_dir}:{env['PATH']}",
                "LCFS_LOCAL_KEYCLOAK_STATE_DIR": str(self.state_dir),
                "LCFS_TEST_DOCKER_LOG": str(self.docker_log),
                "LCFS_TEST_CONFIG_LOG": str(self.config_log),
                "LCFS_TEST_MARKER": str(marker),
                "LCFS_TEST_PAUSE_COMPOSE_UP": "1",
            }
        )
        command = ["bash", str(worktree / "scripts" / LAUNCHER.name)]
        starting = subprocess.Popen(
            [*command, "start", "agent-a"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stopping = None
        try:
            deadline = time.monotonic() + 10
            while not marker.exists():
                if starting.poll() is not None or time.monotonic() > deadline:
                    self.fail("start did not enter the mocked Compose startup")
                time.sleep(0.01)

            stop_env = env.copy()
            stop_env.pop("LCFS_TEST_PAUSE_COMPOSE_UP")
            stopping = subprocess.Popen(
                [*command, "stop", "agent-a"],
                env=stop_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            time.sleep(0.1)
            self.assertIsNone(
                stopping.poll(), "stop must wait for the matching startup to finish"
            )
        finally:
            marker.with_suffix(".release").touch()
            starting.communicate(timeout=10)
            if stopping is not None:
                stopping.communicate(timeout=10)

        self.assertEqual(starting.returncode, 0)
        self.assertIsNotNone(stopping)
        self.assertEqual(stopping.returncode, 0)
        docker_calls = self._docker_calls()
        self.assertIn("up", docker_calls[-2])
        self.assertEqual(docker_calls[-1][-1], "down")
        self.assertEqual(list(self.state_dir.glob("*.env")), [])


if __name__ == "__main__":
    unittest.main()
