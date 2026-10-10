mod ui;
mod events;
mod background;
use icon_studio_core::*;
use serde_json::{Value,json};
use std::{cell::RefCell,collections::{HashMap,HashSet},rc::Rc};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::{spawn_local,JsFuture};
use web_sys::*;
use base64::{Engine,engine::general_purpose::STANDARD};

#[wasm_bindgen(module="/assets/platform.mjs")]
extern "C" {
 #[wasm_bindgen(catch,js_name=pngBytes)] async fn png_bytes(src:&str,size:u32)->Result<JsValue,JsValue>;
 #[wasm_bindgen(catch,js_name=downloadBytes)] fn download_bytes(bytes:&js_sys::Uint8Array,name:&str,mime:&str)->Result<(),JsValue>;
 #[wasm_bindgen(catch,js_name=writeClipboard)] async fn write_clipboard(bytes:&js_sys::Uint8Array,mime:&str)->Result<JsValue,JsValue>;
 #[wasm_bindgen(catch,js_name=readFile)] async fn read_file(file:File)->Result<JsValue,JsValue>;
 #[wasm_bindgen(catch,js_name=readWorkspace)] async fn read_workspace()->Result<JsValue,JsValue>;
 #[wasm_bindgen(catch,js_name=storeWorkspace)] async fn store_workspace(json:&str)->Result<JsValue,JsValue>;
 #[wasm_bindgen(catch,js_name=imagePixels)] async fn image_pixels(src:&str,width:u32,height:u32)->Result<JsValue,JsValue>;
 #[wasm_bindgen(catch,js_name=pixelsData)] fn pixels_data(pixels:&js_sys::Uint8Array,width:u32,height:u32)->Result<String,JsValue>;
 #[wasm_bindgen(catch,js_name=inferMask)] async fn infer_mask(input:&js_sys::Float32Array)->Result<JsValue,JsValue>;
}

#[derive(Clone)]pub struct Icon {pub prefix:String,pub name:String}
impl Icon {pub fn id(&self)->String{format!("{}:{}",self.prefix,self.name)}pub fn title(&self)->String{self.name.replace(['-','_']," ")}}
pub struct App {
 pub items:Vec<Item>,pub active:usize,pub selected:HashSet<String>,pub undo:Vec<Vec<Item>>,pub redo:Vec<Vec<Item>>,
 pub theme:String,pub modal:String,pub panel:String,pub library_open:bool,pub inspector_open:bool,pub checker:bool,pub zoom:f64,
 pub query:String,pub quick_query:String,pub quick_index:usize,pub category:String,pub tab:String,
 pub catalog:Value,pub index:HashMap<String,Vec<String>>,pub starter:HashMap<String,String>,pub artwork:HashMap<String,String>,pub packs:HashMap<String,Rc<Value>>,pub results:Vec<Icon>,pub quick_results:Vec<Icon>,pub generation:u64,
 pub shortcut:Shortcut,pub recording:bool,pub looks:Vec<Value>,pub look_name:String,pub rule:RenameRule,pub rename_error:String,
 pub project:Value,pub settings:Value,pub archive:Value,pub archive_project:String,pub native:bool,pub token:String,pub toast:String,pub busy:bool,pub export_size:u32,pub glyph_only:bool,pub pack_selection:HashSet<String>,pub pack_query:String,pub library_progress:String,
}
impl Default for App {fn default()->Self{Self{items:vec![],active:0,selected:HashSet::new(),undo:vec![],redo:vec![],theme:"light".into(),modal:String::new(),panel:"style".into(),library_open:false,inspector_open:false,checker:false,zoom:1.,query:String::new(),quick_query:String::new(),quick_index:0,category:"color".into(),tab:"explore".into(),catalog:json!({}),index:HashMap::new(),starter:HashMap::new(),artwork:HashMap::new(),packs:HashMap::new(),results:vec![],quick_results:vec![],generation:0,shortcut:Shortcut::preset(0),recording:false,looks:vec![],look_name:String::new(),rule:RenameRule::default(),rename_error:String::new(),project:Value::Null,settings:json!({}),archive:json!({}),archive_project:String::new(),native:false,token:String::new(),toast:String::new(),busy:false,export_size:1024,glyph_only:false,pack_selection:HashSet::new(),pack_query:String::new(),library_progress:String::new()}}}
thread_local!{pub static APP:RefCell<App>=RefCell::new(App::default());}
pub fn with<R>(f:impl FnOnce(&App)->R)->R{APP.with(|a|f(&a.borrow()))}
pub fn change<R>(f:impl FnOnce(&mut App)->R)->R{APP.with(|a|f(&mut a.borrow_mut()))}
pub fn document()->Document{web_sys::window().unwrap().document().unwrap()}
pub fn window()->Window{web_sys::window().unwrap()}
pub fn uuid()->String{format!("{:x}-{:x}",js_sys::Date::now() as u64,(js_sys::Math::random()*u32::MAX as f64)as u32)}
pub fn js_error(e:JsValue)->String{e.as_string().or_else(||js_sys::Reflect::get(&e,&"message".into()).ok().and_then(|v|v.as_string())).unwrap_or("Operation failed".into())}
pub fn local_get(k:&str)->Option<String>{window().local_storage().ok().flatten()?.get_item(k).ok().flatten()}
pub fn local_set(k:&str,v:&str){if let Ok(Some(s))=window().local_storage(){let _=s.set_item(k,v);}}
pub fn toast(s:impl Into<String>){change(|a|a.toast=s.into());render();}
pub fn snapshot(){change(|a|{a.undo.push(a.items.clone());if a.undo.len()>40{a.undo.remove(0);}a.redo.clear();});}
pub fn persist(){
 let (native,project,v,looks)=with(|a|(a.native,a.project.clone(),json!({"version":2,"items":a.items}),json!(a.looks)));
 local_set("icon-studio-looks-v1",&looks.to_string());
 persist_preferences();
 spawn_local(async move{let result=if native&&project["id"].is_string(){api("saveWorkspace",json!({"id":project["id"],"workspace":v})).await.map(|_|())}else{store_workspace(&v.to_string()).await.map(|_|()).map_err(js_error)};if let Err(e)=result{toast(format!("Save failed: {e}"))}});
}
pub fn persist_preferences(){let(native,prefs)=with(|a|(a.native,json!({"theme":a.theme,"shortcut":a.shortcut,"looks":a.looks,"favorites":local_get("icon-studio-favorites").and_then(|v|serde_json::from_str::<Value>(&v).ok()).unwrap_or(json!([]))})));if native{spawn_local(async move{if let Err(e)=api("updatePreferences",prefs).await{toast(e)}});}}
pub fn mutate(f:impl FnOnce(&mut App)){snapshot();change(f);persist();render();}
pub fn render(){
 let doc=document();let focus=doc.active_element().and_then(|e|e.get_attribute("data-field"));
 let scroll=doc.query_selector_all(".inspector-scroll,.library-grid,.modal-content").ok().map(|list|(0..list.length()).filter_map(|i|list.item(i)).filter_map(|n|n.dyn_into::<Element>().ok()).map(|e|e.scroll_top()).collect::<Vec<_>>()).unwrap_or_default();
 let html=with(ui::view);doc.get_element_by_id("app").unwrap().set_inner_html(&html);let _=doc.document_element().unwrap().set_attribute("data-theme",&with(|a|a.theme.clone()));
 if let Some(field)=focus{if let Ok(Some(el))=doc.query_selector(&format!("[data-field=\"{}\"]",field)){if let Some(input)=el.dyn_ref::<HtmlInputElement>(){let _=input.focus();}}}
 if let Ok(list)=doc.query_selector_all(".inspector-scroll,.library-grid,.modal-content"){for(i,pos)in scroll.iter().enumerate(){if let Some(n)=list.item(i as u32){if let Ok(el)=n.dyn_into::<Element>(){el.set_scroll_top(*pos);}}}}
}
pub async fn fetch_bytes(url:&str)->Result<Vec<u8>,String>{let response=JsFuture::from(window().fetch_with_str(url)).await.map_err(js_error)?.dyn_into::<Response>().map_err(js_error)?;if !response.ok(){return Err(format!("Download failed ({})",response.status()))}let buffer=JsFuture::from(response.array_buffer().map_err(js_error)?).await.map_err(js_error)?;Ok(js_sys::Uint8Array::new(&buffer).to_vec())}
pub async fn fetch_json(url:&str)->Result<Value,String>{serde_json::from_slice(&fetch_bytes(url).await?).map_err(|e|e.to_string())}
pub async fn api(method:&str,args:Value)->Result<Value,String>{
 if !with(|a|a.native){return Err("This action is available in the Resolve app".into())}
 let init=RequestInit::new();init.set_method("POST");init.set_body(&JsValue::from_str(&json!({"method":method,"args":args}).to_string()));let headers=Headers::new().map_err(js_error)?;headers.set("Content-Type","application/json").map_err(js_error)?;headers.set("X-Icon-Studio-Token",&with(|a|a.token.clone())).map_err(js_error)?;init.set_headers(&headers);
 let response=JsFuture::from(window().fetch_with_str_and_init("/api",&init)).await.map_err(js_error)?.dyn_into::<Response>().map_err(js_error)?;let v=JsFuture::from(response.text().map_err(js_error)?).await.map_err(js_error)?.as_string().unwrap_or_default();let v:Value=serde_json::from_str(&v).map_err(|_|"Invalid app response")?;if v["ok"]!=true{return Err(text(&v,"error").into())}Ok(v["result"].clone())
}
pub async fn load_pack(prefix:&str,name:&str)->Result<Rc<Value>,String>{
 let file=with(|a|{
  let pack=a.catalog["collections"].as_array().and_then(|packs|packs.iter().find(|p|text(p,"prefix")==prefix));
  let Some(pack)=pack else{return format!("{prefix}.json.gz")};
  let position=a.index.get(prefix).and_then(|names|names.iter().position(|n|n==name)).unwrap_or(0)as u64;
  pack["chunks"].as_array().and_then(|chunks|chunks.iter().find(|c|position>=c["start"].as_u64().unwrap_or(0)&&position<c["start"].as_u64().unwrap_or(0)+c["count"].as_u64().unwrap_or(0))).map(|chunk|text(chunk,"file").to_string()).unwrap_or_else(||text(pack,"file").to_string())
 });
 if let Some(pack)=with(|a|a.packs.get(&file).cloned()){return Ok(pack)}
 let bytes=fetch_bytes(&format!("library/{file}")).await?;let value:Value=serde_json::from_slice(&gunzip(&bytes)?).map_err(|_|"Invalid icon collection")?;let value=Rc::new(value);
 change(|a|{if a.packs.len()>=6{if let Some(key)=a.packs.keys().next().cloned(){a.packs.remove(&key);}}a.packs.insert(file,value.clone());});Ok(value)
}
pub async fn icon_svg(icon:&Icon)->Result<String,String>{if let Some(s)=with(|a|a.starter.get(&icon.id()).cloned()){return Ok(s)}let pack=load_pack(&icon.prefix,&icon.name).await?;collection_svg(&pack,&icon.name)}
pub fn matches_icons(a:&App,quick:bool)->Vec<Icon>{
 let q=if quick{&a.quick_query}else{&a.query};let q=q.trim().to_lowercase();let words:Vec<_>=q.split_whitespace().collect();let limit=if quick{25}else{90};
 let mut packs:Vec<_>=a.catalog["collections"].as_array().cloned().unwrap_or_default();packs.sort_by_key(|p|{let featured=["fluent-emoji","noto","twemoji","openmoji","logos","devicon","skill-icons","flat-color-icons"];let priority=featured.iter().position(|s|*s==text(p,"prefix")).unwrap_or(100);(!flag(p,"color"),priority,text(p,"name").to_string())});
 let favorites:HashSet<String>=local_get("icon-studio-favorites").and_then(|v|serde_json::from_str(&v).ok()).unwrap_or_default();let mut found=vec![];for p in packs{let prefix=text(&p,"prefix");if !quick&&a.category!="all"&&a.category!="color"&&a.category!=prefix{continue}if !quick&&a.category=="color"&&!flag(&p,"color"){continue}
 if let Some(names)=a.index.get(prefix){for n in names{let hay=format!("{prefix} {} {}",n.replace(['-','_']," "),text(&p,"name")).to_lowercase();if !words.iter().all(|w|hay.contains(w)){continue}let icon=Icon{prefix:prefix.into(),name:n.clone()};if !quick&&a.tab=="favorites"{if !favorites.contains(&icon.id()){continue}}
 found.push(icon);if found.len()>=limit{return found}
 }}}
 if found.is_empty()&&q.is_empty(){for id in a.starter.keys().take(limit){if let Some((p,n))=id.split_once(':'){found.push(Icon{prefix:p.into(),name:n.into()})}}}found
}
pub fn refresh_search(quick:bool){
 let (results,generation)=change(|a|{a.generation+=1;let r=matches_icons(a,quick);if quick{a.quick_results=r.clone();a.quick_index=0;}else{a.results=r.clone()}(r,a.generation)});render();
 spawn_local(async move{for icon in results{
  if with(|a|a.generation!=generation){break}let id=icon.id();if with(|a|a.artwork.contains_key(&id)){continue}
  if let Ok(svg)=icon_svg(&icon).await{change(|a|{if a.artwork.len()>360{let keep:HashSet<String>=a.results.iter().chain(a.quick_results.iter()).map(Icon::id).collect();a.artwork.retain(|k,_|keep.contains(k));}a.artwork.insert(id,svg_data(&svg));});render();}
 }});
}
pub fn add_icon(icon:Icon){spawn_local(async move{match icon_svg(&icon).await{Ok(svg)=>{let id=uuid();mutate(|a|{if a.items.len()>=200{a.toast="A collection holds up to 200 icons".into();return}let style=a.items.get(a.active).map(|i|i.style.clone()).unwrap_or_else(defaults);let names=unique_names(vec![icon.name.clone()],a.items.iter().map(|i|i.name.clone()).collect());let mut it=Item::new(id,names[0].clone(),svg,"".into(),style);it.source=icon.id();a.items.push(it);a.active=a.items.len()-1;a.modal.clear();a.library_open=false;});},Err(e)=>toast(e)}})}
pub async fn png(item:&Item,size:u32,glyph:bool)->Result<Vec<u8>,String>{let js=png_bytes(&svg_data(&build_svg(item,size,glyph)),size).await.map_err(js_error)?;Ok(js_sys::Uint8Array::new(&js).to_vec())}
pub async fn save_bytes(bytes:Vec<u8>,name:&str,mime:&str)->Result<(),String>{if with(|a|a.native){api("saveExport",json!({"name":name,"base64":STANDARD.encode(bytes)})).await?;}else{download_bytes(&js_sys::Uint8Array::from(bytes.as_slice()),name,mime).map_err(js_error)?;}Ok(())}

#[wasm_bindgen(start)]pub fn start(){
 events::install();
 let native=js_sys::Reflect::get(&window(),&"__ICON_STUDIO_TOKEN".into()).ok().and_then(|v|v.as_string());
 change(|a|{a.native=native.is_some();a.token=native.unwrap_or_default();a.theme=local_get("icon-studio-theme").filter(|s|s=="dark").unwrap_or("light".into());a.looks=local_get("icon-studio-looks-v1").and_then(|v|serde_json::from_str(&v).ok()).unwrap_or_default();a.shortcut=local_get("icon-studio-search-shortcut").and_then(|v|serde_json::from_str(&v).ok()).unwrap_or_else(||Shortcut::preset(0));});render();
 spawn_local(async{
  let result:Result<(),String>=async{
   let starter=fetch_json("starter.json").await?;change(|a|{for i in starter.as_array().unwrap_or(&vec![]){if let(Some(id),Some(s))=(i["fullName"].as_str(),i["svg"].as_str()){a.starter.insert(id.into(),s.into());a.artwork.insert(id.into(),svg_data(s));}}});
   if with(|a|a.native){let settings=api("settings",json!({})).await?;change(|a|{let p=&settings["preferences"];a.theme=if text(p,"theme")=="light"{"light".into()}else{"dark".into()};if let Ok(s)=serde_json::from_value::<Shortcut>(p["shortcut"].clone()){a.shortcut=s;}a.looks=p["looks"].as_array().cloned().unwrap_or_default();local_set("icon-studio-favorites",&json!(p["favorites"].as_array().cloned().unwrap_or_default()).to_string());a.settings=settings;});events::sync_project().await?;}else if let Ok(saved)=read_workspace().await{if !saved.is_null()&&!saved.is_undefined(){let raw=js_sys::JSON::stringify(&saved).map_err(js_error)?.as_string().unwrap_or_default();if let Ok(v)=serde_json::from_str(&raw){if let Ok(items)=validate_project(&v){change(|a|a.items=items);}}}}
   if with(|a|a.items.is_empty()){let starter=with(|a|a.starter.get("apple:photos").or_else(||a.starter.values().next()).cloned());if let Some(svg)=starter{change(|a|a.items.push(Item::new(uuid(),"photos".into(),svg,"".into(),defaults())));}}
   render();let catalog=fetch_json("library/catalog.json").await?;change(|a|a.catalog=catalog);let index=fetch_bytes("library/index.json.gz").await?;let index:HashMap<String,Vec<String>>=serde_json::from_slice(&gunzip(&index)?).map_err(|_|"Invalid search index")?;change(|a|a.index=index);refresh_search(false);Ok(())
  }.await;if let Err(e)=result{toast(e)}
 });
 let timer=Closure::<dyn FnMut()>::new(||{if with(|a|a.native&&!a.busy){spawn_local(async{if let Err(e)=events::sync_project().await{change(|a|a.toast=e);}});}});let _=window().set_interval_with_callback_and_timeout_and_arguments_0(timer.as_ref().unchecked_ref(),4000);timer.forget();
}
