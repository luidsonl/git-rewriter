pub mod git_engine;
pub mod models;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use models::{ApplyResult, BackupInfo, RepoSummary, RewriteOperation, RewritePlan, ScanResult};
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

#[tauri::command]
async fn preview_rewrite(path: String, operations: Vec<RewriteOperation>) -> Result<RewritePlan, String> {
    let scan_result = git_engine::scanner::scan_repository(&path)
        .map_err(|e| e.to_string())?;
    let plan = git_engine::rewriter::compute_rewrite_plan(&scan_result.commits, &operations);
    Ok(plan)
}

#[tauri::command]
async fn apply_rewrite(path: String, operations: Vec<RewriteOperation>) -> Result<ApplyResult, String> {
    let scan_result = git_engine::scanner::scan_repository(&path)
        .map_err(|e| e.to_string())?;
    let plan = git_engine::rewriter::compute_rewrite_plan(&scan_result.commits, &operations);

    let repo = gix::open(&path)
        .map_err(|e| e.to_string())?;

    let backup_ref = git_engine::applier::create_backup_refs(&repo)
        .map_err(|e| e.to_string())?;

    eprintln!("Backup created at {}", backup_ref);

    let rewrites = git_engine::applier::apply_rewrite_plan(&repo, &plan)
        .map_err(|e| e.to_string())?;

    Ok(ApplyResult { rewrites, backup_ref })
}

#[tauri::command]
async fn create_backup(path: String) -> Result<String, String> {
    let repo = gix::open(&path).map_err(|e| e.to_string())?;
    git_engine::applier::create_backup_refs(&repo)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn rollback_rewrite(path: String, backup_ref: String) -> Result<(), String> {
    let repo = gix::open(&path).map_err(|e| e.to_string())?;
    git_engine::applier::rollback(&repo, &backup_ref)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_backups(path: String, backup_prefix: String) -> Result<(), String> {
    let repo = gix::open(&path).map_err(|e| e.to_string())?;
    git_engine::applier::clear_backups(&repo, &backup_prefix)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_backups(path: String) -> Result<Vec<BackupInfo>, String> {
    let repo = gix::open(&path).map_err(|e| e.to_string())?;
    git_engine::applier::list_backups(&repo)
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
            scan_repository,
            preview_rewrite,
            apply_rewrite,
            create_backup,
            rollback_rewrite,
            clear_backups,
            list_backups
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
