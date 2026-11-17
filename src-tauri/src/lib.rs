use std::fs;

mod store;

/// Writes a text file to an exact path chosen in a "Save As" dialog
/// (backups and CSV exports).
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // A second copy of the app would overwrite the first one's saves: bring the open
    // window forward instead. (Not in development builds, which keep their own traffic.)
    #[cfg(all(desktop, not(debug_assertions)))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        use tauri::Manager;
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
        }
    }));
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(store::StoreState::default())
        .setup(|app| {
            // In-app updates are desktop-only
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            #[cfg(not(desktop))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            write_text_file,
            store::store_load,
            store::store_save,
            store::store_migrate,
            store::store_snapshots,
            store::store_snapshot_read,
            store::store_keep_before_restore,
            store::store_folder,
            store::store_open_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
