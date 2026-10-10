use super::*;
pub async fn remove(item:&Item)->Result<String,String>{
 let src=if item.svg.is_empty(){item.image.clone()}else{svg_data(&item.svg)};
 let full=image_pixels(&src,0,0).await.map_err(js_error)?;
 let width=js_sys::Reflect::get(&full,&"width".into()).map_err(js_error)?.as_f64().unwrap_or(0.)as usize;
 let height=js_sys::Reflect::get(&full,&"height".into()).map_err(js_error)?.as_f64().unwrap_or(0.)as usize;
 let mut pixels=js_sys::Uint8Array::new(&js_sys::Reflect::get(&full,&"pixels".into()).map_err(js_error)?).to_vec();
 if width==0||height==0||pixels.len()!=width*height*4{return Err("Image could not be read".into())}
 if text(&item.style,"bgRemoveMode")=="smart"&&item.svg.is_empty(){
  let small=image_pixels(&src,320,320).await.map_err(js_error)?;let data=js_sys::Uint8Array::new(&js_sys::Reflect::get(&small,&"pixels".into()).map_err(js_error)?).to_vec();let mut input=vec![0f32;3*320*320];let means=[0.485,0.456,0.406];let stds=[0.229,0.224,0.225];
  for c in 0..3{for i in 0..320*320{input[c*320*320+i]=(data[i*4+c]as f32/255.-means[c])/stds[c];}}
  match infer_mask(&js_sys::Float32Array::from(input.as_slice())).await{
   Ok(mask)=>{let mask=js_sys::Float32Array::new(&mask).to_vec();if mask.len()!=320*320{return Err("AI returned an invalid mask".into())}let min=mask.iter().copied().fold(f32::INFINITY,f32::min);let max=mask.iter().copied().fold(f32::NEG_INFINITY,f32::max);if max-min<1e-6{return Err("No subject detected. Try Edge detection.".into())}
    for y in 0..height{for x in 0..width{let sx=x as f32*319./(width.max(2)-1)as f32;let sy=y as f32*319./(height.max(2)-1)as f32;let x0=sx.floor()as usize;let y0=sy.floor()as usize;let dx=sx-x0 as f32;let dy=sy-y0 as f32;let at=|x,y|mask[y*320+x];let v=at(x0,y0)*(1.-dx)*(1.-dy)+at((x0+1).min(319),y0)*dx*(1.-dy)+at(x0,(y0+1).min(319))*(1.-dx)*dy+at((x0+1).min(319),(y0+1).min(319))*dx*dy;let k=(y*width+x)*4+3;pixels[k]=(pixels[k]as f32*((v-min)/(max-min)).clamp(0.,1.))as u8;}}
    return pixels_data(&js_sys::Uint8Array::from(pixels.as_slice()),width as u32,height as u32).map_err(js_error)
   },Err(e)=>{return Err(format!("AI removal failed: {}. Choose Edge detection to remove a plain background.",js_error(e)))}
  }
 }
 let mode=text(&item.style,"bgRemoveMode");let mut color=if mode=="black"{[0f64;3]}else{[255f64;3]};
 if mode=="custom"{let c=text(&item.style,"bgRemoveColor");for i in 0..3{color[i]=u8::from_str_radix(&c[1+i*2..3+i*2],16).unwrap_or(255)as f64;}}
 if mode=="auto"||mode=="smart"{let mut samples:HashMap<[u8;3],usize>=HashMap::new();for y in (0..height).step_by(3){for x in [0,width-1]{let k=(y*width+x)*4;if pixels[k+3]>127{let key=[pixels[k]/16,pixels[k+1]/16,pixels[k+2]/16];*samples.entry(key).or_default()+=1;}}}for x in (0..width).step_by(3){for y in [0,height-1]{let k=(y*width+x)*4;if pixels[k+3]>127{let key=[pixels[k]/16,pixels[k+1]/16,pixels[k+2]/16];*samples.entry(key).or_default()+=1;}}}if let Some((key,_))=samples.into_iter().max_by_key(|(_,n)|*n){color=key.map(|v|v as f64*16.);}}
 let tolerance=number(&item.style,"bgTolerance");let mut seen=vec![false;width*height];let mut queue=std::collections::VecDeque::new();
 fn visit(i:usize,p:&mut[u8],seen:&mut[bool],queue:&mut std::collections::VecDeque<usize>,color:[f64;3],tolerance:f64){if seen[i]{return}seen[i]=true;let k=i*4;let dist=((p[k]as f64-color[0]).powi(2)+(p[k+1]as f64-color[1]).powi(2)+(p[k+2]as f64-color[2]).powi(2)).sqrt();if p[k+3]<10||dist<=tolerance+18.{queue.push_back(i);p[k+3]=if dist<=tolerance{0}else{(p[k+3]as f64*(dist-tolerance)/18.)as u8};}}
 if flag(&item.style,"edgeOnly"){for x in 0..width{visit(x,&mut pixels,&mut seen,&mut queue,color,tolerance);visit((height-1)*width+x,&mut pixels,&mut seen,&mut queue,color,tolerance);}for y in 0..height{visit(y*width,&mut pixels,&mut seen,&mut queue,color,tolerance);visit(y*width+width-1,&mut pixels,&mut seen,&mut queue,color,tolerance);}while let Some(i)=queue.pop_front(){let x=i%width;let y=i/width;for j in [if x>0{Some(i-1)}else{None},if x<width-1{Some(i+1)}else{None},if y>0{Some(i-width)}else{None},if y<height-1{Some(i+width)}else{None}].into_iter().flatten(){visit(j,&mut pixels,&mut seen,&mut queue,color,tolerance);}}}else{for i in 0..width*height{visit(i,&mut pixels,&mut seen,&mut queue,color,tolerance);}}
 pixels_data(&js_sys::Uint8Array::from(pixels.as_slice()),width as u32,height as u32).map_err(js_error)
}
