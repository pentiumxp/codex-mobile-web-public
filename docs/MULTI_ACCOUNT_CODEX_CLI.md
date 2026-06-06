# Multi-Account Codex CLI

This document records the current implementation boundary and local operating
pattern for running multiple ChatGPT/Codex accounts on the same Windows
machine when Codex CLI is sufficient and Codex Desktop GUI isolation is not a
requirement.

## Scope

This document is about:

- multiple Codex CLI homes on one Windows machine;
- per-account `CODEX_HOME` authentication separation;
- Mobile Web's single-active-profile switcher;
- the shared-thread-state links that keep existing workspaces and conversations
  visible after a Mobile Web account switch;
- the boundary between CLI isolation and Desktop App global state;
- how a future dual-account Codex Mobile design should build on CLI isolation.

This document is not about:

- running one Codex Mobile instance as two accounts at the same time;
- changing Codex Desktop package internals;
- storing raw secrets in the repository.

## Current Conclusion

On this machine:

- `CODEX_HOME` is sufficient to isolate Codex CLI account identity files such
  as:
  - `auth.json`
  - `config.toml`
- Mobile Web deliberately shares selected conversation/workspace state across
  profile homes so an account switch does not hide existing workspaces or
  threads.
- `CODEX_HOME` is not sufficient to isolate the current Codex Desktop App GUI
  ChatGPT login state.

The practical result is:

- multi-account Codex CLI is feasible;
- multi-account Codex Desktop GUI using only `CODEX_HOME` is not currently a
  valid assumption on this machine.

## Local Layout

The current local CLI-home layout is:

```text
%USERPROFILE%\.codex-homes\
  current\
  previous\
```

Current state observed during implementation:

- `default`: `%USERPROFILE%\.codex`
- `current`: `%USERPROFILE%\.codex-homes\current`
- `previous`: `%USERPROFILE%\.codex-homes\previous`

Current Mobile Web profile switching is built around these homes. Each profile
keeps its own `auth.json` and `config.toml`; non-default profile homes link the
conversation/workspace state listed below back to the default `.codex` home.
This deliberately separates account identity from conversation continuity.

## Shared vs Isolated Files

### Isolated per home

These should remain per-account / per-home:

- `auth.json`
- `config.toml`

Mobile Web must not copy the default account's `auth.json` or `config.toml`
over another profile. The Windows hidden/windowless launcher backs up existing
profile `auth.json` and `config.toml` under
`%USERPROFILE%\.codex-mobile-web\profile-auth-backups` before it prepares shared
state links, but those files remain profile-owned and are not committed.

### Shared by Mobile Web for thread continuity

To keep existing workspaces and conversations visible after switching Mobile
Web or relaunching Desktop through a profile wrapper, the Windows launchers link
these non-auth state paths from the default `%USERPROFILE%\.codex` home into a
non-default profile home:

- `.codex-global-state.json`
- `state_5.sqlite`
- `state_5.sqlite-wal`
- `state_5.sqlite-shm`
- `session_index.jsonl`
- `sessions/`
- `archived_sessions/`

Files are linked as hard links. Directories are linked as junctions. If a
non-default profile already has a local copy of one of those state paths, it is
moved under `%USERPROFILE%\.codex-mobile-web\profile-state-backups` before the
link is created. That backup path is runtime state, not repository content.
Profile-local `auth.json` and `config.toml` are backed up separately and are not
replaced by default-account files.

### Other shared or reused assets

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
and config files.

## Current Local Launchers

The current local helper launchers are outside the repository:

- `%USERPROFILE%\OneDrive\Desktop\Codex-Current-Account.cmd`
- `%USERPROFILE%\OneDrive\Desktop\Codex-Current-Account-Login.cmd`
- `%USERPROFILE%\OneDrive\Desktop\Codex-Previous-Account.cmd`
- `%USERPROFILE%\OneDrive\Desktop\Codex-Previous-Account-Login.cmd`

Current launcher behavior:

- set `CODEX_HOME` to the selected home;
- default the workspace to `%USERPROFILE%\Documents\Agent` if no path argument
  is provided;
- allow a custom workspace path as the first argument.

Conceptually they are equivalent to:

```cmd
@echo off
set "CODEX_HOME=%USERPROFILE%\.codex-homes\current"
set "CODEX_WORKSPACE=%~1"
if "%CODEX_WORKSPACE%"=="" set "CODEX_WORKSPACE=%USERPROFILE%\Documents\Agent"
start "" "%LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe" app "%CODEX_WORKSPACE%"
```

and:

```cmd
@echo off
set "CODEX_HOME=%USERPROFILE%\.codex-homes\previous"
"%LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe" login --device-auth
pause
```

## Verification Commands

Use explicit `CODEX_HOME` when verifying which account/home is active:

```powershell
$env:CODEX_HOME = Join-Path $env:USERPROFILE '.codex-homes\current'
& (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin\codex.exe') login status
```

```powershell
$env:CODEX_HOME = Join-Path $env:USERPROFILE '.codex-homes\previous'
& (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin\codex.exe') login status
```

Useful file checks:

```powershell
Get-ChildItem (Join-Path $env:USERPROFILE '.codex-homes\current')
Get-ChildItem (Join-Path $env:USERPROFILE '.codex-homes\previous')
Test-Path (Join-Path $env:USERPROFILE '.codex-homes\previous\auth.json')
```

## Important Boundary: Desktop App

Historical pre-switcher observation in this environment:

- a Desktop/App-oriented login attempt under a profile-specific launcher did
  not prove that the Desktop GUI login had been isolated per `CODEX_HOME`;
- the Desktop App still reflected the already logged-in current account.

That old observation is about Desktop GUI isolation, not the current Mobile Web
CLI profile state. Future agents should still assume:

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

The implemented simple Mobile Web path is therefore a single active profile
switcher, not concurrent providers:

- `adapters/codex-profile-service.js` owns profile discovery, safe
  `auth.json` account display, quota snapshots from rollout evidence, and the
  persisted active profile file.
- The settings panel lists `Default`, `Current`, and `Previous` when present,
  including the logged-in account label/email when it can be safely derived
  from `auth.json`. It never returns raw tokens.
- `POST /api/codex-profiles/active` writes the active profile to
  `%USERPROFILE%\.codex-mobile-web\codex-profiles.json` and restarts the
  Mobile Web shared chain.
- When that active profile store exists, `server.js` uses it before a stale
  inherited `CODEX_HOME`; `CODEX_HOME` is only allowed to override the store
  when `CODEX_MOBILE_CODEX_HOME_OVERRIDE=1` is explicitly set.
- `start-codex-mobile-web-windowless.ps1` reads that active profile before it
  starts the mux or Node listener, so the selected `CODEX_HOME` applies to all
  Mobile Web workspaces after restart.
- For non-default profiles, `start-codex-mobile-web-windowless.ps1` preserves
  profile-local `auth.json` and `config.toml`, then links shared conversation
  state back to default `%USERPROFILE%\.codex`. This is why account switching
  does not hide the existing workspace/thread list.
- `restart-codex-mobile-shared-chain.ps1` also resolves the active profile
  store before removing or waiting on the mux endpoint, so a profile switch
  does not restart against the default `.codex` endpoint by mistake. On
  Windows, it also treats the selected port's `node.exe ... server.js` listener
  as restart-owned even when the old process was started as bare
  `node server.js` from the workspace directory.
- `start-codex-desktop-shared.ps1 -ProfileId default|current|previous` and the
  matching `start-codex-desktop-*.cmd` wrappers are the Desktop recovery path
  for this design. They set `CODEX_HOME` for the launched Desktop bridge and
  point it at the selected profile's
  `<CODEX_HOME>\app-server-mux\endpoint.json`. For non-default profiles they
  also run the same non-auth shared-state hardlink/junction setup as the Mobile
  Web windowless launcher before Desktop starts. This does not prove that the
  Desktop GUI ChatGPT login is independently isolated; it makes the mux/app-
  server sharing path and thread/workspace state profile-aware while leaving
  profile auth/config files separate. The Desktop GUI is the only intended
  visible process; mux, Node, and app-server helper children started by the
  shared bridge must be launched without visible console windows.
- This switcher is disabled when Mobile Web is pinned to
  `CODEX_MOBILE_MUX_ENDPOINT_FILE`, `CODEX_MOBILE_APP_SERVER_WS`, or
  `CODEX_MOBILE_APP_SERVER_TCP`, because those fixed endpoints are outside the
  per-profile mux path.
- Inactive profile quota is a recent snapshot from that profile's rollout
  files, not a live API call unless that profile has recently been active.
- The browser clears local cached quota when the user confirms a profile switch.
  After restart, `/api/public-config` and `/api/status` snapshots repopulate the
  composer quota. The page-refresh prompt also applies the latest
  `/api/public-config` quota snapshot before reload.

## Harness Rules

Future profile-switching work should preserve these harness expectations:

- `test/codex-profile-service.test.js` covers safe account display, active
  profile persistence, active quota snapshot ownership, and disabling profile
  switch under fixed external endpoints.
- `test/codex-profile-ui.test.js` covers the settings UI, browser quota-cache
  clearing before switch restart, active-profile route wiring, and the
  windowless launcher's shared-state link list.
- `test/manual-restart-ui.test.js` covers explicit `profileId` / `codexHome`
  restart arguments for profile switches and manual restarts.
- `test/thread-visibility.test.js` / `test/mobile-viewport.test.js` should keep
  Codex worktree visibility compatible with both the active profile home and
  default `.codex`, because shared-state mode can expose default-home
  worktrees while the active auth profile is non-default.
- Documentation harness should fail if this document reverts to the old
  conclusion that `previous` has no `auth.json` or that all state files must be
  isolated per profile. That older fact was a temporary observation before the
  current shared-thread-state design.

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
  CODEX_HOME = %USERPROFILE%\.codex-homes\current
  Mobile Web port = 8787

Account B
  CODEX_HOME = %USERPROFILE%\.codex-homes\previous
  Mobile Web port = 8788
```

## Recommended Next Step When Work Resumes

For the current single-active-profile Mobile Web path, start by checking:

1. `/api/codex-profiles` safe account labels and `activeProfileId`;
2. `%USERPROFILE%\.codex-mobile-web\codex-profiles.json`;
3. `/api/status.codexHome` after the controlled restart;
4. `/api/status.codexHomeSource` and `/api/status.codexHomeEnvIgnored`; a
   healthy normal switch should report `profile-store`, and a stale shell
   `CODEX_HOME` should be ignored rather than controlling the running profile;
5. whether non-default profile homes still have local `auth.json` and
   `config.toml`;
6. whether `sessions/`, `archived_sessions/`, `state_5.sqlite*`,
   `.codex-global-state.json`, and `session_index.jsonl` are hard links or
   junctions to the default `.codex` state.

If future work requires true concurrent dual-account Mobile Web while avoiding
Desktop, do not extend the single-profile switcher into two simultaneous
providers. Run one Mobile Web instance per account with separate runtime dirs,
ports, access keys, and app-server/mux chains.

## Safety

- Do not store raw tokens, copied `auth.json` contents, or device-auth secrets
  in repository files.
- Do not edit WindowsApps package internals to force Desktop isolation.
- Do not assume a GUI login changed a per-home CLI auth state unless the target
  home's `auth.json` or explicit `codex login status` proves it.
