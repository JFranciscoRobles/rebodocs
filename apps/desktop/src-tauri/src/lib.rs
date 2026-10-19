// What the pages cannot do by themselves: read and write files of the disk,
// open a window for another document, and hear of the documents the system
// asks the application to open (a double click in the Finder or the Explorer).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// The documents the system asked to open that no window has taken yet, and the one each new window was opened for.
#[derive(Default)]
struct Opened {
    pending: Vec<String>,
    by_window: HashMap<String, String>,
    windows: u32,
}

/// The bytes of a file.
#[tauri::command]
fn read_document(path: String) -> Result<Response, String> {
    std::fs::read(&path).map(Response::new).map_err(|e| e.to_string())
}

/// Writes the body of the request to the file its `path` header names. The
/// bytes go to a file beside it first: a failure halfway leaves the old one.
#[tauri::command]
fn write_document(request: Request<'_>) -> Result<(), String> {
    let path = request
        .headers()
        .get("path")
        .and_then(|value| value.to_str().ok())
        .map(percent_decode)
        .ok_or("no path to write to")?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("the document did not come as bytes".into());
    };
    let path = PathBuf::from(path);
    let name = path.file_name().ok_or("no file name")?.to_string_lossy();
    let temporary = path.with_file_name(format!(".{name}.saving"));
    std::fs::write(&temporary, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&temporary, &path).map_err(|e| {
        let _ = std::fs::remove_file(&temporary);
        e.to_string()
    })
}

/// The document this window was opened for, or those the system asked to open meanwhile.
#[tauri::command]
fn take_opened(window: WebviewWindow, opened: State<'_, Mutex<Opened>>) -> Vec<String> {
    let mut opened = opened.lock().unwrap();
    if let Some(path) = opened.by_window.remove(window.label()) {
        return vec![path];
    }
    std::mem::take(&mut opened.pending)
}

/// Closes every window as if the person closed it: each one with changes asks first, and may stay open.
#[tauri::command]
fn quit(app: AppHandle) {
    for window in app.webview_windows().values() {
        let _ = window.close();
    }
}

/// The print dialog of the system for what the window shows. The `window.print()`
/// of the page does nothing in the web view of a Mac; this one prints what the
/// page laid out for printing, as a browser would.
#[tauri::command]
fn print(window: WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// A new window, for `path` or for a new document.
#[tauri::command]
fn new_window(app: AppHandle, path: Option<String>) -> Result<(), String> {
    open_window(&app, path).map_err(|e| e.to_string())
}

fn open_window(app: &AppHandle, path: Option<String>) -> tauri::Result<()> {
    let opened = app.state::<Mutex<Opened>>();
    let label = {
        let mut opened = opened.lock().unwrap();
        opened.windows += 1;
        let label = format!("document-{}", opened.windows);
        if let Some(path) = path {
            opened.by_window.insert(label.clone(), path);
        }
        label
    };
    // A little below and to the right of the one in front, as documents open.
    let offset = app.webview_windows().len() as f64 * 24.0;
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("Rebodocs")
        .inner_size(1180.0, 860.0)
        .min_inner_size(420.0, 360.0)
        .position(80.0 + offset, 60.0 + offset)
        .build()?;
    Ok(())
}

/// Documents the system asked to open: they wait until a window takes them,
/// and the window in front is told they are there.
fn documents_opened(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    app.state::<Mutex<Opened>>().lock().unwrap().pending.extend(paths);
    let windows = app.webview_windows();
    let front = windows
        .values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| windows.values().next());
    match front {
        Some(window) => {
            let _ = app.emit_to(window.label(), "documents-opened", ());
        }
        None => {
            let _ = open_window(app, None);
        }
    }
}

/// The documents among the arguments the application was started with, as Windows and Linux open a file with it.
fn documents_in_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| Path::new(arg).extension().is_some_and(|ext| ext.eq_ignore_ascii_case("docx")))
        .filter(|arg| Path::new(arg).is_file())
        .collect()
}

/// `%XX` back to the byte it stands for: the header carries the path that way, as it may not be ASCII.
fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok();
            if let Some(byte) = hex.and_then(|hex| u8::from_str_radix(hex, 16).ok()) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Mutex::new(Opened { pending: documents_in_args(), ..Default::default() }))
        .invoke_handler(tauri::generate_handler![read_document, write_document, take_opened, new_window, quit, print])
        .setup(|app| {
            open_window(app.handle(), None)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("the application could not start");

    app.run(|_app, _event| {
        // On a Mac a document comes as an event, also the one the application was started for.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            let paths = urls
                .into_iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            documents_opened(_app, paths);
        }
    });
}
