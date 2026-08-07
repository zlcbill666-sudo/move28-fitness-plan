(function(Move28){
const {$}=Move28.utils;
const ui=Move28.ui;
const guide=Move28.guide;

$('#saveBtn').onclick=ui.saveTrack;
$('#exportBtn').onclick=ui.exportCSV;
$('#clearBtn').onclick=ui.clearTrack;
guide.workoutAudio.addEventListener('play',guide.updateMusicUI);
guide.workoutAudio.addEventListener('pause',guide.updateMusicUI);
guide.workoutAudio.addEventListener('error',()=>{guide.updateMusicUI();ui.showToast('音乐加载失败，请检查网络或离线资源')});
$('#guideModal').addEventListener('click',event=>{if(event.target===$('#guideModal'))Move28.closeGuide()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#guideModal').classList.contains('open'))Move28.closeGuide()});

ui.renderToday();
ui.renderWeeks();
ui.renderExercises();
ui.renderDayList();
ui.renderForm();
ui.renderOverview();
ui.renderSafety();
ui.reveal();
})(window.Move28);
