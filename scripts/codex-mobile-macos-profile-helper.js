"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  authStatusForHome,
  createCodexProfileService,
  normalizeProfileId,
} = require("../adapters/codex-profile-service");

function usage() {
  process.stdout.write(`Usage: node scripts/codex-mobile-macos-profile-helper.js <list|select> [options]

Options:
  --profile-file <path>       Codex Mobile profile store file.
  --runtime-dir <path>        Codex Mobile runtime directory.
  --user-home <path>          User home that owns Codex homes.
  --active-codex-home <path>  Currently configured CODEX_HOME.
  --profile-id <id>           Select an existing configured profile id.
  --codex-home <path>         Select a Codex Home path; adds a local profile if needed.
  --no-write                  Resolve selection without writing the profile store.
  --format <json|shell|tsv>   Output format. list: json|tsv. select: json|shell.
  -h, --help                  Show this help.
`);
}

function parseArgs(argv) {
  const out = { command: "", format: "" };
  const args = [...argv];
  out.command = args.shift() || "";
  while (args.length) {
    const item = args.shift();
    switch (item) {
      case "--profile-file":
        out.profileFile = args.shift() || "";
        break;
      case "--runtime-dir":
        out.runtimeDir = args.shift() || "";
        break;
      case "--user-home":
        out.userHome = args.shift() || "";
        break;
      case "--active-codex-home":
        out.activeCodexHome = args.shift() || "";
        break;
      case "--profile-id":
        out.profileId = args.shift() || "";
        break;
      case "--codex-home":
        out.codexHome = args.shift() || "";
        break;
      case "--format":
        out.format = args.shift() || "";
        break;
      case "--no-write":
        out.noWrite = true;
        break;
      case "-h":
      case "--help":
        out.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${item}`);
    }
  }
  return out;
}

function safeReadJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, "'\\''")}'`;
}

function createService(options) {
  const env = options.env || process.env;
  const userHome = path.resolve(options.userHome || process.env.HOME || os.homedir());
  const runtimeRoot = path.resolve(options.runtimeDir || env.CODEX_MOBILE_RUNTIME_DIR || path.join(userHome, ".codex-mobile-web"));
  const storeFile = path.resolve(options.profileFile || env.CODEX_MOBILE_PROFILE_FILE || path.join(runtimeRoot, "codex-profiles.json"));
  const activeCodexHome = path.resolve(options.activeCodexHome || env.CODEX_HOME || path.join(userHome, ".codex"));
  const service = createCodexProfileService({
    userHome,
    runtimeRoot,
    storeFile,
    activeCodexHome,
    env: Object.assign({}, env),
  });
  return { service, userHome, runtimeRoot, storeFile, activeCodexHome };
}

function safeProfile(profile) {
  const auth = profile.auth || authStatusForHome(profile.codexHome);
  return {
    id: profile.id,
    label: profile.label,
    codexHome: profile.codexHome,
    active: Boolean(profile.active),
    exists: Boolean(profile.exists),
    auth: {
      status: auth.status || "unknown",
      label: auth.label || "",
      email: auth.email || undefined,
      name: auth.name || undefined,
    },
  };
}

function listProfiles(options) {
  const { service, storeFile, activeCodexHome } = createService(options);
  const result = service.profiles();
  return {
    ok: true,
    storeFile,
    activeProfileId: result.activeProfileId,
    activeCodexHome,
    profiles: result.profiles.map(safeProfile),
  };
}

function profileIdForCustomHome(codexHome) {
  const base = normalizeProfileId(path.basename(codexHome)) || "custom";
  return `custom-${base}`;
}

function selectProfile(options) {
  const context = createService(options);
  const current = context.service.profiles();
  const requestedId = normalizeProfileId(options.profileId || "");
  const requestedHome = options.codexHome ? path.resolve(options.codexHome) : "";
  let selected = null;
  if (requestedId) {
    selected = current.profiles.find((profile) => profile.id === requestedId);
    if (!selected) throw new Error(`Unknown Codex profile id: ${requestedId}`);
    if (!options.noWrite) context.service.setActiveProfile(selected.id);
    return Object.assign({ ok: true, storeFile: context.storeFile }, safeProfile(selected));
  }
  if (requestedHome) {
    selected = current.profiles.find((profile) => path.resolve(profile.codexHome) === requestedHome);
    if (selected) {
      if (!options.noWrite) context.service.setActiveProfile(selected.id);
      return Object.assign({ ok: true, storeFile: context.storeFile }, safeProfile(selected));
    }
    const store = safeReadJson(context.storeFile, {});
    const existingProfiles = current.profiles.map((profile) => ({
      id: profile.id,
      label: profile.label,
      codexHome: profile.codexHome,
    }));
    const custom = {
      id: profileIdForCustomHome(requestedHome),
      label: path.basename(requestedHome) || requestedHome,
      codexHome: requestedHome,
    };
    if (options.noWrite) {
      return Object.assign({ ok: true, storeFile: context.storeFile }, safeProfile(Object.assign({}, custom, {
        active: true,
        exists: fs.existsSync(requestedHome),
      })));
    }
    const profiles = existingProfiles.filter((profile) => profile.id !== custom.id);
    profiles.push(custom);
    writeJsonFile(context.storeFile, {
      activeProfileId: custom.id,
      profiles,
      quotaSnapshots: store.quotaSnapshots && typeof store.quotaSnapshots === "object" ? store.quotaSnapshots : {},
      updatedAt: new Date().toISOString(),
    });
    return Object.assign({ ok: true, storeFile: context.storeFile }, safeProfile(Object.assign({}, custom, {
      active: true,
      exists: fs.existsSync(requestedHome),
    })));
  }
  selected = current.profiles.find((profile) => profile.active) || current.profiles[0];
  if (!selected) throw new Error("No Codex profile is configured.");
  if (!options.noWrite) context.service.setActiveProfile(selected.id);
  return Object.assign({ ok: true, storeFile: context.storeFile }, safeProfile(selected));
}

function printList(result, format) {
  if (format === "tsv") {
    for (const profile of result.profiles) {
      process.stdout.write([
        profile.id,
        profile.active ? "active" : "",
        profile.exists ? "exists" : "missing",
        profile.label,
        profile.auth.label || "",
        profile.codexHome,
      ].join("\t"));
      process.stdout.write("\n");
    }
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function printSelected(result, format) {
  if (format === "shell") {
    process.stdout.write(`SELECTED_PROFILE_ID=${shellQuote(result.id)}\n`);
    process.stdout.write(`SELECTED_PROFILE_LABEL=${shellQuote(result.label)}\n`);
    process.stdout.write(`SELECTED_CODEX_HOME=${shellQuote(result.codexHome)}\n`);
    process.stdout.write(`SELECTED_PROFILE_STORE=${shellQuote(result.storeFile)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.command) {
    usage();
    return;
  }
  if (options.command === "list") {
    printList(listProfiles(options), options.format || "json");
    return;
  }
  if (options.command === "select") {
    printSelected(selectProfile(options), options.format || "json");
    return;
  }
  throw new Error(`Unknown command: ${options.command}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err && err.message ? err.message : err}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  listProfiles,
  selectProfile,
};
