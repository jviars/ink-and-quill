// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};

fn build_menu() -> Menu {
    let new_project = CustomMenuItem::new("new_project", "New Project").accelerator("CmdOrCtrl+N");
    let open_project = CustomMenuItem::new("open_project", "Open Project...").accelerator("CmdOrCtrl+O");
    let save_project = CustomMenuItem::new("save_project", "Save Project").accelerator("CmdOrCtrl+S");
    let open_settings = CustomMenuItem::new("open_settings", "Settings...").accelerator("CmdOrCtrl+,");
    let toggle_fullscreen =
        CustomMenuItem::new("toggle_fullscreen", "Toggle Full Screen").accelerator("F11");

    let file_menu = Menu::new()
        .add_item(new_project)
        .add_item(open_project)
        .add_item(save_project)
        .add_native_item(MenuItem::Separator)
        .add_item(open_settings)
        .add_native_item(MenuItem::Separator)
        .add_native_item(MenuItem::Quit);

    let edit_menu = Menu::new()
        .add_native_item(MenuItem::Undo)
        .add_native_item(MenuItem::Redo)
        .add_native_item(MenuItem::Separator)
        .add_native_item(MenuItem::Cut)
        .add_native_item(MenuItem::Copy)
        .add_native_item(MenuItem::Paste)
        .add_native_item(MenuItem::SelectAll);

    let view_menu = Menu::new().add_item(toggle_fullscreen);

    Menu::new()
        .add_submenu(Submenu::new("File", file_menu))
        .add_submenu(Submenu::new("Edit", edit_menu))
        .add_submenu(Submenu::new("View", view_menu))
}

fn main() {
    tauri::Builder::default()
        .menu(build_menu())
        .on_menu_event(|event| {
            let window = event.window();

            match event.menu_item_id() {
                "new_project" => {
                    let _ = window.emit("menu://new-project", ());
                }
                "open_project" => {
                    let _ = window.emit("menu://open-project", ());
                }
                "save_project" => {
                    let _ = window.emit("menu://save-project", ());
                }
                "open_settings" => {
                    let _ = window.emit("menu://open-settings", ());
                }
                "toggle_fullscreen" => {
                    if let Ok(is_fullscreen) = window.is_fullscreen() {
                        let _ = window.set_fullscreen(!is_fullscreen);
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
