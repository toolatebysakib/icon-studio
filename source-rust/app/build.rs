fn main(){
 if std::env::var("CARGO_CFG_TARGET_OS").as_deref()==Ok("windows")&&std::env::var("CARGO_CFG_TARGET_ENV").as_deref()==Ok("gnu"){
  let out=std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
  let object=out.join("app-resource.o");
  let status=std::process::Command::new("windres").args(["app.rc","-O","coff","-o"]).arg(&object).status().expect("Windows resource compiler is missing");
  assert!(status.success(),"Windows app resources could not compile");
  println!("cargo:rustc-link-arg={}",object.display());
  println!("cargo:rerun-if-changed=app.rc");println!("cargo:rerun-if-changed=assets/app.ico");
 }
}
