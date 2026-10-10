use super::*;
use fs2::FileExt;

pub fn instance_lock(directory:&Path)->Result<Option<fs::File>,String>{
 let file=fs::OpenOptions::new().create(true).truncate(false).read(true).write(true).open(directory.join("instance.lock")).map_err(|e|e.to_string())?;
 if file.try_lock_exclusive().is_ok(){return Ok(Some(file))}
 if let Ok(bytes)=fs::read(directory.join("app-instance.json")){if let Ok(v)=serde_json::from_slice::<Value>(&bytes){let url=text(&v,"url");let token=text(&v,"token");let valid=url.strip_prefix("http://127.0.0.1:").and_then(|s|s.parse::<u16>().ok()).is_some();if valid{let agent:ureq::Agent=ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(2))).build().into();let _=agent.post(format!("{url}/api")).header("X-Icon-Studio-Token",token).send_json(json!({"method":"focus","args":{}}));}}}
 Ok(None)
}

pub fn call(directory:&Path,method:&str,args:Value)->Result<Value,String>{
 let file=directory.join("resolve-bridge.json");
 let bytes=fs::read(file).map_err(|_|"Connect Resolve from Workspace > Scripts > Utility > Icon Studio App.")?;
 if bytes.len()>8192{return Err("Invalid Resolve connection".into())}
 let endpoint:Value=serde_json::from_slice(&bytes).map_err(|_|"Invalid Resolve connection")?;
 let url=text(&endpoint,"url");let port=url.strip_prefix("http://127.0.0.1:").and_then(|s|s.parse::<u16>().ok()).filter(|p|*p>=1024).ok_or("Invalid Resolve connection address")?;
 let token=text(&endpoint,"token");if token.len()<32||token.len()>128||!token.chars().all(|c|c.is_ascii_alphanumeric()||c=='_'||c=='-'){return Err("Invalid Resolve connection token".into())}
 let timeout=if method=="context"{Duration::from_secs(2)}else{Duration::from_secs(30)};
 let agent:ureq::Agent=ureq::Agent::config_builder().timeout_global(Some(timeout)).build().into();
 let response:Value=agent.post(format!("http://127.0.0.1:{port}")).header("Authorization",&format!("Bearer {token}")).send_json(json!({"method":method,"args":args})).map_err(|_|"Resolve is unavailable. Open Icon Studio App from the Resolve Scripts menu.")?.body_mut().with_config().limit(100_000).read_json().map_err(|_|"Invalid Resolve response")?;
 if response["ok"]!=true{return Err(text(&response,"error").into())}Ok(response["result"].clone())
}
