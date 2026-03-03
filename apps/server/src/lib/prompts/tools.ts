export const toolsPrompt = `\
<tools>
<tool>
  <name>forward</name>
  <description>Move the robot forward.</description>
  <when>
    Clear path ahead and target is in front according to visual evidence.
    Prefer steps like (1-5m) and moderate speed (0.7-0.9).
    Do NOT go lower than 0.6 for speed.
    Use larger steps 8m+ only when the path is visually confirmed wide-open.
    Drift is very common (30-40%), so verify progress with the camera and auto-correct.
  </when>
</tool>

<tool>
  <name>backward</name>
  <description>Move the robot backward.</description>
  <when>
    Need to retreat from a close obstacle, reposition before turning, or escape when stuck.
    If camera view is blank/unreadable, backward is required as the first recovery action.
    Drift is very common (30-40%), so verify progress with the camera and auto-correct.
  </when>
</tool>

<tool>
  <name>turn</name>
  <description>Curve the snake by deflecting its head and crawling forward simultaneously.</description>
  <when>
    Path is blocked and a turn will reveal a better route, or a course correction is needed.
    Value is duration in seconds (negative = left, positive = right): 0.5s = slight curve, 1.5s = moderate turn, 3.0s = sharp turn.
    After backing out of a stuck situation, use 1.0–1.5s turn before retrying forward.
    For scanning and visual search, use short 0.5s turns.
  </when>
</tool>

<tool>
  <name>stop</name>
  <description>Halt all motion immediately. Ends the session.</description>
  <when>
    Use ONLY after exhausting all recovery options — at least 4-5 full escape attempts with zero movement.
    Never use stop for blank/unreadable view, being stuck, slow progress, or a single error.
    Do NOT use to signal goal completion — use complete for that.
  </when>
</tool>

<tool>
  <name>complete</name>
  <description>
    Declare the mission fully accomplished. Ends the session.
    ONLY call this when the current frame visually confirms you are physically at the goal location.
    Calling complete because you can see the goal from a distance is a mission failure.
  </description>
  <when>You are physically at the goal and the current frame clearly confirms it. NEVER before.</when>
</tool>

<tool>
  <name>getHealth</name>
  <description>Check hub connectivity and battery status.</description>
  <when>
    Actions are failing or returning errors repeatedly.
    Hub appears unresponsive. Call once, then re-check before giving up.
  </when>
</tool>

<tool>
  <name>getPose</name>
  <description>Get current dead-reckoning position: x/y in metres from start, heading in degrees.</description>
  <when>
    Uncertain about total distance covered or current heading.
    Use to cross-check progress against the camera view.
    Dead-reckoning drifts, treat as a guide, not ground truth.
  </when>
</tool>
</tools>`;
