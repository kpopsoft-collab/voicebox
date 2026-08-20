#!/usr/bin/env node
/**
 * Wrapper for `bun run dev` that picks the right dev flow:
 *
 *   • Rust toolchain available (cargo found on PATH, in `~/.cargo/bin`, or
 *     in a rustup toolchain) → run the Tauri desktop bundle via
 *     `bun run tauri dev` (the previous behaviour).
 *
 *   • Rust NOT available → spin up the browser-only stack in this single
 *     terminal. We run `bun run dev:server` as a background child and
 *     `bun run dev:web` in the foreground. When the user kills the parent
 *     (Ctrl-C) we tear down the server cleanly. This keeps the public
 *     contract of `bun run dev` — "start the app" — working on machines
 *     that have not installed Rust, instead of failing with an opaque
 *     `cargo metadata` error.
 *
 * The Tauri flow needs Rust because Tauri's CLI shells out to
 * `cargo metadata` at start-up; nothing else in the voicebox stack does.
 * See scripts/setup-dev-sidecar.js for why the placeholder sidecar files
 * are still produced (Tauri requires them on disk at compile time).
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";

// Detect a usable cargo. `~/.cargo/bin` is the rustup default but is not
// added to PATH automatically, so we probe it explicitly when `which` fails.
function which(binary) {
  if (isWindows) {
    const r = spawnSync("where", [binary], { encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim().split(/\r?\n/)[0] : null;
  }
  const r = spawnSync("which", [binary], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function findCargo() {
  return (
    which("cargo") ||
    which("cargo.exe") ||
    (process.env.HOME && (() => {
      const candidates = isWindows
        ? [join(process.env.HOME, ".cargo", "bin", "cargo.exe")]
        : [
            join(process.env.HOME, ".cargo", "bin", "cargo"),
            join(process.env.HOME, ".rustup", "toolchains", "stable", "bin", "cargo"),
          ];
      return candidates.find((p) => existsSync(p)) || null;
    })()) ||
    null
  );
}

const cargoPath = findCargo();
const hasRust = !!cargoPath;

if (!hasRust) {
  // No Rust → launch the browser-only dev stack in this terminal.
  //
  // Two child processes:
  //   1. dev:server (FastAPI on :17493) — runs in the background.
  //   2. dev:web (Vite on :5173) — runs in the foreground. This is what
  //      the user actually types into / Ctrl-C's to stop.
  //
  // `bun run dev:server` shells out to bare `uvicorn`, which resolves to
  // whatever interpreter is on PATH. macOS ships Python 3.9 in
  // /usr/bin/python3; the project requires 3.12+ (`Path | None` syntax
  // crashes 3.9). We sidestep the issue by detecting an appropriate
  // uvicorn ourselves before falling back to `bun run dev:server`.

  console.log(
    "\x1b[33m⚠\x1b[0m Rust toolchain not detected. Falling back to browser-only dev:",
  );
  console.log(
    "    FastAPI on :17493 (background)  +  Vite on :5173 (foreground)",
  );
  console.log(
    "    Install Rust for the full desktop shell:  \x1b[2mcurl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh\x1b[0m",
  );
  console.log("");

  const repoRoot = process.cwd();

  // ---------------------------------------------------------------
  // uvicorn / interpreter discovery
  // ---------------------------------------------------------------
  // Search order:
  //   1. backend/.venv/bin/uvicorn (project's intended venv, Python 3.12)
  //   2. backend/venv/bin/uvicorn (legacy venv, may be Python 3.11)
  //   3. `uv` CLI (Astral) → resolved with python>=3.12, no venv required.
  //   4. bare `uvicorn` on PATH.
  // We log which path we picked so a wrong venv is easy to spot.
  //
  // The server runs with `cwd: backendDir` so that `import backend.main`
  // works in both the parent AND the auto-reload watcher subprocess.
  // Spawning uvicorn with `--app-dir` works for the parent but the reload
  // watchdog forks an entirely fresh process with cwd inherited from the
  // caller; running from inside `backend/` is the only way to keep that
  // subprocess happy without juggling PYTHONPATH.
  const backendDir = join(repoRoot, "backend");
  const venvCandidates = [
    join(backendDir, ".venv", isWindows ? "Scripts" : "bin", "uvicorn"),
    join(backendDir, ".venv", isWindows ? "Scripts" : "bin", "uvicorn.exe"),
    join(backendDir, "venv", isWindows ? "Scripts" : "bin", "uvicorn"),
    join(backendDir, "venv", isWindows ? "Scripts" : "bin", "uvicorn.exe"),
  ];
  const venvUvicorn = venvCandidates.find((p) => existsSync(p));

  const uvCommand = which("uv");

  let serverSpec;
  if (venvUvicorn) {
    console.log(`    \x1b[2mserver → ${venvUvicorn}\x1b[0m`);
    serverSpec = { command: venvUvicorn, args: [
      "backend.main:app",
      "--reload",
      "--port", "17493",
    ], label: venvUvicorn };
  } else if (uvCommand) {
    console.log(`    \x1b[2mserver → uv run uvicorn (resolved python>=3.12)\x1b[0m`);
    serverSpec = { command: uvCommand, args: [
      "run",
      "--python", "3.12",
      "--directory", repoRoot,
      "--",
      "uvicorn",
      "backend.main:app",
      "--reload",
      "--port", "17493",
    ], label: "uv run uvicorn" };
  } else {
    console.log(`    \x1b[2mserver → bun run dev:server (PATH uvicorn)\x1b[0m`);
    serverSpec = { command: "bun", args: ["run", "dev:server"], label: "bun run dev:server" };
  }

  // 1. spawn dev:server in the background. We run from `backend/` so the
  // reload subprocess inherits the same `cwd`, but the *real* reason `cwd`
  // can't be the repo root for uvicorn is unrelated — the issue is that
  // `backend.main` resolves via `import backend.main`, which needs `backend`
  // to be importable. We prepend the repo root to PYTHONPATH so that the
  // reload watcher subprocess inherits a path where `backend` resolves.
  // (Setting PYTHONPATH only would also work; setting cwd to backend/ too
  // means the watcher reads paths relative to its own location, which is
  // what backend/expects — and it sets up the venv site-packages lookup
  // without interference from stale `__pycache__` artefacts elsewhere.)
  const pyPath = [repoRoot, process.env.PYTHONPATH].filter(Boolean).join(":");
  const server = spawn(serverSpec.command, serverSpec.args, {
    cwd: backendDir,
    stdio: "inherit",
    env: { ...process.env, PYTHONPATH: pyPath },
  });

  // 2. wait briefly for the server to start accepting connections before we
  //    start Vite — Vite's proxy will retry, but a small pause hides the
  //    first wave of "ECONNREFUSED" log noise during cold start.
  await new Promise((r) => setTimeout(r, 1500));

  // 3. spawn dev:web in the foreground
  const web = spawn("bun", ["run", "dev:web"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  // Tear down the server when the foreground web process exits (whether
  // via Ctrl-C, error, or natural exit).
  let serverDown = false;
  const killServer = () => {
    if (serverDown) return;
    serverDown = true;
    if (!server.killed && server.exitCode == null) {
      server.kill("SIGTERM");
    }
  };

  web.on("exit", (code, signal) => {
    killServer();
    if (signal) {
      console.error(`dev:web killed with signal ${signal}`);
      process.exit(1);
    }
    // dev:web typically exits 0 on Ctrl-C (Vite catches SIGINT).
    process.exit(code ?? 0);
  });

  // Forward Ctrl-C / SIGTERM to the foreground child so it propagates the
  // signal cleanly instead of leaving us with a hung Vite process.
  const forward = (sig) => {
    try {
      web.kill(sig);
    } catch {
      /* already exited */
    }
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));

  // If the server dies first, the web stack is useless — abort.
  server.on("exit", (code) => {
    if (serverDown) return; // user-initiated teardown after web exited
    if (code && code !== 0) {
      console.error(`\x1b[31mdev:server exited with code ${code}\x1b[0m`);
      try {
        web.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      process.exit(code);
    }
  });
} else {
  // Rust available — hand off to Tauri exactly as before.
  const cwd = join(process.cwd(), "tauri");
  const cmd = isWindows ? "bun.cmd" : "bun";
  const args = ["run", "tauri", "dev"];

  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`tauri dev killed with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}
