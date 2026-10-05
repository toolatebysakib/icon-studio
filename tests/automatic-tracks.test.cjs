const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chooseTrack, automaticInsert} = require('../resolve/resolve-actions.cjs');
const tracks = (...ranges) => ranges.map((values,i)=>({index:i+1,ranges:values.map(([start,end])=>({start,end})),locked:false,enabled:true}));
test('automatic placement stays above every overlap across the full duration',()=>{
  assert.equal(chooseTrack(tracks([],[],[]),100,120),1);
  assert.equal(chooseTrack(tracks([],[[100,160]]),100,120),3);
  assert.equal(chooseTrack(tracks([[100,160]],[],[[190,250]]),100,120),4);
  assert.equal(chooseTrack(tracks([[100,160]],[[100,160]],[],[],[]),100,120),3);
  assert.equal(chooseTrack(tracks([[100,160]],[[100,160]],[[100,220]],[],[]),100,120),4);
  assert.equal(chooseTrack(tracks([[100,160]],[[100,160]],[[100,160]]),100,120),4);
});
test('exact boundaries are reusable and locked or disabled tracks are skipped',()=>{
  assert.equal(chooseTrack(tracks([[0,100]],[[220,300]]),100,120),1);
  const values=tracks([],[],[]); values[0].locked=true;values[1].enabled=false;
  assert.equal(chooseTrack(values,100,120),3);
});
function fixture(initial, actualDuration=120) {
  let timecode='00:00:04:04';
  const rows=initial.map(items=>items.map(([start,end])=>({GetStart:()=>start,GetEnd:()=>end,GetDuration:()=>end-start})));
  const timeline={GetCurrentTimecode:()=>timecode,SetCurrentTimecode:(value)=>{timecode=value;return true;},GetTrackCount:()=>rows.length, GetItemListInTrack:(_,i)=>rows[i-1],GetIsTrackLocked:()=>false,GetIsTrackEnabled:()=>true,
    AddTrack:()=>{rows.push([]);return true;},DeleteTrack:(_,i)=>{assert.equal(rows[i-1].length,0);rows.splice(i-1,1);return true;},
    DeleteClips:(clips,ripple)=>{assert.equal(ripple,false);for(const row of rows)for(const clip of clips){const index=row.indexOf(clip);if(index>=0)row.splice(index,1);}return true;}};
  const pool={AppendToTimeline:([info])=>{timecode='00:00:09:04';const row=rows[info.trackIndex-1];assert.ok(!row.some(c=>c.GetStart()<info.recordFrame+actualDuration&&c.GetEnd()>info.recordFrame),'must not overwrite an existing clip');const clip={GetStart:()=>info.recordFrame,GetEnd:()=>info.recordFrame+actualDuration,GetDuration:()=>actualDuration};row.push(clip);return [clip];}};
  return {timeline,pool,rows};
}
test('actual PNG duration prevents a late collision and keeps existing clips unchanged',()=>{
  const {timeline,pool,rows}=fixture([[],[],[[190,240]]]);
  const existing=rows[2][0];
  const result=automaticInsert(timeline,pool,{},100,24);
  assert.equal(result.trackIndex,4);assert.equal(result.duration,120);
  assert.equal(rows[2][0],existing);assert.equal(rows.length,4);
});
test('successive icons reuse V3 then V4, without leaving staging tracks',()=>{
  const {timeline,pool,rows}=fixture([[[100,250]],[[100,250]],[],[],[]]);
  assert.equal(automaticInsert(timeline,pool,{},100,120).trackIndex,3);
  assert.equal(automaticInsert(timeline,pool,{},100,120).trackIndex,4);
  assert.equal(rows.length,5);assert.equal(timeline.GetCurrentTimecode(),'00:00:04:04');assert.equal(rows.reduce((n,row)=>n+row.length,0),4);
});
test('a completely empty timeline uses V1 and failed measurement cleans its own staging item',()=>{
  const good=fixture([[]]);assert.equal(automaticInsert(good.timeline,good.pool,{},100,120).trackIndex,1);assert.equal(good.rows.length,1);
  const bad=fixture([[]],NaN);assert.throws(()=>automaticInsert(bad.timeline,bad.pool,{},100,120),/duration/);assert.equal(bad.rows.length,1);assert.equal(bad.rows[0].length,0);
});
