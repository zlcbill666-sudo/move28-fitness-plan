(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('./namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS){require('./data/legacy-demo-plan.js');require('./data/tracker-fields.js');require('./ui/dashboard.js');require('./ui/workout-guide.js')}
const api=factory(root,Move28);
Move28.init=api.init;
if(isCommonJS)module.exports=api;
else api.init();
})(globalThis,function(root,Move28){
'use strict';
let initialized=false;
function init(){
  if(initialized)return Move28;
  const {$}=Move28.utils;
  const ui=Move28.ui;
  const guide=Move28.guide;
  if(!root.document)return false;
  initialized=true;

  $('#saveBtn').onclick=ui.saveTrack;
  $('#exportBtn').onclick=ui.exportCSV;
  $('#clearBtn').onclick=ui.clearTrack;
  const workoutAudio=guide.getWorkoutAudio();
  workoutAudio.addEventListener('play',guide.updateMusicUI);
  workoutAudio.addEventListener('pause',guide.updateMusicUI);
  workoutAudio.addEventListener('error',()=>{guide.updateMusicUI();ui.showToast('音乐加载失败，请检查网络或离线资源')});
  $('#guideModal').addEventListener('click',event=>{if(event.target===$('#guideModal'))Move28.closeGuide()});
  root.document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#guideModal').classList.contains('open'))Move28.closeGuide()});

  ui.renderToday();
  ui.renderWeeks();
  ui.renderExercises();
  ui.renderDayList();
  ui.renderForm();
  ui.renderOverview();
  ui.renderSafety();
  ui.reveal();
  return Move28;
}
return{init};
});
