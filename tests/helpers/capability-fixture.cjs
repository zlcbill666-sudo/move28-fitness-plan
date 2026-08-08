const NORMAL_CAPABILITY_RESULT=Object.freeze({
  status:'normal',
  difficultyCap:2,
  exclusions:Object.freeze([]),
  variants:Object.freeze({knee_dominant:'standard',horizontal_push:'standard'}),
  cardioStartMinutes:15,
  reasonCodes:Object.freeze([])
});

function capabilityInput(capabilityRevision=1){
  return {capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision};
}

module.exports={NORMAL_CAPABILITY_RESULT,capabilityInput};
