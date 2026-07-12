"""
Windows local-build path fixes for the pnpm monorepo. RERUN AFTER EVERY
`pnpm install` — installs restore pristine long .pnpm directory names and
stock library build files, which breaks `gradlew assembleRelease` two ways:

1. CMake object paths exceed 250 chars (ninja loops "still dirty") for the
   five C++ modules -> point their buildStagingDirectory at C:/nb/<short>.
2. Codegen source paths exceed 260 chars for packages with long .pnpm names
   -> rename those store dirs short and repoint every junction.

EAS/Linux builds never need any of this. Usage:
    python scripts/fix-windows-build-paths.py
Then delete stale .cxx state is handled automatically; rebuild with gradlew.
"""
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNPM = os.path.join(REPO, "node_modules", ".pnpm")
PREFIX = "\\\\?\\"

# ---- 2) store-dir renames (long codegen paths) ----
RENAMES = {  # long-name prefix -> short name
    "@react-native-async-storage_": "asyncstorage",
    "react-native-gesture-handle_": "gestureh",
    "react-native-safe-area-cont_": "safearea",
}

def strip(t):
    return t[len(PREFIX):] if t.startswith(PREFIX) else t

def rename_stores():
    mapping = {}  # old dirname -> new dirname
    for entry in os.listdir(PNPM):
        for prefix, short in RENAMES.items():
            if entry.startswith(prefix) and entry != short:
                src, dst = os.path.join(PNPM, entry), os.path.join(PNPM, short)
                if os.path.exists(dst):
                    # stale short dir from a previous run — junctions may point
                    # here; keep it only if the long dir is gone
                    import shutil
                    shutil.rmtree(dst, ignore_errors=True)
                os.rename(src, dst)
                mapping[entry] = short
                print(f"renamed {entry} -> {short}")
    if not mapping:
        print("no store renames needed")
        return
    # repoint junctions anywhere in the workspace node_modules trees
    roots = [os.path.join(REPO, "node_modules"), os.path.join(PNPM, "node_modules")]
    for app in ("apps/mobile", "apps/admin", "packages/shared"):
        roots.append(os.path.join(REPO, app.replace("/", os.sep), "node_modules"))
    for d in os.listdir(PNPM):
        nm = os.path.join(PNPM, d, "node_modules")
        if os.path.isdir(nm):
            roots.append(nm)
    fixed = 0
    for root in roots:
        if not os.path.isdir(root):
            continue
        entries = []
        for e in os.listdir(root):
            p = os.path.join(root, e)
            if e.startswith("@"):
                try:
                    entries += [os.path.join(p, s) for s in os.listdir(p)]
                except OSError:
                    pass
            else:
                entries.append(p)
        for p in entries:
            try:
                t = strip(os.readlink(p))
            except (OSError, ValueError):
                continue
            newt = t
            for old, new in mapping.items():
                newt = newt.replace(os.sep + old + os.sep, os.sep + new + os.sep)
            if newt != t:
                os.rmdir(p)
                subprocess.run(["cmd", "/c", "mklink", "/J", p, newt], capture_output=True)
                assert os.path.exists(os.path.join(p, "package.json")), p
                fixed += 1
    print(f"junctions repointed: {fixed}")

# ---- 1) short CMake staging dirs ----
PATCHES = [
    # (glob dirname prefix, relative build file, anchor, insertion, staging)
    ("react-native-screens@", "react-native-screens/android/build.gradle",
     'path "CMakeLists.txt"', 'buildStagingDirectory "C:/nb/rns"', "groovy"),
    ("react-native-worklets@", "react-native-worklets/android/build.gradle.kts",
     'path = file("CMakeLists.txt")', 'buildStagingDirectory = file("C:/nb/rnw")', "kts"),
    ("expo-modules-core@57", "expo-modules-core/android/build.gradle",
     'path "CMakeLists.txt"', 'buildStagingDirectory "C:/nb/emc"', "groovy"),
    ("react-native-reanimated@", "react-native-reanimated/android/build.gradle.kts",
     'path = file("CMakeLists.txt")', 'buildStagingDirectory = file("C:/nb/rnre")', "kts"),
    ("gestureh", "react-native-gesture-handler/android/build.gradle",
     'path "src/main/jni/CMakeLists.txt"', 'buildStagingDirectory "C:/nb/rngh"', "groovy"),
]

def patch_staging():
    os.makedirs("C:/nb", exist_ok=True)
    for store_prefix, rel, anchor, insertion, _kind in PATCHES:
        stores = [d for d in os.listdir(PNPM) if d.startswith(store_prefix)]
        for store in stores:
            path = os.path.join(PNPM, store, "node_modules", rel.replace("/", os.sep))
            if not os.path.isfile(path):
                continue
            src = open(path, encoding="utf-8").read()
            if "buildStagingDirectory" in src:
                continue
            assert anchor in src, f"anchor missing in {path}"
            src = src.replace(anchor, anchor + "\n            // Windows: pnpm paths exceed CMAKE_OBJECT_PATH_MAX\n            " + insertion, 1)
            # break the pnpm store hardlink before writing
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(src)
            os.remove(path)
            os.rename(tmp, path)
            print(f"staging patched: {store}/{rel}")
            # clear that module's stale native state
            cxx = os.path.join(os.path.dirname(path), ".cxx")
            if os.path.isdir(cxx):
                import shutil
                shutil.rmtree(cxx, ignore_errors=True)

if __name__ == "__main__":
    rename_stores()
    patch_staging()
    print("done — rebuild with: cd apps/mobile/android && gradlew assembleRelease")
