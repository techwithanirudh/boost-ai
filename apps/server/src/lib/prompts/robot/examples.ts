export const examplesPrompt = `\
<examples>

<example>
  <title>Clear path toward target</title>
  <scene>Open corridor. Red target object visible ~60 cm ahead at centre frame. No obstacles.</scene>
  <depth>Nearest obstacle: ~110 cm ahead.</depth>
  <reasoning>Path is clear. Target is ahead. Hub healthy (assumed). Move forward 20 cm at medium speed.</reasoning>
  <action>forward({ value: 20, speed: 0.5, text: "Target ahead, clear path, advancing 20 cm" })</action>
</example>

<example>
  <title>Obstacle detected close ahead</title>
  <scene>Chair leg filling lower-left of frame, estimated 8 cm away.</scene>
  <depth>Nearest obstacle: ~8 cm.</depth>
  <reasoning>Obstacle is within the 15 cm safety threshold. Cannot move forward. Turn right to clear it.</reasoning>
  <action>turn({ value: 45, speed: 0.3, text: "Obstacle at ~8 cm left, turning 45° right to avoid" })</action>
</example>

<example>
  <title>Obstacle blocks full path — retreat first</title>
  <scene>Large box directly ahead filling 80% of frame, ~5 cm away. No space to turn in place.</scene>
  <depth>Nearest obstacle: ~5 cm.</depth>
  <reasoning>Too close to turn safely. Back up to create clearance, then decide direction.</reasoning>
  <action>backward({ value: 10, speed: 0.3, text: "Box too close to turn, retreating 10 cm to create clearance" })</action>
</example>

<example>
  <title>Blurry or unreadable scene</title>
  <scene>Camera feed is motion-blurred; environment is indeterminate.</scene>
  <depth>No reliable depth data.</depth>
  <reasoning>Scene is unreadable. Reverse first to recover visibility, then continue mission.</reasoning>
  <action>backward({ value: 10, speed: 0.5, text: "Unreadable view, reversing 10 cm to recover visibility and continue" })</action>
</example>

<example>
  <title>Hub error on previous step — verify before motion</title>
  <scene>Hallway visible. Previous step returned hub_connection_error.</scene>
  <reasoning>Must confirm hub is healthy before issuing motion.</reasoning>
  <sequence>
    1. getHubHealth() → { ok: false, health: { connected: false } }
    2. Hub is offline. Do not issue motion.
  </sequence>
  <action>stop({ text: "Hub offline after error — waiting for reconnection" })</action>
</example>

<example>
  <title>Hub error — but hub has recovered</title>
  <scene>Open room, target visible 40 cm ahead. Previous step returned hub error.</scene>
  <reasoning>Previous step errored. Check hub first.</reasoning>
  <sequence>
    1. getHubHealth() → { ok: true, health: { connected: true } }
    2. Hub is healthy. Path is clear. Proceed.
  </sequence>
  <action>forward({ value: 15, speed: 0.5, text: "Hub confirmed healthy, advancing toward target" })</action>
</example>

<example>
  <title>Mission goal achieved</title>
  <scene>Red target box fills the frame. Robot is approximately 5 cm from the object.</scene>
  <reasoning>Goal (reach red box) is achieved. Stop.</reasoning>
  <action>stop({ text: "Target reached — mission complete" })</action>
</example>

<example>
  <title>Fine course correction</title>
  <scene>Target visible but offset 20° to the right of centre. Clear path.</scene>
  <reasoning>Small heading correction needed before advancing. Turn right 15°.</reasoning>
  <action>turn({ value: 15, speed: 0.4, text: "Target offset right, correcting heading 15°" })</action>
</example>

</examples>`;
