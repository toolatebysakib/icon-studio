use super::*;
use ed25519_dalek::{Signature,VerifyingKey};
use std::io::{Cursor,Write};

const FEED:&str="https://iconeditor.pages.dev/app-release.json";
fn download(url:&str,limit:u64)->Result<Vec<u8>,String>{
 if !(url.starts_with("https://iconeditor.pages.dev/")||url.starts_with("https://github.com/toolatebysakib/icon-studio/releases/download/")){return Err("Untrusted update location".into())}
 let agent:ureq::Agent=ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(120))).build().into();
 agent.get(url).call().map_err(|e|e.to_string())?.body_mut().with_config().limit(limit).read_to_vec().map_err(|e|e.to_string())
}
pub fn verified(bytes:&[u8])->Result<Value,String>{
 let envelope:Value=serde_json::from_slice(bytes).map_err(|_|"Invalid update feed")?;
 let payload=STANDARD.decode(text(&envelope,"payload")).map_err(|_|"Invalid signed update payload")?;
 let signature=STANDARD.decode(text(&envelope,"signature")).map_err(|_|"Invalid update signature")?;
 let key=STANDARD.decode(include_str!("../update-public-key.txt").trim()).map_err(|_|"Invalid updater key")?;
 let key: [u8;32]=key.try_into().map_err(|_|"Invalid updater key length")?;
 let signature=Signature::from_slice(&signature).map_err(|_|"Invalid signature length")?;
 VerifyingKey::from_bytes(&key).map_err(|_|"Invalid updater key")?.verify_strict(&payload,&signature).map_err(|_|"Update signature could not be verified")?;
 let manifest:Value=serde_json::from_slice(&payload).map_err(|_|"Invalid update manifest")?;
 if manifest["protocol"]!=2{return Err("Unsupported update protocol".into())}Ok(manifest)
}
fn feed()->Result<Value,String>{let agent:ureq::Agent=ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(8))).build().into();let bytes=agent.get(FEED).call().map_err(|e|e.to_string())?.body_mut().with_config().limit(200_000).read_to_vec().map_err(|e|e.to_string())?;verified(&bytes)}
fn version(s:&str)->Result<(u32,u32,u32),String>{let n=s.split('.').map(|s|s.parse::<u32>()).collect::<Result<Vec<_>,_>>().map_err(|_|"Invalid app version")?;if n.len()!=3{return Err("Invalid app version".into())}Ok((n[0],n[1],n[2]))}
pub fn download_checked(descriptor:&Value,limit:u64)->Result<Vec<u8>,String>{
 let size=descriptor["bytes"].as_u64().ok_or("Missing update size")?;if size==0||size>limit{return Err("Update exceeds its size limit".into())}
 let bytes=download(text(descriptor,"url"),limit)?;
 if bytes.len()as u64!=size||store::hash(&bytes)!=text(descriptor,"sha256"){return Err("Update checksum did not match".into())}Ok(bytes)
}
pub fn extract_zip(bytes:&[u8],root:&Path,prefix:Option<&str>,limit:u64)->Result<(),String>{
 let mut archive=zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e|e.to_string())?;
 if archive.len()>20_000{return Err("Too many update files".into())}
 let mut paths=vec![];let mut total=0u64;
 for i in 0..archive.len(){let file=archive.by_index(i).map_err(|e|e.to_string())?;
  if file.is_dir(){continue}let name=file.name();
  if file.unix_mode().is_some_and(|m|m&0o170000==0o120000)||name.contains('\\')||name.contains(':')||name.chars().any(|c|c.is_control())||name.split('/').any(|s|s==".."||s.is_empty()||s.ends_with(['.',' '])){return Err("Invalid update path".into())}
  let name=if let Some(prefix)=prefix{name.strip_prefix(prefix).ok_or("Invalid library archive root")?}else{name};
  let relative=Path::new(name);if relative.is_absolute()||name.is_empty(){return Err("Invalid update path".into())}
  if name.ends_with(".exe")||name.ends_with(".dll")||name.ends_with(".cmd")||name.ends_with(".ps1")||name.ends_with(".py"){return Err("Invalid editor file type".into())}
  total=total.checked_add(file.size()).ok_or("Invalid archive size")?;if total>limit{return Err("Update expands beyond its limit".into())}
  paths.push((i,root.join(relative),file.size()));
 }
 // Validate all paths/sizes before changing any files.
 for(i,path,size)in paths{let mut file=archive.by_index(i).map_err(|e|e.to_string())?;let mut data=vec![];file.by_ref().take(size+1).read_to_end(&mut data).map_err(|e|e.to_string())?;if data.len()as u64!=size{return Err("Truncated update file".into())}store::atomic_write(&path,&data)?;}Ok(())
}
fn local_manifest(assets:&Path)->Value{fs::read(assets.join("editor-manifest.json")).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or(Value::Null)}
pub fn editor_version(assets:&Path)->String{text(&local_manifest(assets),"version").into()}
pub fn active_editor(directory:&Path,bundled:&Path)->PathBuf{
 let hash=fs::read_to_string(directory.join("active-editor.txt")).unwrap_or_default();
 if hash.len()!=64||!hash.bytes().all(|c|c.is_ascii_hexdigit()){return bundled.into()}
 let cache=directory.join("editors").join(hash);
 if cache.join("index.html").is_file()&&version(text(&local_manifest(&cache),"minimumHostVersion")).is_ok_and(|min|min<=version(VERSION).unwrap()){cache}else{bundled.into()}
}
pub fn check(assets:&Path)->Result<Value,String>{
 let remote=feed()?;let local=local_manifest(assets);
 let can_reload=version(text(&remote["editor"],"minimumHostVersion"))?<=version(VERSION)?;
 let platform=if cfg!(target_os="windows"){"windows"}else{"mac"};let native=&remote["native"][platform];
 Ok(json!({"appVersion":VERSION,"latestVersion":native["version"],"appAvailable":native.is_object()&&version(text(native,"version"))?>version(VERSION)?,"editorAvailable":can_reload&&remote["editor"]["contentHash"]!=local["contentHash"],"editorVersion":remote["editor"]["version"],"notes":remote["notes"]}))
}
pub fn refresh_editor(directory:&Path,bundled:&Path)->Result<Value,String>{
 let manifest=feed()?;let descriptor=&manifest["editor"];if version(text(descriptor,"minimumHostVersion"))?>version(VERSION)?{return Err("Update the desktop app to use this editor version".into())}
 let current=active_editor(directory,bundled);if local_manifest(&current)["contentHash"]==descriptor["contentHash"]{return Ok(json!({"updated":false}))}
 let hash=text(descriptor,"sha256");if hash.len()!=64||!hash.bytes().all(|c|c.is_ascii_hexdigit()){return Err("Invalid editor digest".into())}
 let destination=directory.join("editors").join(hash);
 let bytes=download_checked(descriptor,25_000_000)?;extract_zip(&bytes,&destination,None,150_000_000)?;
 let cached=local_manifest(&destination);if cached["contentHash"]!=descriptor["contentHash"]||!destination.join("index.html").is_file(){return Err("Editor update is incomplete".into())}
 store::atomic_write(&directory.join("active-editor.txt"),hash.as_bytes())?;
 Ok(json!({"updated":true,"version":descriptor["version"]}))
}
pub fn install(directory:&Path)->Result<Value,String>{
 let manifest=feed()?;let descriptor=&manifest["native"][if cfg!(target_os="windows"){"windows"}else{"mac"}];
 if version(text(descriptor,"version"))?<=version(VERSION)?{return Err("Icon Studio is already up to date".into())}
 #[cfg(not(target_os="windows"))]{let _=directory;return Err("Download the Mac app from the website to update this build".into())}
 #[cfg(target_os="windows")]{
  let bytes=download_checked(descriptor,100_000_000)?;let path=directory.join("updates").join(format!("IconStudio-{}.exe",text(descriptor,"version")));store::atomic_write(&path,&bytes)?;
  // The normal installer waits for this process before replacing its executable.
  std::process::Command::new(&path).arg("/S").arg(format!("/WAITPID={}",std::process::id())).spawn().map_err(|e|e.to_string())?;Ok(json!({"installing":true}))
 }
}
pub fn self_test()->Result<(),String>{
 let temp=std::env::temp_dir().join(format!("icon-studio-check-{}",uuid::Uuid::new_v4()));
 let mut writer=zip::ZipWriter::new(Cursor::new(Vec::new()));
 writer.start_file("../escape.txt",zip::write::SimpleFileOptions::default()).map_err(|e|e.to_string())?;
 writer.write_all(b"bad").map_err(|e|e.to_string())?;
 let bytes=writer.finish().map_err(|e|e.to_string())?.into_inner();
 if extract_zip(&bytes,&temp,None,10000).is_ok(){return Err("Path validation failed".into())}
 if verified(br#"{"payload":"aGVsbG8=","signature":"aGVsbG8="}"#).is_ok(){return Err("Signature validation failed".into())}
 if version("5.0.10")?<=version("5.0.2")?{return Err("Version ordering failed".into())}
 if let Some(path)=std::env::var_os("ICON_STUDIO_CHECK_FEED"){verified(&fs::read(path).map_err(|e|e.to_string())?)?;}
 Ok(())
}
