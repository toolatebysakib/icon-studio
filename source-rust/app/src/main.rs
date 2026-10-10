#![cfg_attr(not(debug_assertions),windows_subsystem="windows")]
mod store;
mod updates;
mod connection;
const VERSION:&str=env!("CARGO_PKG_VERSION");
use icon_studio_core::*;
use serde_json::{Value,json};
use std::{fs,io::Read,path::{Path,PathBuf},sync::{Arc,Mutex,mpsc},thread,time::Duration};
use tao::{event::{Event,WindowEvent},event_loop::{EventLoopBuilder,ControlFlow},window::WindowBuilder,dpi::LogicalSize};
use tiny_http::{Response,Header,Method};
use base64::{Engine,engine::general_purpose::STANDARD};

#[derive(Clone)]pub enum NativeEvent {Top(bool,mpsc::Sender<bool>),Drag(PathBuf,mpsc::Sender<Result<(),String>>),Reload,Exit,Focus}
pub struct Host {pub store:Mutex<store::Store>,pub bridge:Option<PathBuf>,pub bridge_lock:Mutex<()>,pub assets:Mutex<PathBuf>,pub token:String,pub proxy:tao::event_loop::EventLoopProxy<NativeEvent>}
impl Host {
 fn lua(&self,method:&str,args:Value)->Result<Value,String>{connection::call(&self.store.lock().map_err(|_|"Store is busy")?.directory,method,args)}
 fn current(&self)->Result<Value,String>{
  match self.lua("context",json!({})){
   Ok(mut ctx)=>{ctx["connected"]=json!(true);if !ctx["project"].is_object(){ctx["project"]=json!({"id":"standalone","name":"Workspace"});}Ok(ctx)},
   Err(_)=>Ok(json!({"connected":false,"project":{"id":"standalone","name":"Workspace"}}))
  }
 }
 fn expected(&self,id:&Value)->Result<Value,String>{let ctx=self.current()?;if id.is_string()&&ctx["project"]["id"]!=*id{return Err("The active project changed. Try again.".into())}Ok(ctx["project"].clone())}
 fn file(&self,id:&str)->Result<Value,String>{self.store.lock().map_err(|_|"Store is busy")?.find_file(id)}
 fn insert(&self,kind:&str,file:Value,expected:&Value)->Result<Value,String>{
  let project=self.expected(expected)?;if file["projectId"]!=project["id"]{return Err("Choose an icon generated for the current project".into())}
  let settings=self.store.lock().map_err(|_|"Store is busy")?.state["settings"].clone();
  self.lua("insert",json!({"kind":kind,"file":file["path"],"expectedProjectId":project["id"],"options":settings}))
 }
 fn action(&self,method:&str,args:&Value)->Result<Value,String>{match method{
  "focus"=>{let _=self.proxy.send_event(NativeEvent::Focus);Ok(json!(true))},
  "context"=>{let ctx=self.current()?;let project=ctx["project"].clone();let mut s=self.store.lock().map_err(|_|"Store is busy")?;if project.is_object(){s.ensure_project(&project)?;}let id=text(&project,"id");Ok(json!({"connected":ctx["connected"],"project":project,"workspace":s.state["projects"][id]["workspace"],"look":s.state["projects"][id]["look"]}))},
  "settings"=>{let s=self.store.lock().map_err(|_|"Store is busy")?;let mut v=s.state["settings"].clone();let mut prefs=s.state["preferences"].clone();if !prefs.is_object(){let looks=s.state["projects"].as_object().map(|ps|ps.values().filter_map(|p|p["look"].is_object().then(||p["look"].clone())).collect::<Vec<_>>()).unwrap_or_default();prefs=json!({"theme":"dark","shortcut":Shortcut::preset(0),"looks":looks});}v["preferences"]=prefs;drop(s);v["appVersion"]=json!(VERSION);v["editorVersion"]=json!(updates::editor_version(&self.active_assets()));v["appHost"]=json!(true);v["libraryCount"]=json!(self.library_count());Ok(v)},
  "updatePreferences"=>{let mut looks=vec![];for l in args["looks"].as_array().ok_or("Invalid looks")?.iter().take(200){looks.push(json!({"id":l["id"],"name":safe_name(text(l,"name")),"style":look_style(&l["style"])}));}let shortcut:Shortcut=serde_json::from_value(args["shortcut"].clone()).map_err(|_|"Invalid shortcut")?;if !shortcut.valid(){return Err("Invalid shortcut".into())}let mut s=self.store.lock().map_err(|_|"Store is busy")?;s.state["preferences"]=json!({"theme":if text(args,"theme")=="light"{"light"}else{"dark"},"shortcut":shortcut,"looks":looks,"announcementDismissed":args["announcementDismissed"],"favorites":args["favorites"].as_array().map(|xs|xs.iter().filter_map(|x|x.as_str()).take(5000).collect::<Vec<_>>()).unwrap_or_default()});s.persist()?;Ok(json!(true))},
  "setAlwaysOnTop"=>{let enabled=flag(args,"value");let(tx,rx)=mpsc::channel();self.proxy.send_event(NativeEvent::Top(enabled,tx)).map_err(|e|e.to_string())?;let actual=rx.recv_timeout(Duration::from_secs(3)).map_err(|e|e.to_string())?;let mut s=self.store.lock().map_err(|_|"Store is busy")?;s.state["settings"]["alwaysOnTop"]=json!(actual);s.persist()?;Ok(json!(actual))},
  "chooseFolder"=>{let key=text(args,"key");if !["rawFolder","outputFolder"].contains(&key){return Err("Invalid folder".into())}if let Some(p)=rfd::FileDialog::new().set_title(if key=="rawFolder"{"Raw icon library folder"}else{"Generated icons folder"}).pick_folder(){let mut s=self.store.lock().map_err(|_|"Store is busy")?;s.state["settings"][key]=json!(p.to_string_lossy());s.persist()?;}self.action("settings",&json!({}))},
  "updateSettings"=>{let mut s=self.store.lock().map_err(|_|"Store is busy")?;for key in ["trackMode","position","track","duration"]{if let Some(v)=args.get(key){s.state["settings"][key]=v.clone();}}if !["auto","manual"].contains(&text(&s.state["settings"],"trackMode")){s.state["settings"]["trackMode"]=json!("auto")}s.persist()?;Ok(s.state["settings"].clone())},
  "saveWorkspace"=>{let items=validate_project(&args["workspace"])?;let project=self.expected(&args["id"])?;let id=text(&project,"id");let mut s=self.store.lock().map_err(|_|"Store is busy")?;s.ensure_project(&project)?;s.state["projects"][id]["workspace"]=json!({"version":2,"items":items});s.persist()?;Ok(json!(true))},
  "setProjectLook"=>{let project=self.expected(&args["id"])?;let id=text(&project,"id");let look=json!({"id":args["look"]["id"],"name":safe_name(text(&args["look"],"name")),"style":look_style(&args["look"]["style"])});let mut s=self.store.lock().map_err(|_|"Store is busy")?;s.ensure_project(&project)?;s.state["projects"][id]["look"]=look.clone();s.state["lastLook"]=look;s.persist()?;Ok(json!(true))},
  "generate"=>{let project=self.expected(&args["expectedProjectId"])?;self.store.lock().map_err(|_|"Store is busy")?.generate(args,&project)},
  "pool"|"timeline"=>self.insert(method,self.file(text(args,"id"))?,&args["expectedProjectId"]),
  "batchImport"=>{let project=self.expected(&args["expectedProjectId"])?;let ids=args["ids"].as_array().ok_or("Choose generated icons")?;if ids.is_empty()||ids.len()>200{return Err("Choose up to 200 icons".into())}let mut paths=vec![];for id in ids{let f=self.file(id.as_str().ok_or("Invalid icon ID")?)?;if f["projectId"]!=project["id"]{return Err("Resolve project changed".into())}paths.push(f["path"].clone());}self.lua("batch",json!({"files":paths,"expectedProjectId":project["id"]}))},
  "saveExport"=>{let name=safe_name(text(args,"name"));let ext=name.rsplit('.').next().unwrap_or("");if !["png","svg","zip","iconstudio","iconlooks","json"].contains(&ext){return Err("Invalid export type".into())}let bytes=STANDARD.decode(text(args,"base64")).map_err(|_|"Invalid file bytes")?;if bytes.len()>100_000_000{return Err("Export is too large".into())}let selected=rfd::FileDialog::new().set_file_name(&name).add_filter("Icon Studio",&[ext]).save_file();if let Some(path)=selected{store::atomic_write(&path,&bytes)?;Ok(json!(true))}else{Ok(json!(false))}},
  "archiveList"=>self.store.lock().map_err(|_|"Store is busy")?.archive(text(args,"id")),
  "exportArchive"=>{let entries=self.store.lock().map_err(|_|"Store is busy")?.archive_files(text(args,"id"))?;let bytes=zip_files(&entries)?;if let Some(p)=rfd::FileDialog::new().set_file_name("Icon Studio Archive.zip").save_file(){store::atomic_write(&p,&bytes)?;}Ok(json!(true))},
  "reveal"=>{let f={let s=self.store.lock().map_err(|_|"Store is busy")?;s.state["files"].as_array().ok_or("Invalid archive")?.iter().find(|f|text(f,"id")==text(args,"id")).cloned().ok_or("Icon was not found")?};let path=PathBuf::from(if Path::new(text(&f,"path")).is_file(){text(&f,"path")}else{text(&f,"svgPath")});open::that(path.parent().ok_or("Invalid file path")?).map_err(|e|e.to_string())?;Ok(json!(true))},
  "drag"=>{let f=self.file(text(args,"id"))?;let(tx,rx)=mpsc::channel();self.proxy.send_event(NativeEvent::Drag(PathBuf::from(text(&f,"path")),tx)).map_err(|e|e.to_string())?;rx.recv_timeout(Duration::from_secs(120)).map_err(|e|e.to_string())??;Ok(json!(true))},
  "downloadLibrary"=>self.download_library(args),
  "downloadFullLibrary"=>self.download_full_library(),
  "checkUpdates"=>updates::check(&self.active_assets()),
  "updateEditor"=>{let folder=self.store.lock().map_err(|_|"Store is busy")?.directory.clone();let result=updates::refresh_editor(&folder,&self.active_assets())?;let active=updates::active_editor(&folder,&self.active_assets());*self.assets.lock().unwrap()=active;self.proxy.send_event(NativeEvent::Reload).map_err(|e|e.to_string())?;Ok(result)},
  "updateApp"=>{let folder=self.store.lock().map_err(|_|"Store is busy")?.directory.clone();let result=updates::install(&folder)?;self.proxy.send_event(NativeEvent::Exit).map_err(|e|e.to_string())?;Ok(result)},
  "connectResolve"=>Ok(json!({"message":"In Resolve, open Workspace > Scripts > Utility > Icon Studio App. The app connects automatically. If the menu has not refreshed since installation, restart Resolve."})),
  _=>Err("Unknown app operation".into())
 }}
 fn download_library(&self,args:&Value)->Result<Value,String>{
  let folder={let s=self.store.lock().map_err(|_|"Store is busy")?;let p=text(&s.state["settings"],"rawFolder");if p.is_empty(){return Err("Choose a raw icon library folder first".into())}PathBuf::from(p).join("icon-studio-library-v2")};fs::create_dir_all(&folder).map_err(|e|e.to_string())?;
  let catalog:Value=serde_json::from_slice(&fs::read(self.active_assets().join("library/catalog.json")).map_err(|e|e.to_string())?).map_err(|_|"Invalid collection catalog")?;
  let selected=args["prefixes"].as_array().ok_or("Select collections first")?;if selected.len()>300{return Err("Too many collections".into())}let mut count=0;let agent=ureq::Agent::new_with_defaults();
  for prefix in selected{let prefix=prefix.as_str().ok_or("Invalid collection")?;let pack=catalog["collections"].as_array().unwrap().iter().find(|p|p["prefix"]==prefix).ok_or("Unknown collection")?;
   let chunks=pack["chunks"].as_array().cloned().unwrap_or_else(||vec![pack.clone()]);
   for chunk in chunks{let file=text(&chunk,"file");let destination=folder.join(file);if destination.is_file(){if let Ok(bytes)=fs::read(&destination){if store::hash(&bytes)==text(&chunk,"sha256"){continue}}}
    let bytes=agent.get(format!("https://iconeditor.pages.dev/library/{file}")).call().map_err(|e|e.to_string())?.body_mut().with_config().limit(25_000_000).read_to_vec().map_err(|e|e.to_string())?;
    if store::hash(&bytes)!=text(&chunk,"sha256"){return Err(format!("Integrity check failed for {prefix}"))}gunzip(&bytes)?;store::atomic_write(&destination,&bytes)?;
   }count+=1;
  }
  for name in ["catalog.json","index.json.gz","LICENSES.txt"]{fs::copy(self.active_assets().join("library").join(name),folder.join(name)).map_err(|e|e.to_string())?;}
  let notices=self.active_assets().join("library/licenses");let target=folder.join("licenses");fs::create_dir_all(&target).map_err(|e|e.to_string())?;for entry in fs::read_dir(notices).map_err(|e|e.to_string())?{let entry=entry.map_err(|e|e.to_string())?;if entry.path().is_file(){fs::copy(entry.path(),target.join(entry.file_name())).map_err(|e|e.to_string())?;}}
  Ok(json!({"downloaded":count}))
 }
 fn library_count(&self)->u64{let folder={let s=self.store.lock().unwrap();PathBuf::from(text(&s.state["settings"],"rawFolder")).join("icon-studio-library-v2")};let catalog:Value=fs::read(folder.join("catalog.json")).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or(Value::Null);if catalog["collections"].as_array().is_some_and(|ps|ps.iter().all(|p|p["chunks"].as_array().cloned().unwrap_or_else(||vec![p.clone()]).iter().all(|c|folder.join(text(c,"file")).is_file()))){catalog["count"].as_u64().unwrap_or(0)}else{0}}
 fn download_full_library(&self)->Result<Value,String>{
  let assets=self.active_assets();let config:Value=serde_json::from_slice(&fs::read(assets.join("library-release.json")).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
  let bytes=updates::download_checked(&config,160_000_000)?;let root={let s=self.store.lock().map_err(|_|"Store is busy")?;PathBuf::from(text(&s.state["settings"],"rawFolder"))};
  updates::extract_zip(&bytes,&root,Some("icon-studio-library-v2/"),250_000_000)?;
  Ok(json!({"count":self.library_count()}))
 }
 fn active_assets(&self)->PathBuf{self.assets.lock().unwrap().clone()}
 fn asset(&self,path:&str)->Result<Vec<u8>,String>{
  let path=if path=="/"{"index.html"}else{path.trim_start_matches('/')};if path.split('/').any(|p|p=="..")||path.contains('\\')||path.contains('%'){return Err("Invalid asset path".into())}
  if let Some(id)=path.strip_prefix("generated/"){let s=self.store.lock().map_err(|_|"Store is busy")?;let svg=id.ends_with(".svg");let id=id.strip_suffix(".svg").unwrap_or(id);let f=s.state["files"].as_array().ok_or("Invalid archive")?.iter().find(|f|text(f,"id")==id).ok_or("Icon was not found")?;let p=text(f,if svg{"svgPath"}else{"path"});return fs::read(p).map_err(|e|e.to_string())}
  if path.starts_with("library/")&&path.ends_with(".json.gz"){
   let file=path.trim_start_matches("library/");let raw={let s=self.store.lock().map_err(|_|"Store is busy")?;PathBuf::from(text(&s.state["settings"],"rawFolder")).join("icon-studio-library-v2").join(file)};
   if raw.is_file(){return fs::read(raw).map_err(|e|e.to_string())}
   if !self.active_assets().join(path).is_file(){return ureq::get(format!("https://iconeditor.pages.dev/{path}")).call().map_err(|e|e.to_string())?.body_mut().with_config().limit(25_000_000).read_to_vec().map_err(|e|e.to_string())}
  }
  fs::read(self.active_assets().join(path)).map_err(|e|e.to_string())
 }
}
fn header(name:&str,value:&str)->Header{Header::from_bytes(name,value).unwrap()}
fn main(){if std::env::args().any(|a|a=="--self-test"){match updates::self_test(){Ok(())=>std::process::exit(0),Err(e)=>{eprintln!("{e}");std::process::exit(1)}}}if let Err(e)=run(){let _=rfd::MessageDialog::new().set_title("Icon Studio").set_description(&e).set_level(rfd::MessageLevel::Error).show();}}
fn run()->Result<(),String>{
 if std::env::args().any(|a|a=="--self-test"){updates::self_test()?;return Ok(())}
 let exe=std::env::current_exe().map_err(|e|e.to_string())?;let base=exe.parent().ok_or("App directory missing")?;let assets=base.join("web");if !assets.join("index.html").is_file(){return Err("The web folder is missing. Extract the complete Icon Studio package.".into())}
 let args:Vec<_>=std::env::args().collect();let bridge=args.windows(2).find(|w|w[0]=="--bridge").map(|w|PathBuf::from(&w[1]));let token=uuid::Uuid::new_v4().to_string()+&uuid::Uuid::new_v4().to_string();
 let store=store::Store::load()?;let _instance_lock=connection::instance_lock(&store.directory)?;if _instance_lock.is_none(){return Ok(())}let assets=updates::active_editor(&store.directory,&assets);
 let event_loop=EventLoopBuilder::<NativeEvent>::with_user_event().build();let proxy=event_loop.create_proxy();let top=flag(&store.state["settings"],"alwaysOnTop");let data_folder=store.directory.clone();
 let window=WindowBuilder::new().with_title("Icon Studio by Sakib").with_inner_size(LogicalSize::new(780.,660.)).with_min_inner_size(LogicalSize::new(440.,480.)).with_always_on_top(top).build(&event_loop).map_err(|e|e.to_string())?;
 let server=tiny_http::Server::http("127.0.0.1:0").map_err(|e|e.to_string())?;let address=server.server_addr().to_ip().ok_or("Local server address missing")?;let url=format!("http://{address}/");let origin=format!("http://{address}");let host=Arc::new(Host{store:Mutex::new(store),bridge:bridge.clone(),bridge_lock:Mutex::new(()),assets:Mutex::new(assets),token:token.clone(),proxy});
 store::atomic_write(&data_folder.join("app-instance.json"),json!({"url":origin,"token":token}).to_string().as_bytes())?;
 let host_http=host.clone();let api_origin=origin.clone();thread::spawn(move||{for mut request in server.incoming_requests(){let h=host_http.clone();let api_origin=api_origin.clone();thread::spawn(move||{
  let path=request.url().split('?').next().unwrap_or("/").to_string();let host_header=request.headers().iter().find(|h|h.field.equiv("Host")).map(|h|h.value.as_str()).unwrap_or("");if host_header!=address.to_string(){let _=request.respond(Response::empty(403));return}
  if path=="/api"{
   let token=request.headers().iter().find(|h|h.field.equiv("X-Icon-Studio-Token")).map(|h|h.value.as_str()).unwrap_or("");let req_origin=request.headers().iter().find(|h|h.field.equiv("Origin")).map(|h|h.value.as_str());
   if request.method()!=&Method::Post||token!=h.token||req_origin.is_some_and(|o|o!=api_origin){let _=request.respond(Response::empty(403));return}
   let mut body=String::new();let read=request.as_reader().take(140_000_001).read_to_string(&mut body);let result=if body.len()>140_000_000{Err("Request is too large".into())}else if let Err(e)=read{Err(e.to_string())}else{serde_json::from_str::<Value>(&body).map_err(|_|"Invalid request".into()).and_then(|v|h.action(text(&v,"method"),&v["args"]))};let payload=match result{Ok(v)=>json!({"ok":true,"result":v}),Err(e)=>json!({"ok":false,"error":e})};let _=request.respond(Response::from_string(payload.to_string()).with_header(header("Content-Type","application/json")).with_header(header("Cache-Control","no-store")));
  }else if request.method()==&Method::Get{let mime=if path.ends_with(".wasm"){"application/wasm"}else if path.ends_with(".js")||path.ends_with(".mjs"){"text/javascript"}else if path.ends_with(".css"){"text/css"}else if path.ends_with(".json"){"application/json"}else if path.ends_with(".svg"){"image/svg+xml"}else if path.starts_with("/generated/"){"image/png"}else if path=="/"||path.ends_with(".html"){"text/html"}else{"application/octet-stream"};match h.asset(&path){Ok(data)=>{let _=request.respond(Response::from_data(data).with_header(header("Content-Type",mime)).with_header(header("X-Content-Type-Options","nosniff")));},Err(_)=>{let _=request.respond(Response::empty(404));}}}else{let _=request.respond(Response::empty(405));}
 });}});
 let refresh_folder=data_folder.clone();let refresh_assets=host.active_assets();thread::spawn(move||{let _=updates::refresh_editor(&refresh_folder,&refresh_assets);});
 let mut web_context=wry::WebContext::new(Some(data_folder.join("app-webview")));
 let nav_origin=origin.clone();let webview=wry::WebViewBuilder::new_with_web_context(&mut web_context).with_url(&url).with_initialization_script_for_main_only(format!("window.__ICON_STUDIO_TOKEN={};window.__ICON_STUDIO_APP=true;",json!(token)),true).with_navigation_handler(move|url|{if url.starts_with(&(nav_origin.clone()+"/")){true}else{if url.starts_with("https://"){let _=open::that(url);}false}}).with_new_window_req_handler(|url,_|{if url.starts_with("https://"){let _=open::that(url);}wry::NewWindowResponse::Deny}).build(&window).map_err(|e|e.to_string())?;
 if let Some(dir)=&bridge{store::atomic_write(&dir.join("ready"),b"4.0.0")?;}
 event_loop.run(move|event,_,control_flow|{*control_flow=ControlFlow::Wait;match event{
  Event::WindowEvent{event:WindowEvent::CloseRequested,..}=>{if let Some(dir)=&bridge{let _=store::atomic_write(&dir.join("closed"),b"1");}*control_flow=ControlFlow::Exit},
  Event::UserEvent(NativeEvent::Top(enabled,tx))=>{window.set_always_on_top(enabled);#[cfg(target_os="macos")]window.set_visible_on_all_workspaces(enabled);let _=tx.send(window.is_always_on_top());},
  Event::UserEvent(NativeEvent::Drag(path,tx))=>{let result=drag::start_drag(&window,drag::DragItem::Files(vec![path.clone()]),drag::Image::File(path),|_,_|{},drag::Options::default()).map_err(|e|e.to_string());let _=tx.send(result);},
  Event::UserEvent(NativeEvent::Reload)=>{let _=webview.load_url(&url);},
  Event::UserEvent(NativeEvent::Focus)=>{window.set_minimized(false);window.set_focus();},
  Event::UserEvent(NativeEvent::Exit)=>{*control_flow=ControlFlow::Exit},_=>{}
 }});
}
