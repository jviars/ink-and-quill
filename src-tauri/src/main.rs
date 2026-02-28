// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::path::PathBuf;
use std::fs;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn save_ink_and_quill_file(blob: Vec<u8>, filename: &str, directory: &str) -> Result<(), String> {
    let path = if directory.is_empty() {
        PathBuf::from(filename)
    } else {
        let mut path = PathBuf::from(directory);
        path.push(filename);
        path
    };
    
    fs::write(&path, blob).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn select_directory(initial_path: Option<&str>) -> Result<String, String> {
    let path = if let Some(path) = initial_path {
        PathBuf::from(path)
    } else {
        PathBuf::new()
    };
    
    // In a real implementation, this would use tauri's dialog API
    // For now, just return the path as a placeholder
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_recent_project(project_name: &str, directory: &str) -> Result<Vec<u8>, String> {
    let mut path = PathBuf::from(directory);
    path.push(format!("{}.quill", project_name));
    
    if path.exists() {
        fs::read(&path).map_err(|e| e.to_string())
    } else {
        Err(format!("Project file not found: {}", path.to_string_lossy()))
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            save_ink_and_quill_file,
            select_directory,
            load_recent_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
