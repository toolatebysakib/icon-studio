use super::*;
use sha2::{Sha256,Digest};
use std::collections::HashMap;
pub fn hash(bytes:&[u8])->String{format!("{:x}",Sha256::digest(bytes))}
pub fn atomic_write(path:&Path,bytes:&[u8])->Result<(),String>{let parent=path.parent().ok_or("Invalid folder")?;fs::create_dir_all(parent).map_err(|e|e.to_string())?;let temp=path.with_extension(format!("{}.tmp",uuid::Uuid::new_v4()));fs::write(&temp,bytes).map_err(|e|e.to_string())?;if let Err(e)=fs::rename(&temp,path){let _=fs::remove_file(&temp);return Err(e.to_string())}Ok(())}
pub struct Store{pub directory:PathBuf,pub state:Value}
impl Store {
 pub fn load()->Result<Self,String>{let base=if cfg!(target_os="windows"){PathBuf::from(std::env::var_os("APPDATA").ok_or("APPDATA folder missing")?)}else{PathBuf::from(std::env::var_os("HOME").ok_or("Home folder missing")?).join("Library/Application Support")};let directory=base.join("Icon Studio App by Sakib");fs::create_dir_all(&directory).map_err(|e|e.to_string())?;let file=directory.join("state.json");migrate_classic(&base,&file)?;let mut state=match fs::read(&file){Ok(bytes)=>{let v:Value=serde_json::from_slice(&bytes).map_err(|_|"Settings file is damaged. Preserve state.json and restore its backup.")?;if v["version"]!=1{return Err("Unsupported settings version".into())}let backup=directory.join("state.backup.json");if !backup.exists(){fs::copy(&file,backup).map_err(|e|e.to_string())?;}v},Err(e)if e.kind()==std::io::ErrorKind::NotFound=>json!({"version":1,"settings":{},"projects":{},"files":[],"lastLook":null}),Err(e)=>return Err(e.to_string())};
  for(k,v)in json!({"rawFolder":"","outputFolder":"","duration":5,"track":2,"trackMode":"auto","position":"playhead","alwaysOnTop":false}).as_object().unwrap(){if state["settings"][k].is_null(){state["settings"][k]=v.clone();}}
  if text(&state["settings"],"rawFolder").is_empty(){state["settings"]["rawFolder"]=json!(directory.join("library").to_string_lossy());}
  if text(&state["settings"],"outputFolder").is_empty(){state["settings"]["outputFolder"]=json!(directory.join("Exports").to_string_lossy());}
  fs::create_dir_all(text(&state["settings"],"rawFolder")).map_err(|e|e.to_string())?;
  fs::create_dir_all(text(&state["settings"],"outputFolder")).map_err(|e|e.to_string())?;
  Ok(Self{directory,state})
 }
 pub fn persist(&self)->Result<(),String>{atomic_write(&self.directory.join("state.json"),serde_json::to_vec_pretty(&self.state).map_err(|e|e.to_string())?.as_slice())}
 pub fn ensure_project(&mut self,project:&Value)->Result<(),String>{let id=text(project,"id");if id.is_empty(){return Err("Resolve project has no ID".into())}if !self.state["projects"][id].is_object(){self.state["projects"][id]=json!({"id":id,"name":project["name"],"look":self.state["lastLook"],"workspace":null});}self.state["projects"][id]["name"]=project["name"].clone();self.persist()}
 pub fn generate(&mut self,args:&Value,project:&Value)->Result<Value,String>{let png=STANDARD.decode(text(args,"base64")).map_err(|_|"Invalid PNG")?;if !png.starts_with(b"\x89PNG\r\n\x1a\n")||png.len()>25_000_000{return Err("Invalid PNG image".into())}let svg=sanitize_svg(text(args,"svg"))?;let item:Item=serde_json::from_value(args["item"].clone()).map_err(|_|"Invalid icon")?;let name=safe_name(&item.name);let output=text(&self.state["settings"],"outputFolder");if output.is_empty(){return Err("Choose a generated icons folder in Settings".into())}
  let output=PathBuf::from(output);let hash=hash(&png);if let Some(f)=self.state["files"].as_array().unwrap().iter().find(|f|f["projectId"]==project["id"]&&f["hash"]==hash&&f["name"]==name&&Path::new(text(f,"path")).is_file()&&Path::new(text(f,"path")).starts_with(&output)){return Ok(f.clone())}
  let folder=output.join(format!("{}-{}",safe_name(text(project,"name")),&self::hash(text(project,"id").as_bytes())[..8]));fs::create_dir_all(&folder).map_err(|e|e.to_string())?;let mut file=folder.join(format!("{name}.png"));let mut n=2;while file.exists()||file.with_extension("svg").exists(){file=folder.join(format!("{name}-{n}.png"));n+=1;}atomic_write(&file,&png)?;let svg_path=file.with_extension("svg");atomic_write(&svg_path,svg.as_bytes())?;
  self.ensure_project(project)?;let record=json!({"id":uuid::Uuid::new_v4().to_string(),"name":name,"path":file.to_string_lossy(),"svgPath":svg_path.to_string_lossy(),"svgPaths":[svg_path.to_string_lossy()],"hash":hash,"projectId":project["id"],"projectName":project["name"],"item":item,"createdAt":format!("{}",std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())});self.state["files"].as_array_mut().unwrap().push(record.clone());self.persist()?;Ok(record)
 }
 pub fn find_file(&self,id:&str)->Result<Value,String>{let file=self.state["files"].as_array().ok_or("Invalid archive")?.iter().find(|f|text(f,"id")==id).ok_or("Generated icon was not found")?;if !Path::new(text(file,"path")).is_file(){return Err("Generated PNG is missing from disk".into())}Ok(file.clone())}
 pub fn archive(&self,id:&str)->Result<Value,String>{let files=self.state["files"].as_array().ok_or("Invalid archive")?.iter().filter(|f|id.is_empty()||text(f,"projectId")==id).filter(|f|Path::new(text(f,"path")).is_file()||Path::new(text(f,"svgPath")).is_file()).map(|f|{let mut f=f.clone();f["previewSvg"]=json!(!Path::new(text(&f,"path")).is_file());f}).collect::<Vec<_>>();let projects=self.state["projects"].as_object().ok_or("Invalid projects")?.values().map(|p|json!({"id":p["id"],"name":p["name"]})).collect::<Vec<_>>();Ok(json!({"files":files,"projects":projects}))}
 pub fn archive_files(&self,id:&str)->Result<HashMap<String,Vec<u8>>,String>{let mut entries=HashMap::new();for f in self.archive(id)?["files"].as_array().unwrap(){let folder=format!("{}-{}",safe_name(text(f,"projectName")),&hash(text(f,"projectId").as_bytes())[..8]);let mut paths=vec![text(f,"path").to_string()];if let Some(svgs)=f["svgPaths"].as_array(){paths.extend(svgs.iter().filter_map(|p|p.as_str()).map(String::from))}else if !text(f,"svgPath").is_empty(){paths.push(text(f,"svgPath").into())}for path in paths{let p=PathBuf::from(path);if p.is_file(){let basename=p.file_name().ok_or("Invalid generated filename")?.to_string_lossy();entries.insert(format!("{folder}/{basename}"),fs::read(p).map_err(|e|e.to_string())?);}}}Ok(entries)}
}

fn migrate_classic(base:&Path,file:&Path)->Result<(),String>{
 if file.exists(){return Ok(())}
 let previous=base.join("Icon Studio by Sakib/state.json");
 let Ok(bytes)=fs::read(&previous)else{return Ok(())};
 let Ok(mut state)=serde_json::from_slice::<Value>(&bytes)else{return Ok(())};
 if state["version"]!=1||!state["settings"].is_object()||!state["projects"].is_object()||!state["files"].is_array(){return Ok(())}
 fn item(value:&mut Value){if let Some(object)=value.as_object_mut(){if let Some(name)=object.remove("originalName"){object.insert("original_name".into(),name);}if let Some(image)=object.remove("processedImage"){object.insert("processed_image".into(),image);}}}
 for project in state["projects"].as_object_mut().unwrap().values_mut(){if let Some(items)=project["workspace"]["items"].as_array_mut(){for value in items{item(value)}}}
 for record in state["files"].as_array_mut().unwrap(){item(&mut record["item"]);}
 state["migratedFromClassic"]=json!(true);
 atomic_write(file,&serde_json::to_vec_pretty(&state).map_err(|e|e.to_string())?)
}
