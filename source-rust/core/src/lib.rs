use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::{HashMap,HashSet}, io::Read};
use base64::{Engine,engine::general_purpose::STANDARD};

pub fn defaults() -> Value { json!({"bgType":"gradient","bgColor1":"#a897f5","bgColor2":"#6664df","bgAngle":145,"borderRadius":22.5,"iconScale":0.48,"iconRotation":0,"offsetX":0,"offsetY":0,"enableShadow":true,"enableInnerLight":true,"enableBevel":false,"enableClassicSweep":false,"enableGlyphShadow":false,"enableGlow":false,"enableOutline":false,"enableGrain":false,"enableVignette":false,"enableAmbientLight":false,"enableMonochrome":false,"effectColor":"#ffffff","outlineWidth":8,"glowStrength":30,"grainAmount":8,"shadowStrength":22,"glyphOpacity":100,"iconColorMode":"original","iconColor1":"#ffffff","iconColor2":"#a6c8ff","iconAngle":135,"removeBg":false,"bgTolerance":40,"bgRemoveMode":"smart","bgRemoveColor":"#ffffff","edgeOnly":true}) }
pub fn clean_style(value:&Value) -> Value {
 let mut result=defaults();
 for (k,def) in defaults().as_object().unwrap() { if let Some(v)=value.get(k) {
  if (def.is_boolean()&&v.is_boolean())||(def.is_number()&&v.is_number())||(def.is_string()&&v.is_string()) {
   if k.to_lowercase().contains("color")&&k!="iconColorMode"&&!valid_color(v.as_str().unwrap_or("")){continue}
   result[k]=v.clone();
  }
 }}
 for (k,a,b) in [("iconScale",0.05,1.5),("borderRadius",0.,50.),("glyphOpacity",0.,100.),("bgTolerance",0.,255.),("offsetX",-100.,100.),("offsetY",-100.,100.),("iconRotation",-360.,360.),("glowStrength",0.,100.),("outlineWidth",0.,50.),("grainAmount",0.,100.),("shadowStrength",0.,100.)] {result[k]=json!(number(&result,k).clamp(a,b));}
 for (k,allowed) in [("bgType",vec!["solid","gradient","transparent"]),("iconColorMode",vec!["original","solid","gradient"]),("bgRemoveMode",vec!["smart","auto","white","black","custom"])] {if !allowed.contains(&text(&result,k)){result[k]=defaults()[k].clone();}}
 result
}
pub fn look_style(v:&Value)->Value {let mut v=clean_style(v);for k in ["removeBg","bgTolerance","bgRemoveMode","bgRemoveColor","edgeOnly"]{v.as_object_mut().unwrap().remove(k);}v}
pub fn number(v:&Value,k:&str)->f64{v[k].as_f64().unwrap_or(0.)}
pub fn text<'a>(v:&'a Value,k:&str)->&'a str{v[k].as_str().unwrap_or("")}
pub fn flag(v:&Value,k:&str)->bool{v[k].as_bool().unwrap_or(false)}
pub fn valid_color(s:&str)->bool{s.len()==7&&s.starts_with('#')&&s[1..].bytes().all(|c|c.is_ascii_hexdigit())}
pub fn escape(s:&str)->String{s.replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;").replace('"',"&quot;").replace('\'',"&#39;")}
pub fn safe_name(s:&str)->String{
 let n:String=s.chars().map(|c|if c.is_control()||"<>:\"/\\|?*".contains(c){'-'}else{c}).take(120).collect();
 let n=n.trim().trim_end_matches(['.',' ']); let n=if n.is_empty(){"untitled"}else{n};
 let base=n.split('.').next().unwrap_or(n).to_uppercase();
 if ["CON","PRN","AUX","NUL"].contains(&base.as_str())||regex::Regex::new(r"^(COM|LPT)[1-9]$").unwrap().is_match(&base){format!("_{n}")}else{n.into()}
}
pub fn unique_names(names:Vec<String>,occupied:Vec<String>)->Vec<String>{let mut used:HashSet<_>=occupied.iter().map(|s|s.to_lowercase()).collect();names.into_iter().map(|s|{let base=safe_name(&s);let mut name=base.clone();let mut n=2;while used.contains(&name.to_lowercase()){name=format!("{base}-{n}");n+=1;}used.insert(name.to_lowercase());name}).collect()}

#[derive(Clone,Debug,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Item {pub id:String,pub name:String,#[serde(default)]pub original_name:String,#[serde(default)]pub svg:String,#[serde(default)]pub image:String,#[serde(default)]pub source:String,#[serde(default="defaults")]pub style:Value,#[serde(default)]pub processed_image:String}
impl Item {pub fn new(id:String,name:String,svg:String,image:String,style:Value)->Self{let name=safe_name(&name);Self{id,name:name.clone(),original_name:name,svg,image,source:"Imported".into(),style:clean_style(&style),processed_image:String::new()}}}
pub fn validate_project(v:&Value)->Result<Vec<Item>,String>{
 if v["version"]!=2||!v["items"].is_array()||v["items"].as_array().unwrap().len()>200{return Err("Choose a project with up to 200 icons".into())}
 let mut items:Vec<Item>=serde_json::from_value(v["items"].clone()).map_err(|_|"Invalid project")?;let mut seen=HashSet::new();
 for (i,it) in items.iter_mut().enumerate(){if it.svg.is_empty()&&it.image.is_empty(){return Err("Project has an empty icon".into())}if !it.svg.is_empty(){it.svg=sanitize_svg(&it.svg)?;}if !it.image.is_empty()&&!valid_image(&it.image){return Err("Project images must be embedded".into())}if !it.processed_image.is_empty()&&!valid_image(&it.processed_image){it.processed_image.clear()}it.style=clean_style(&it.style);it.name=safe_name(&it.name);if it.original_name.is_empty(){it.original_name=it.name.clone()}if it.id.is_empty()||!seen.insert(it.id.clone()){it.id=format!("import-{i}-{}",it.name);seen.insert(it.id.clone());}}
 Ok(items)
}
fn valid_image(s:&str)->bool{["data:image/png;base64,","data:image/jpeg;base64,","data:image/webp;base64,","data:image/gif;base64,","data:image/avif;base64,"].iter().any(|p|s.starts_with(p))}
#[derive(Clone,Debug,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct RenameRule {#[serde(default)]pub find:String,#[serde(default)]pub replace:String,#[serde(default)]pub regex:bool,#[serde(default)]pub case_sensitive:bool,#[serde(default)]pub case:String,#[serde(default)]pub template:String,#[serde(default)]pub prefix:String,#[serde(default)]pub suffix:String,#[serde(default="one")]pub start:usize,#[serde(default)]pub padding:usize}
fn one()->usize{1}
impl Default for RenameRule {fn default()->Self{serde_json::from_value(json!({"template":"{name}","start":1})).unwrap()}}
pub fn rename(items:&[Item],selected:&HashSet<String>,rule:&RenameRule,date:&str)->Result<Vec<(String,String)>,String>{
 let regex=if rule.regex&&!rule.find.is_empty(){Some(regex::RegexBuilder::new(&rule.find).case_insensitive(!rule.case_sensitive).build().map_err(|e|e.to_string())?)}else{None};
 let chosen:Vec<_>=items.iter().filter(|i|selected.contains(&i.id)).collect();let mut names=vec![];
 for (index,it) in chosen.iter().enumerate(){let mut n=if let Some(re)=&regex{re.replace_all(&it.name,rule.replace.as_str()).into_owned()}else{it.name.replace(&rule.find,&rule.replace)};if rule.find.is_empty(){n=it.name.clone()}
  let words:Vec<_>=n.split([' ','_','-']).filter(|w|!w.is_empty()).collect();let cap=|w:&str|{let mut c=w.chars();c.next().map(|a|a.to_uppercase().to_string()+&c.as_str().to_lowercase()).unwrap_or_default()};
  n=match rule.case.as_str(){"lower"=>n.to_lowercase(),"upper"=>n.to_uppercase(),"snake"=>words.join("_").to_lowercase(),"kebab"=>words.join("-").to_lowercase(),"title"=>words.iter().map(|w|cap(w)).collect::<Vec<_>>().join(" "),"camel"=>words.iter().enumerate().map(|(i,w)|if i==0{w.to_lowercase()}else{cap(w)}).collect(),_=>n};
  let count=format!("{:0width$}",rule.start+index,width=rule.padding.min(12));
  let template=if rule.template.is_empty(){"{name}"}else{&rule.template};
  let n=regex::Regex::new(r"\{(name|original|n|index|date)\}").unwrap().replace_all(template,|c:&regex::Captures|match &c[1]{"name"=>n.clone(),"original"=>it.original_name.clone(),"date"=>date.into(),_=>count.clone()}).into_owned();names.push(format!("{}{n}{}",rule.prefix,rule.suffix));
 }
 let names=unique_names(names,items.iter().filter(|i|!selected.contains(&i.id)).map(|i|i.name.clone()).collect());Ok(chosen.iter().zip(names).map(|(it,n)|(it.id.clone(),n)).collect())
}

pub fn sanitize_svg(s:&str)->Result<String,String>{svg_inner(s,None,true)}
fn svg_inner(s:&str,paint:Option<&str>,root:bool)->Result<String,String>{
 if s.len()>5_000_000{return Err("SVG is too large".into())}
 let doc=roxmltree::Document::parse(s).map_err(|_|"Invalid SVG")?;
 if doc.root_element().tag_name().name()!="svg"{return Err("Choose an SVG image".into())}
 fn visit(node:roxmltree::Node,paint:Option<&str>)->String{
  if node.is_text(){return escape(node.text().unwrap_or(""))}if !node.is_element(){return String::new()}
  let tag=node.tag_name().name();if ["script","style","set","animate","animateTransform","animateMotion","foreignObject","iframe","object","embed","audio","video","a"].contains(&tag){return String::new()}
  let mut out=format!("<{tag}");
  for a in node.attributes(){let key=a.name();let value=a.value();let low=value.to_lowercase();
   if key.starts_with("on")||key=="base"||key=="style"||(tag=="svg"&&["x","y","width","height"].contains(&key)){continue}
   if key=="href"&&!value.starts_with('#')&&!valid_image(value){continue}
   if low.contains("javascript:")||low.contains("@import")||(low.contains("url(")&&!low.contains("url(#")){continue}
   let value=if ["fill","stroke","color"].contains(&key)&&value!="none"&&value!="transparent"{paint.unwrap_or(value)}else{value};
   out+=&format!(" {key}=\"{}\"",escape(value));
  }
  if tag=="svg"{out+=" xmlns=\"http://www.w3.org/2000/svg\"";if node.attribute("viewBox").is_none(){out+=&format!(" viewBox=\"0 0 {} {}\"",node.attribute("width").unwrap_or("24"),node.attribute("height").unwrap_or("24"));}if node.attribute("color").is_none(){out+=&format!(" color=\"{}\"",escape(paint.unwrap_or("#ffffff")));}if node.attribute("fill").is_none()&&node.attribute("stroke").is_none(){out+=&format!(" fill=\"{}\"",escape(paint.unwrap_or("currentColor")));}}
  out.push('>');for c in node.children(){out+=&visit(c,paint)}out+=&format!("</{tag}>");out
 }
 if root {Ok(visit(doc.root_element(),paint))}else{Ok(doc.root_element().children().map(|c|visit(c,paint)).collect())}
}
fn grad(id:&str,a:&str,b:&str,angle:f64)->String{let rad=(angle-90.).to_radians();let dx=rad.cos()*0.5;let dy=rad.sin()*0.5;format!("<linearGradient id=\"{id}\" x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\"><stop stop-color=\"{a}\"/><stop offset=\"1\" stop-color=\"{b}\"/></linearGradient>",0.5-dx,0.5-dy,0.5+dx,0.5+dy)}
pub fn build_svg(item:&Item,size:u32,glyph_only:bool)->String{
 let s=clean_style(&item.style);let n=|k|number(&s,k);let t=|k|text(&s,k);let f=|k|flag(&s,k);let pad=if f("enableShadow")&&!glyph_only{85.}else{0.};let dim=1024.+pad*2.;let c=pad+512.;let r=n("borderRadius")*10.24;
 let shape=format!("<rect x=\"{pad}\" y=\"{pad}\" width=\"1024\" height=\"1024\" rx=\"{r}\"");
 let paint=match t("iconColorMode"){"solid"=>Some(t("iconColor1")),"gradient"=>Some("url(#fg)"),_=>None};
 let foreground=if !item.svg.is_empty()&&!(f("removeBg")&&!item.processed_image.is_empty()){
  svg_inner(&item.svg,paint,true).unwrap_or_default().replacen("<svg","<svg x=\"-512\" y=\"-512\" width=\"1024\" height=\"1024\"",1)
 }else{let image=if f("removeBg")&&!item.processed_image.is_empty(){&item.processed_image}else{&item.image};let image=format!("<image href=\"{}\" x=\"-512\" y=\"-512\" width=\"1024\" height=\"1024\" preserveAspectRatio=\"xMidYMid meet\"/>",escape(image));if let Some(p)=paint{format!("<mask id=\"mask\" mask-type=\"alpha\">{image}</mask><rect x=\"-512\" y=\"-512\" width=\"1024\" height=\"1024\" mask=\"url(#mask)\" fill=\"{p}\"/>")}else{image}};
 let mut filters=format!("<filter id=\"fx\" x=\"-50%\" y=\"-50%\" width=\"200%\" height=\"200%\" color-interpolation-filters=\"sRGB\"><feColorMatrix in=\"SourceGraphic\" type=\"saturate\" values=\"{}\" result=\"base\"/>",if f("enableMonochrome"){0}else{1});let mut merge=String::new();
 if f("enableGlyphShadow"){filters+="<feDropShadow in=\"SourceAlpha\" dx=\"0\" dy=\"18\" stdDeviation=\"14\" flood-opacity=\".35\" result=\"shadow\"/>";merge+="<feMergeNode in=\"shadow\"/>";}
 if f("enableGlow"){filters+=&format!("<feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"{}\" result=\"blur\"/><feFlood flood-color=\"{}\" result=\"color\"/><feComposite in=\"color\" in2=\"blur\" operator=\"in\" result=\"glow\"/>",n("glowStrength"),t("effectColor"));merge+="<feMergeNode in=\"glow\"/>";}
 if f("enableOutline"){filters+=&format!("<feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"{}\" result=\"wide\"/><feFlood flood-color=\"{}\" result=\"ink\"/><feComposite in=\"ink\" in2=\"wide\" operator=\"in\" result=\"outline\"/>",n("outlineWidth"),t("effectColor"));merge+="<feMergeNode in=\"outline\"/>";}
 filters+=&format!("<feMerge>{merge}<feMergeNode in=\"base\"/></feMerge></filter>");
 let mut out=format!("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" viewBox=\"0 0 {dim} {dim}\"><defs>{}{}{filters}<clipPath id=\"clip\">{shape}/></clipPath><filter id=\"shadow\" x=\"-25%\" y=\"-25%\" width=\"150%\" height=\"160%\"><feDropShadow dx=\"0\" dy=\"24\" stdDeviation=\"24\" flood-opacity=\"{}\"/></filter><linearGradient id=\"edge\" x2=\"0\" y2=\"1\"><stop stop-color=\"white\" stop-opacity=\".65\"/><stop offset=\".35\" stop-color=\"white\" stop-opacity=\".08\"/><stop offset=\"1\" stop-color=\"black\" stop-opacity=\".25\"/></linearGradient><linearGradient id=\"gloss\" x2=\"0\" y2=\"1\"><stop stop-color=\"white\" stop-opacity=\".6\"/><stop offset=\"1\" stop-color=\"white\" stop-opacity=\"0\"/></linearGradient><radialGradient id=\"ambient\" cx=\".3\" cy=\".1\" r=\".9\"><stop stop-color=\"white\" stop-opacity=\".45\"/><stop offset=\"1\" stop-color=\"white\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"vignette\" r=\".7\"><stop offset=\".25\" stop-color=\"black\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"black\" stop-opacity=\".42\"/></radialGradient><filter id=\"grain\"><feTurbulence type=\"fractalNoise\" baseFrequency=\".8\" numOctaves=\"3\" stitchTiles=\"stitch\"/><feColorMatrix type=\"saturate\" values=\"0\"/></filter></defs>",grad("bg",t("bgColor1"),t("bgColor2"),n("bgAngle")),grad("fg",t("iconColor1"),t("iconColor2"),n("iconAngle")),n("shadowStrength")/100.);
 if !glyph_only&&f("enableShadow")&&t("bgType")!="transparent"{out+=&format!("{shape} fill=\"{}\" filter=\"url(#shadow)\"/>",t("bgColor1"));}out+=if glyph_only{"<g>"}else{"<g clip-path=\"url(#clip)\">"};
 if !glyph_only&&t("bgType")!="transparent" {out+=&format!("{shape} fill=\"{}\"/>",if t("bgType")=="gradient"{"url(#bg)"}else{t("bgColor1")});for (key,id) in [("enableAmbientLight","ambient"),("enableVignette","vignette")]{if f(key){out+=&format!("{shape} fill=\"url(#{id})\"/>");}}if f("enableGrain"){out+=&format!("{shape} fill=\"white\" filter=\"url(#grain)\" opacity=\"{}\"/>",n("grainAmount")/100.);}}
 out+=&format!("<g transform=\"translate({} {}) rotate({}) scale({})\" opacity=\"{}\" filter=\"url(#fx)\">{foreground}</g>",c+n("offsetX")*10.24,c+n("offsetY")*10.24,n("iconRotation"),n("iconScale"),n("glyphOpacity")/100.);
 if !glyph_only{for (key,width) in [("enableBevel",14),("enableInnerLight",5)]{if f(key){out+=&format!("{shape} fill=\"none\" stroke=\"url(#edge)\" stroke-width=\"{width}\"/>");}}if f("enableClassicSweep"){out+=&format!("<path d=\"M{pad} {pad}H{}V{}Q{c} {} {pad} {}Z\" fill=\"url(#gloss)\"/>",pad+1024.,pad+450.,pad+580.,pad+480.);}}out+="</g></svg>";out
}
pub fn svg_data(s:&str)->String{format!("data:image/svg+xml;base64,{}",STANDARD.encode(s))}

// Portable ZIP writer: PNGs are already compressed; DEFLATE SVG/JSON entries.
pub fn zip_files(files:&HashMap<String,Vec<u8>>)->Result<Vec<u8>,String>{
 use std::io::Write;let mut out=vec![];let mut central=vec![];
 fn u16v(v:&mut Vec<u8>,n:u16){v.extend(n.to_le_bytes())}fn u32v(v:&mut Vec<u8>,n:u32){v.extend(n.to_le_bytes())}
 let mut entries:Vec<_>=files.iter().collect();entries.sort_by_key(|(name,_)|*name);
 if entries.len()>65535{return Err("Too many ZIP entries".into())}
 for(name,data)in entries{if name.split('/').any(|p|p=="..")||name.starts_with('/')||name.contains('\\'){return Err("Invalid archive filename".into())}
  let mut encoder=flate2::write::DeflateEncoder::new(Vec::new(),flate2::Compression::new(6));encoder.write_all(data).map_err(|e|e.to_string())?;let compressed=encoder.finish().map_err(|e|e.to_string())?;
  let crc=crc32fast::hash(data);let pos=out.len()as u32;let len=name.len()as u16;
  u32v(&mut out,0x04034b50);for v in [20,0x800,8,0,0]{u16v(&mut out,v)}for v in [crc,compressed.len()as u32,data.len()as u32]{u32v(&mut out,v)}u16v(&mut out,len);u16v(&mut out,0);out.extend(name.as_bytes());out.extend(compressed);
  u32v(&mut central,0x02014b50);for v in [20,20,0x800,8,0,0]{u16v(&mut central,v)}for v in [crc,(out.len()-pos as usize-30-name.len())as u32,data.len()as u32]{u32v(&mut central,v)}for v in [len,0,0,0,0]{u16v(&mut central,v)}u32v(&mut central,0);u32v(&mut central,pos);central.extend(name.as_bytes());
 }
 let start=out.len()as u32;let len=central.len()as u32;out.extend(central);u32v(&mut out,0x06054b50);for v in [0,0,files.len()as u16,files.len()as u16]{u16v(&mut out,v)}u32v(&mut out,len);u32v(&mut out,start);u16v(&mut out,0);Ok(out)
}

#[derive(Clone,Default,Debug,Serialize,Deserialize,PartialEq)]
pub struct Shortcut {#[serde(default)]pub key:String,#[serde(default)]pub code:String,#[serde(default)]pub shift:bool,#[serde(default)]pub ctrl:bool,#[serde(default)]pub alt:bool,#[serde(default)]pub meta:bool}
impl Shortcut {pub fn preset(i:usize)->Self{Self{key:"space".into(),code:"Space".into(),shift:matches!(i,0|3),ctrl:matches!(i,1|3|4),alt:matches!(i,2|4),meta:false}}pub fn label(&self)->String{let mut s=vec![];if self.ctrl{s.push("Ctrl".into())}if self.meta{s.push("⌘".into())}if self.alt{s.push("Alt".into())}if self.shift{s.push("Shift".into())}s.push(if self.key=="space"{"Space".into()}else{self.key.to_uppercase()});s.join("+")}pub fn matches(&self,other:&Self)->bool{let key=if !self.code.is_empty()&&!other.code.is_empty(){self.code==other.code}else{self.key==other.key};key&&self.ctrl==other.ctrl&&self.shift==other.shift&&self.alt==other.alt&&self.meta==other.meta}pub fn valid(&self)->bool{!self.key.is_empty()&&!["shift","control","alt","meta","escape","tab","enter","dead","unidentified"].contains(&self.key.as_str())&&(self.shift||self.ctrl||self.alt||self.meta||regex::Regex::new(r"^f\d{1,2}$").unwrap().is_match(&self.key))}}
pub fn gunzip(bytes:&[u8])->Result<Vec<u8>,String>{let mut d=flate2::read::GzDecoder::new(bytes);let mut out=vec![];d.by_ref().take(100_000_001).read_to_end(&mut out).map_err(|e|e.to_string())?;if out.len()>100_000_000{return Err("Collection is too large".into())}Ok(out)}
pub fn collection_svg(data:&Value,name:&str)->Result<String,String>{let icon=&data["icons"][name];if !icon.is_object(){return Err("Icon was not found".into())}let width=icon["width"].as_u64().or(data["width"].as_u64()).unwrap_or(24);let height=icon["height"].as_u64().or(data["height"].as_u64()).unwrap_or(24);sanitize_svg(&format!("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"{} {} {width} {height}\">{}</svg>",icon["left"].as_i64().or(data["left"].as_i64()).unwrap_or(0),icon["top"].as_i64().or(data["top"].as_i64()).unwrap_or(0),text(icon,"body")))}
#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct Track {pub index:usize,pub locked:bool,pub enabled:bool,pub ranges:Vec<(f64,f64)>}
pub fn choose_track(tracks:&[Track],frame:f64,duration:f64)->Result<usize,String>{if !frame.is_finite()||!duration.is_finite()||duration<=0.{return Err("Invalid timeline range".into())}let mut highest=0;for t in tracks{for &(start,end) in &t.ranges{if !start.is_finite()||!end.is_finite()||end<start{return Err("Invalid clip range".into())}if start<frame+duration&&end>frame{highest=highest.max(t.index);}}}Ok(tracks.iter().filter(|t|t.index>highest&&!t.locked&&t.enabled).map(|t|t.index).min().unwrap_or(tracks.len()+1))}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn safe_filenames(){assert_eq!(safe_name("CON.png"),"_CON.png");assert_eq!(safe_name("../a:b\\c"),"..-a-b-c");assert_eq!(unique_names(vec!["Home".into(),"home".into()],vec![]),vec!["Home","home-2"]);}
 #[test]fn hostile_svg(){let s=sanitize_svg("<svg xmlns='http://www.w3.org/2000/svg' onload='evil()'><script>evil</script><animate/><path fill='url(https://evil)' d='M0 0'/><image href='https://evil'/></svg>").unwrap();assert!(!s.contains("evil"));assert!(!s.contains("animate"));assert!(s.contains("viewBox"));}
 #[test]fn invalid_style(){let s=clean_style(&json!({"iconScale":9,"bgColor1":"red\"/>","bgType":"script"}));assert_eq!(s["iconScale"],1.5);assert_eq!(s["bgType"],"gradient");assert_eq!(s["bgColor1"],defaults()["bgColor1"]);}
 #[test]fn track_above_all_overlaps(){let t=vec![Track{index:1,locked:false,enabled:true,ranges:vec![]},Track{index:2,locked:false,enabled:true,ranges:vec![(5.,10.)]},Track{index:3,locked:false,enabled:true,ranges:vec![]},Track{index:4,locked:false,enabled:true,ranges:vec![]}];assert_eq!(choose_track(&t,0.,6.).unwrap(),3);assert_eq!(choose_track(&t,10.,6.).unwrap(),1);assert!(choose_track(&t,f64::NAN,6.).is_err());}
 #[test]fn shortcut_exact_modifiers(){for i in 0..5{let s=Shortcut::preset(i);assert!(s.valid());assert!(s.matches(&s));for j in 0..5{assert_eq!(s.matches(&Shortcut::preset(j)),i==j)}}}
 #[test]fn rename_regex_preview(){let a=Item::new("1".into(),"old-home".into(),"<svg/>".into(),"".into(),defaults());let r:RenameRule=serde_json::from_value(json!({"find":"^old-","regex":true,"replace":"","template":"{name}-{n}","start":3,"padding":2})).unwrap();assert_eq!(rename(&[a],&HashSet::from(["1".into()]),&r,"2026-10-10").unwrap()[0].1,"home-03");}
 #[test]fn output_is_valid_svg(){let a=Item::new("1".into(),"home".into(),"<svg viewBox='0 0 24 24'><path fill='red' d='M0 0h24v24H0Z'/></svg>".into(),"".into(),defaults());assert!(roxmltree::Document::parse(&build_svg(&a,1024,false)).is_ok());}
}
