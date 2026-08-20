#!/usr/bin/env node
/**
 * Wrapper for `bun run dev` that detects whether the Rust toolchain is
 * available before invoking Tauri. Tauri (the desktop shell) is written in
 * Rust and its CLI shells out to `cargo metadata` at start-up — running
 * `bun run dev` on a machine without Rust produces a confusing
 * "cargo metadata: No such file or directory" error rather than a useful
 * pointer to the alternatives.
 *
 * Behaviour:
 *   • `cargo` found on PATH (or `~/.cargo/bin/cargo`) → run Tauri dev as before
 *   • Not found → print a friendly banner with two paths:
 *       1. Install Rust (link + version hint)
 *       2. Use the browser-only flows (`bun run dev:web` + `bun run dev:server`)
 *     and exit 0 so that wrappers like `just dev` succeed.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";

// `cargo` is shipped in the same directory as `rustc`. Probe a few common
// locations before bailing — `~/.cargo/bin` won't be on PATH if the user
// installed via rustup but never sourced the env file.
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
  const c = (s) => `\x1b[36m${s}\x1b[0m`;
  const y = (s) => `\x1b[33m${s}\x1b[0m`;
  const r = (s) => `\x1b[31m${s}\x1b[0m`;
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;

  console.error(`${y("⚠")} ${r("Rust toolchain not detected.")}`);
  console.error(`${y("⚠")} ${y("`bun run dev`")} launches the Tauri desktop bundle which`);
  console.error(`${y("⚠")}   requires ${c("cargo")} on PATH. On macOS the homebrew install path`);
  console.error(`${y("⚠")}   is silent if rustup was installed manually without sourcing`);
  console.error(`${y("⚠")}   ${c("~/.cargo/env")}. Tauri would otherwise crash with:`);
  console.error("");
  console.error(`   ${dim("`cargo metadata` failed: No such file or directory (os error 2)")}`);
  console.error("");
  console.error(`${y("→")} ${c("Option 1 · Install Rust (then re-run `bun run dev`):")}`);
  console.error("");
  console.error(`   ${c("curl")} --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | ${c("sh")}`);
  console.error(`   ${dim("# restart the shell afterwards so the new PATH is in effect")}`);
  console.error("");
  console.error(`${y("→")} ${c("Option 2 · Browser-only dev (no Rust required):")}`);
  console.error("");
  console.error(`   Terminal A:  ${c("bun run dev:server")}    ${dim("# FastAPI @ http://localhost:17493")}`);
  console.error(`   Terminal B:  ${c("bun run dev:web")}       ${dim("# Vite @ http://localhost:5173 (proxies /mcp → 17493)")}`);
  console.error("");
  console.error(`${y("→")} ${c("Other targets that don't need Rust right now:")}`);
  console.error("");
  console.error(`   ${c("bun run build:web")}      ${dim("# compile the static web bundle")}`);
  console.error(`   ${c("bun run typecheck")}      ${dim("# tsc, no native deps")}`);
  console.error(`   ${c("bun run lint")}            ${dim("# biome, no native deps")}`);
  console.error("");
  process.exit(0);
}

// Rust is available — hand off to Tauri. We `cd tauri` so the tauri CLI
// picks up the right workspace, exactly like the previous inline command.
const cwd = join(process.cwd(), "tauri");
const cmd = isWindows ? "bun.cmd" : "bun";
const args = ["run", "tauri", "dev"];

const child = spawn(cmd, args, {
  cwd,
  stdio: "inherit",
  env: { ...process.env, PATH: process.env.PATH },
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
