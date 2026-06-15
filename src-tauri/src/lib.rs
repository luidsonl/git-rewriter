pub mod git_engine;
pub mod models;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use models::{RepoSummary, ScanResult};
use std::path::PathBuf;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("settings.html".into())
    )
    .title("Settings - Git Rewriter")
    .inner_size(600.0, 500.0)
    .resizable(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn open_repository(path: String) -> Result<RepoSummary, String> {
    match gix::open(&path) {
        Ok(_) => {
            let path_buf = PathBuf::from(&path);
            let name = path_buf
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            Ok(RepoSummary { path, name })
        }
        Err(e) => Err(format!("Not a valid git repository: {}", e)),
    }
}

#[tauri::command]
async fn scan_repository(path: String) -> Result<ScanResult, String> {
    git_engine::scanner::scan_repository(&path)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            open_settings_window,
            open_repository,
            scan_repository
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
