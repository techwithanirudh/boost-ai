export const toolsPrompt = `\
<tools>
<tool>
  <name>forward</name>
  <description>Move the robot forward. </description>
  <when>
    Clear path ahead and target is in front according to visual evidence.
    Prefer small careful steps (0.05–0.3 m) and moderate speed (0.3–0.5).
    Use larger steps (up to 1 m) only when the path is visually confirmed wide-open.
  </when>
</tool>

<tool>
  <name>backward</name>
  <description>Move the robot backward. </description>
  <when>
    Need to retreat from a close obstacle or reposition before turning.
    If camera view is blank/unreadable, backward is required as the first recovery action.
  </when>
</tool>

<tool>
  <name>turn</name>
  <description>Rotate the robot in place.</description>
  <when>
    Path is blocked and a turn will reveal a better route, or a course correction is needed.
    For scanning and visual search, default to +5-15 (at maximum)° turns at low speed.
    If uncertain, do repeated low-speed rescans.
  </when>
</tool>

<tool>
  <name>stop</name>
  <description>Halt all motion immediately. Ends the session.</description>
  <when>
    Use ONLY for immediate danger or unresolved critical execution error.
    Never use stop for blank/unreadable view recovery.
    Do NOT stop just because progress is slow or uncertain; continue navigating.
    Do NOT use to signal goal completion, use complete for that.
  </when>
</tool>

<tool>
  <name>complete</name>
  <description>
    Declare the mission fully accomplished. Ends the session.
    ONLY call this when the current frame visually confirms you are at the goal location.
    You must have already arrived and double-checked...
    Calling complete without visual confirmation is a mission failure.
  </description>
  <when>You can clearly see in the current frame that you have reached the goal. NEVER before.</when>
</tool>
</tools>`;
