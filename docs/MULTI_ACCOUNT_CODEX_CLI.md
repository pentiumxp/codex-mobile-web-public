# Multi-Account Codex CLI

This document records the current implementation boundary and local operating
pattern for running multiple ChatGPT/Codex accounts on the same Windows
machine when Codex CLI is sufficient and Codex Desktop GUI isolation is not a
requirement.

## Scope

This document is about:

- multiple Codex CLI homes on one Windows machine;
- per-account `CODEX_HOME` separation;
- the boundary between CLI isolation and Desktop App global state;
- how a future dual-account Codex Mobile design should build on CLI isolation.

This document is not about:

- sharing one Codex Mobile instance across multiple accounts;
- changing Codex Desktop package internals;
- storing raw secrets in the repository.

## Current Conclusion

On this machine:

- `CODEX_HOME` is sufficient to isolate Codex CLI file state such as:
  - `auth.json`
  - `config.toml`
  - local state/history databases
  - goals
  - local indexes and per-home runtime metadata
- `CODEX_HOME` is not sufficient to isolate the current Codex Desktop App GUI
  ChatGPT login state.

The practical result is:

- multi-account Codex CLI is feasible;
- multi-account Codex Desktop GUI using only `CODEX_HOME` is not currently a
  valid assumption on this machine.

## Local Layout

The current local CLI-home layout is:

```text
C:\Users\xuxin\.codex-homes\
  current\
  previous\
```

Current state observed during implementation:

- `current`
  - has its own `auth.json`
  - `codex login status` returned `Logged in using ChatGPT`
- `previous`
  - had its own `config.toml`
  - did not yet have `auth.json`
  - `codex login status` returned `Not logged in`

## Shared vs Isolated Files

### Isolated per home

These should remain per-account / per-home:

- `auth.json`
- `config.toml`
- `.codex-global-state.json`
- local state/history sqlite files
- per-home goals/session index files

### Shared by junction where acceptable

To avoid unnecessary duplication, some non-auth assets may be shared from the
existing global Codex directories when the operational goal is CLI account
separation rather than full binary/plugin duplication. The current local setup
used shared/junction-style reuse for directories such as:

- `plugins`
- `skills`
- `memories`
- cache-like folders
- browser/runtime helper folders

This is acceptable only because these shared directories are not the primary
account-identity boundary. The account boundary is the isolated home-level auth
and state files.

## Current Local Launchers

The current local helper launchers are outside the repository:

- `C:\Users\xuxin\OneDrive\Desktop\Codex-Current-Account.cmd`
- `C:\Users\xuxin\OneDrive\Desktop\Codex-Current-Account-Login.cmd`
- `C:\Users\xuxin\OneDrive\Desktop\Codex-Previous-Account.cmd`
- `C:\Users\xuxin\OneDrive\Desktop\Codex-Previous-Account-Login.cmd`

Current launcher behavior:

- set `CODEX_HOME` to the selected home;
- default the workspace to `C:\Users\xuxin\Documents\Agent` if no path argument
  is provided;
- allow a custom workspace path as the first argument.

Conceptually they are equivalent to:

```cmd
@echo off
set "CODEX_HOME=C:\Users\xuxin\.codex-homes\current"
set "CODEX_WORKSPACE=%~1"
if "%CODEX_WORKSPACE%"=="" set "CODEX_WORKSPACE=C:\Users\xuxin\Documents\Agent"
start "" "C:\Users\xuxin\AppData\Local\OpenAI\Codex\bin\codex.exe" app "%CODEX_WORKSPACE%"
```

and:

```cmd
@echo off
set "CODEX_HOME=C:\Users\xuxin\.codex-homes\previous"
"C:\Users\xuxin\AppData\Local\OpenAI\Codex\bin\codex.exe" login --device-auth
pause
```

## Verification Commands

Use explicit `CODEX_HOME` when verifying which account/home is active:

```powershell
$env:CODEX_HOME='C:\Users\xuxin\.codex-homes\current'
& 'C:\Users\xuxin\AppData\Local\OpenAI\Codex\bin\codex.exe' login status
```

```powershell
$env:CODEX_HOME='C:\Users\xuxin\.codex-homes\previous'
& 'C:\Users\xuxin\AppData\Local\OpenAI\Codex\bin\codex.exe' login status
```

Useful file checks:

```powershell
Get-ChildItem C:\Users\xuxin\.codex-homes\current
Get-ChildItem C:\Users\xuxin\.codex-homes\previous
Test-Path C:\Users\xuxin\.codex-homes\previous\auth.json
```

## Important Boundary: Desktop App

Observed behavior in this environment:

- a Desktop/App-oriented login attempt under the `previous` launcher did not
  create `C:\Users\xuxin\.codex-homes\previous\auth.json`;
- the Desktop App still reflected the already logged-in current account.

Therefore, the working assumption for future agents should be:

- Codex Desktop GUI login state is global to the installed app package on this
  machine;
- it must not be treated as a reliable per-`CODEX_HOME` isolation boundary;
- future multi-account work should target Codex CLI first unless a different
  Desktop isolation mechanism is validated with concrete evidence.

## Implication For Codex Mobile

One Codex Mobile Web instance cannot represent two accounts at once, because
one instance has:

- one runtime directory;
- one access key boundary;
- one app-server/CLI chain;
- one port/listener identity.

If future work requires dual-account Codex Mobile while avoiding Desktop:

1. finish true multi-account Codex CLI login separation first;
2. run one Mobile Web instance per account;
3. give each instance its own:
   - `CODEX_HOME`
   - runtime dir
   - access key
   - port
   - startup wrapper/service instance

Example conceptual shape:

```text
Account A
  CODEX_HOME = C:\Users\xuxin\.codex-homes\current
  Mobile Web port = 8787

Account B
  CODEX_HOME = C:\Users\xuxin\.codex-homes\previous
  Mobile Web port = 8788
```

## Recommended Next Step When Work Resumes

When this effort resumes, do not start with Codex Mobile.

Start with the missing CLI account login boundary:

1. verify `previous` still has no `auth.json`;
2. run a CLI login flow that truly writes to
   `C:\Users\xuxin\.codex-homes\previous`;
3. re-run `codex login status` under both homes;
4. only after that, design dual Mobile Web service instances.

## Safety

- Do not store raw tokens, copied `auth.json` contents, or device-auth secrets
  in repository files.
- Do not edit WindowsApps package internals to force Desktop isolation.
- Do not assume a GUI login changed a per-home CLI auth state unless the target
  home's `auth.json` or explicit `codex login status` proves it.
