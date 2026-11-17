//! Where the desktop app keeps its traffic: plain files in the app's data folder,
//! instead of the web view's own storage (which is small and can be wiped).
//!
//! ```text
//! <app data>/traffic/traffic.json                  everything: settings, nets, messages
//! <app data>/traffic/snapshots/<date>.json         as it was before that day's changes
//! <app data>/traffic/snapshots/before-restore.json as it was before the last restore
//! <app data>/traffic/before-1.3.json               the web view's data as it was when moved here
//! ```
//!
//! The page hands over the whole store on every save. Every write goes to a temporary
//! file that is then renamed into place, so a crash can't leave half a file.

use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

/// Days of snapshots kept (days the traffic changed, not calendar days)
const KEEP_SNAPSHOTS: usize = 7;
/// A development build keeps its traffic apart, so trying one out never touches the real log
const DIR_NAME: &str = if cfg!(debug_assertions) { "traffic-dev" } else { "traffic" };
const FILE_NAME: &str = "traffic.json";
const BEFORE_RESTORE: &str = "before-restore";
const PRE_MIGRATION_FILE: &str = "before-1.3.json";

/// The store exactly as it is on disk now, so an unchanged save writes nothing.
#[derive(Default)]
pub struct StoreState(Mutex<Option<String>>);

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Damaged {
    /// What the unreadable file was renamed to (it is kept, never deleted)
    kept_as: String,
    /// The newest snapshot, if there is one to fall back on
    newest_snapshot: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Loaded {
    /// The whole store as JSON, when there is a readable one
    store: Option<String>,
    /// Set when the file was there but couldn't be read
    damaged: Option<Damaged>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    /// "2026-11-16", or "before-restore"
    name: String,
    /// When the file was written, in milliseconds since 1970
    modified: u64,
    /// How many messages it holds
    messages: usize,
}

/// YYYY-MM-DD
fn valid_date(d: &str) -> bool {
    let b = d.as_bytes();
    b.len() == 10 && b.iter().enumerate().all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
}

/// A store is an object with a settings object and a list of messages. Anything else
/// is refused, so a fault in the page can never replace the log with nonsense.
fn parse_store(text: &str) -> Option<Value> {
    let v: Value = serde_json::from_str(text).ok()?;
    (v.is_object() && v["settings"].is_object() && v["messages"].is_array()).then_some(v)
}

/// Writes to a temporary file and renames it into place.
fn atomic_write(path: &Path, text: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    let write = || -> std::io::Result<()> {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(text.as_bytes())?;
        f.sync_all()?;
        fs::rename(&tmp, path)
    };
    write().map_err(|e| format!("Couldn't write {}: {}", path.display(), e))
}

fn snapshot_dir(root: &Path) -> PathBuf {
    root.join("snapshots")
}

/// The dated snapshots, newest first.
fn snapshot_dates(root: &Path) -> Vec<String> {
    let mut dates: Vec<String> = fs::read_dir(snapshot_dir(root))
        .map(|rd| {
            rd.flatten()
                .filter_map(|e| e.file_name().into_string().ok())
                .filter_map(|n| n.strip_suffix(".json").map(str::to_string))
                .filter(|n| valid_date(n))
                .collect()
        })
        .unwrap_or_default();
    dates.sort();
    dates.reverse();
    dates
}

/// Keeps the file as it is now as today's snapshot, unless today already has one
/// (the first one of the day is the state before that day's changes).
fn take_snapshot(root: &Path, today: &str) -> Result<(), String> {
    let src = root.join(FILE_NAME);
    if !src.is_file() {
        return Ok(());
    }
    let dir = snapshot_dir(root);
    let dst = dir.join(format!("{today}.json"));
    if dst.exists() {
        return Ok(());
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::copy(&src, &dst).map_err(|e| format!("Couldn't save a snapshot: {e}"))?;
    for old in snapshot_dates(root).into_iter().skip(KEEP_SNAPSHOTS) {
        let _ = fs::remove_file(dir.join(format!("{old}.json")));
    }
    Ok(())
}

/// Writes the store to its file, after a snapshot when it's the first change of the day.
fn save_to(root: &Path, cache: &mut Option<String>, store: &str, today: &str) -> Result<(), String> {
    if !valid_date(today) {
        return Err("Bad date.".into());
    }
    let v = parse_store(store).ok_or("That isn't NTS Traffic Logger data.")?;
    let text = v.to_string();
    if cache.as_deref() == Some(text.as_str()) {
        return Ok(());
    }
    fs::create_dir_all(root).map_err(|e| format!("Couldn't create {}: {}", root.display(), e))?;
    take_snapshot(root, today)?;
    atomic_write(&root.join(FILE_NAME), &text)?;
    *cache = Some(text);
    Ok(())
}

/// Reads the file. One that can't be read is renamed out of the way (kept, not deleted)
/// and reported, so the page can offer the newest snapshot.
fn load_from(root: &Path, cache: &mut Option<String>) -> Result<Loaded, String> {
    *cache = None;
    let path = root.join(FILE_NAME);
    let text = match fs::read(&path) {
        Ok(bytes) => String::from_utf8(bytes).unwrap_or_default(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Loaded { store: None, damaged: None }),
        Err(e) => return Err(format!("Couldn't open {}: {}", path.display(), e)),
    };
    match parse_store(&text) {
        Some(v) => {
            let text = v.to_string();
            *cache = Some(text.clone());
            Ok(Loaded { store: Some(text), damaged: None })
        }
        None => {
            let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
            let kept_as = format!("traffic.damaged-{secs}.json");
            fs::rename(&path, root.join(&kept_as)).map_err(|e| format!("Couldn't set aside {}: {}", path.display(), e))?;
            Ok(Loaded { store: None, damaged: Some(Damaged { kept_as, newest_snapshot: snapshot_dates(root).into_iter().next() }) })
        }
    }
}

/// First run with file storage: writes the web view's store to the file, reads it back
/// to be sure it arrived whole, and keeps the web view's original text as well.
fn migrate_to(root: &Path, cache: &mut Option<String>, store: &str, original: Option<&str>, today: &str) -> Result<(), String> {
    if root.join(FILE_NAME).exists() {
        return Err("Traffic is already stored in a file here.".into());
    }
    save_to(root, cache, store, today)?;
    let mut check = None;
    load_from(root, &mut check)?;
    if check.is_none() || check != *cache {
        // Leave nothing half-moved behind, so the next start tries again from the web view's copy
        let _ = fs::remove_file(root.join(FILE_NAME));
        *cache = None;
        return Err("The traffic didn't read back the same after being moved to a file.".into());
    }
    if let Some(text) = original {
        atomic_write(&root.join(PRE_MIGRATION_FILE), text)?;
    }
    Ok(())
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join(DIR_NAME))
}

/// Reads the stored traffic at startup.
#[tauri::command]
pub fn store_load(app: AppHandle, state: State<StoreState>) -> Result<Loaded, String> {
    load_from(&root(&app)?, &mut state.0.lock().unwrap())
}

/// Saves the whole store (the page calls this after every change).
#[tauri::command]
pub fn store_save(app: AppHandle, state: State<StoreState>, store: String, today: String) -> Result<(), String> {
    save_to(&root(&app)?, &mut state.0.lock().unwrap(), &store, &today)
}

#[tauri::command]
pub fn store_migrate(
    app: AppHandle,
    state: State<StoreState>,
    store: String,
    original: Option<String>,
    today: String,
) -> Result<(), String> {
    migrate_to(&root(&app)?, &mut state.0.lock().unwrap(), &store, original.as_deref(), &today)
}

fn snapshot_list(root: &Path) -> Vec<SnapshotInfo> {
    let dir = snapshot_dir(root);
    let info = |name: &str| -> Option<SnapshotInfo> {
        let path = dir.join(format!("{name}.json"));
        let modified = fs::metadata(&path)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)?;
        let messages = fs::read_to_string(&path)
            .ok()
            .and_then(|t| parse_store(&t))
            .and_then(|v| v["messages"].as_array().map(Vec::len))?;
        Some(SnapshotInfo { name: name.to_string(), modified, messages })
    };
    let mut out: Vec<SnapshotInfo> = snapshot_dates(root).iter().filter_map(|d| info(d)).collect();
    out.extend(info(BEFORE_RESTORE));
    out
}

/// The snapshots, newest first, with "before-restore" (if any) at the end.
#[tauri::command]
pub fn store_snapshots(app: AppHandle) -> Result<Vec<SnapshotInfo>, String> {
    Ok(snapshot_list(&root(&app)?))
}

fn snapshot_read(root: &Path, name: &str) -> Result<String, String> {
    if !(valid_date(name) || name == BEFORE_RESTORE) {
        return Err("Bad snapshot name.".into());
    }
    let path = snapshot_dir(root).join(format!("{name}.json"));
    let text = fs::read_to_string(&path).map_err(|e| format!("Couldn't read that snapshot: {e}"))?;
    parse_store(&text).map(|_| text).ok_or_else(|| "That snapshot is damaged.".to_string())
}

/// One snapshot's contents (a whole store as JSON).
#[tauri::command]
pub fn store_snapshot_read(app: AppHandle, name: String) -> Result<String, String> {
    snapshot_read(&root(&app)?, &name)
}

fn keep_before_restore(root: &Path, contents: &str) -> Result<(), String> {
    let v = parse_store(contents).ok_or("That isn't NTS Traffic Logger data.")?;
    let dir = snapshot_dir(root);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    atomic_write(&dir.join(format!("{BEFORE_RESTORE}.json")), &v.to_string())
}

/// Keeps everything as it is now, just before a restore replaces it.
#[tauri::command]
pub fn store_keep_before_restore(app: AppHandle, contents: String) -> Result<(), String> {
    keep_before_restore(&root(&app)?, &contents)
}

/// The folder the traffic is kept in, for showing to the user.
#[tauri::command]
pub fn store_folder(app: AppHandle) -> Result<String, String> {
    Ok(root(&app)?.to_string_lossy().into_owned())
}

/// Environment for a program started from inside an AppImage: the AppImage points
/// library, Python, GTK and similar settings at its own bundled copies, which make the
/// system's file manager fail to start. Every setting is given back without the parts
/// that point into the AppImage (`None` = remove the variable altogether).
#[cfg(any(target_os = "linux", test))]
fn without_appimage_paths(vars: impl Iterator<Item = (String, String)>, appdir: &str) -> Vec<(String, Option<String>)> {
    let appdir = appdir.trim_end_matches('/');
    if appdir.is_empty() {
        return Vec::new();
    }
    vars.filter(|(k, v)| k != "APPDIR" && v.contains(appdir))
        .map(|(k, v)| {
            let kept: Vec<&str> = v.split(':').filter(|part| !part.is_empty() && !part.starts_with(appdir)).collect();
            (k, (!kept.is_empty()).then(|| kept.join(":")))
        })
        .collect()
}

/// Opens that folder in the system's file manager.
#[tauri::command]
pub fn store_open_folder(app: AppHandle) -> Result<(), String> {
    let dir = root(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    if let Ok(appdir) = std::env::var("APPDIR") {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(&dir);
        for (key, value) in without_appimage_paths(std::env::vars(), &appdir) {
            match value {
                Some(v) => cmd.env(key, v),
                None => cmd.env_remove(key),
            };
        }
        return cmd.spawn().map(|_| ()).map_err(|e| format!("Couldn't start the file manager: {e}"));
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh empty folder under the system temp folder, removed when dropped
    struct TempDir(PathBuf);
    impl TempDir {
        fn new(tag: &str) -> Self {
            let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
            let p = std::env::temp_dir().join(format!("nts-store-test-{tag}-{}-{nanos}", std::process::id()));
            fs::create_dir_all(&p).unwrap();
            TempDir(p)
        }
        fn root(&self) -> PathBuf {
            self.0.join("traffic")
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn store(call: &str, nrs: &[u32]) -> String {
        let msgs: Vec<String> = nrs.iter().map(|n| format!(r#"{{"id":"m{n}","nr":"{n}","status":"waiting"}}"#)).collect();
        format!(r#"{{"version":1,"settings":{{"call":"{call}","nextNr":5}},"nets":[],"messages":[{}]}}"#, msgs.join(","))
    }

    fn count(text: &str) -> usize {
        parse_store(text).unwrap()["messages"].as_array().unwrap().len()
    }

    #[test]
    fn nothing_stored_yet() {
        let t = TempDir::new("empty");
        let mut c = None;
        let l = load_from(&t.root(), &mut c).unwrap();
        assert!(l.store.is_none() && l.damaged.is_none());
        assert!(!t.root().exists(), "loading must not create anything");
    }

    #[test]
    fn saves_and_loads_keeping_field_order() {
        let t = TempDir::new("roundtrip");
        let mut c = None;
        let s = store("N8VCL", &[3, 1, 2]);
        save_to(&t.root(), &mut c, &s, "2026-11-16").unwrap();
        let mut fresh = None;
        let l = load_from(&t.root(), &mut fresh).unwrap();
        assert_eq!(l.store.as_deref(), Some(s.as_str()));
        assert_eq!(fresh, c);
    }

    #[test]
    fn a_store_with_no_messages_yet_is_fine() {
        let t = TempDir::new("nomsgs");
        let mut c = None;
        save_to(&t.root(), &mut c, &store("N8VCL", &[]), "2026-11-16").unwrap();
        assert_eq!(count(&load_from(&t.root(), &mut None).unwrap().store.unwrap()), 0);
    }

    #[test]
    fn refuses_what_is_not_a_store() {
        let t = TempDir::new("refuse");
        let mut c = None;
        save_to(&t.root(), &mut c, &store("N8VCL", &[1]), "2026-11-16").unwrap();
        for bad in ["", "null", "{}", "[]", r#"{"settings":{}}"#, r#"{"messages":[]}"#, r#"{"settings":[],"messages":{}}"#, "{not json"] {
            assert!(save_to(&t.root(), &mut c, bad, "2026-11-16").is_err(), "accepted {bad:?}");
        }
        assert!(save_to(&t.root(), &mut c, &store("N8VCL", &[1, 2]), "16 Nov").is_err());
        assert_eq!(count(&fs::read_to_string(t.root().join(FILE_NAME)).unwrap()), 1);
    }

    #[test]
    fn snapshot_is_the_state_before_the_days_first_change() {
        let t = TempDir::new("snap");
        let mut c = None;
        save_to(&t.root(), &mut c, &store("N8VCL", &[1]), "2026-11-15").unwrap();
        assert!(snapshot_dates(&t.root()).is_empty(), "nothing to snapshot on the very first save");
        save_to(&t.root(), &mut c, &store("N8VCL", &[1, 2]), "2026-11-16").unwrap();
        save_to(&t.root(), &mut c, &store("N8VCL", &[1, 2, 3]), "2026-11-16").unwrap();
        assert_eq!(snapshot_dates(&t.root()), vec!["2026-11-16"]);
        assert_eq!(count(&snapshot_read(&t.root(), "2026-11-16").unwrap()), 1);
        let list = snapshot_list(&t.root());
        assert_eq!((list.len(), list[0].name.as_str(), list[0].messages), (1, "2026-11-16", 1));
    }

    #[test]
    fn an_unchanged_save_writes_nothing_and_takes_no_snapshot() {
        let t = TempDir::new("same");
        let mut c = None;
        let s = store("N8VCL", &[1]);
        save_to(&t.root(), &mut c, &s, "2026-11-15").unwrap();
        save_to(&t.root(), &mut c, &s, "2026-11-16").unwrap();
        assert!(snapshot_dates(&t.root()).is_empty());
    }

    #[test]
    fn keeps_only_the_newest_seven_snapshots() {
        let t = TempDir::new("keep");
        let mut c = None;
        for day in 1..=12u32 {
            let nrs: Vec<u32> = (1..=day).collect();
            save_to(&t.root(), &mut c, &store("N8VCL", &nrs), &format!("2026-11-{day:02}")).unwrap();
        }
        let dates = snapshot_dates(&t.root());
        assert_eq!(dates.len(), KEEP_SNAPSHOTS);
        assert_eq!(dates.first().map(String::as_str), Some("2026-11-12"));
        assert_eq!(dates.last().map(String::as_str), Some("2026-11-06"));
    }

    #[test]
    fn a_damaged_file_is_set_aside_and_the_newest_snapshot_offered() {
        let t = TempDir::new("damaged");
        let mut c = None;
        save_to(&t.root(), &mut c, &store("N8VCL", &[1]), "2026-11-15").unwrap();
        save_to(&t.root(), &mut c, &store("N8VCL", &[1, 2]), "2026-11-16").unwrap();
        fs::write(t.root().join(FILE_NAME), "{\"settings\":{},\"messages\":[{\"nr\"").unwrap();
        let l = load_from(&t.root(), &mut c).unwrap();
        let d = l.damaged.expect("should be reported");
        assert!(l.store.is_none() && c.is_none());
        assert_eq!(d.newest_snapshot.as_deref(), Some("2026-11-16"));
        assert!(t.root().join(&d.kept_as).is_file(), "the damaged file is kept");
        assert!(!t.root().join(FILE_NAME).exists());
        // The page restores the snapshot by saving it; the next start is clean
        let snap = snapshot_read(&t.root(), "2026-11-16").unwrap();
        save_to(&t.root(), &mut c, &snap, "2026-11-17").unwrap();
        let again = load_from(&t.root(), &mut None).unwrap();
        assert!(again.damaged.is_none());
        assert_eq!(count(&again.store.unwrap()), 1);
    }

    #[test]
    fn migration_moves_the_store_and_keeps_the_original() {
        let t = TempDir::new("migrate");
        let mut c = None;
        let s = store("N8VCL", &[1, 2, 3]);
        migrate_to(&t.root(), &mut c, &s, Some("the original text"), "2026-11-16").unwrap();
        assert_eq!(load_from(&t.root(), &mut None).unwrap().store.as_deref(), Some(s.as_str()));
        assert_eq!(fs::read_to_string(t.root().join(PRE_MIGRATION_FILE)).unwrap(), "the original text");
        assert!(snapshot_dates(&t.root()).is_empty());
    }

    #[test]
    fn migration_never_replaces_a_file_that_is_already_there() {
        let t = TempDir::new("migrate-twice");
        let mut c = None;
        save_to(&t.root(), &mut c, &store("N8VCL", &[1, 2, 3]), "2026-11-16").unwrap();
        assert!(migrate_to(&t.root(), &mut c, &store("OLD", &[9]), None, "2026-11-17").is_err());
        assert_eq!(count(&fs::read_to_string(t.root().join(FILE_NAME)).unwrap()), 3);
    }

    #[test]
    fn migration_refuses_bad_data_and_leaves_nothing_behind() {
        let t = TempDir::new("migrate-bad");
        let mut c = None;
        assert!(migrate_to(&t.root(), &mut c, "{}", Some("{}"), "2026-11-16").is_err());
        assert!(!t.root().join(FILE_NAME).exists());
        assert!(!t.root().join(PRE_MIGRATION_FILE).exists());
    }

    #[test]
    fn before_restore_is_kept_and_listed_last() {
        let t = TempDir::new("before");
        let mut c = None;
        save_to(&t.root(), &mut c, &store("N8VCL", &[1]), "2026-11-15").unwrap();
        save_to(&t.root(), &mut c, &store("N8VCL", &[1, 2]), "2026-11-16").unwrap();
        keep_before_restore(&t.root(), &store("N8VCL", &[1, 2])).unwrap();
        assert!(keep_before_restore(&t.root(), "{}").is_err());
        let list = snapshot_list(&t.root());
        assert_eq!(list.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), vec!["2026-11-16", BEFORE_RESTORE]);
        assert_eq!(list[1].messages, 2);
        assert_eq!(snapshot_dates(&t.root()), vec!["2026-11-16"], "before-restore doesn't count against the seven");
    }

    #[test]
    fn snapshot_names_cannot_reach_outside_the_folder() {
        let t = TempDir::new("names");
        for bad in ["../traffic", "..", "2026-11-16/../x", "", "before-restore.json", "2026-1-1"] {
            assert!(snapshot_read(&t.root(), bad).is_err(), "accepted {bad:?}");
        }
    }

    #[test]
    fn appimage_paths_are_removed_from_the_environment() {
        let vars = vec![
            ("APPDIR".to_string(), "/tmp/.mount_x".to_string()),
            ("LD_LIBRARY_PATH".to_string(), "/tmp/.mount_x/usr/lib:/usr/local/lib".to_string()),
            ("PYTHONHOME".to_string(), "/tmp/.mount_x/usr".to_string()),
            ("HOME".to_string(), "/home/me".to_string()),
        ];
        let out = without_appimage_paths(vars.into_iter(), "/tmp/.mount_x/");
        assert_eq!(out.len(), 2);
        assert!(out.contains(&("LD_LIBRARY_PATH".to_string(), Some("/usr/local/lib".to_string()))));
        assert!(out.contains(&("PYTHONHOME".to_string(), None)));
    }
}
