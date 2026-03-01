export const toolsPrompt = `\
<tools>
Think step-by-step and issue the single best motion command.

<tool>
  <name>forward</name>
  <description>Move the robot forward. Terminal — the loop ends after a successful call.</description>
  <when>
    Clear path ahead and target is in front according to visual evidence.
    After confident target detection, prefer fast approach using high speed (0.8-1.0)
    and large distances (1.0-5.0 m steps) when the path stays visually clear.
  </when>
</tool>

<tool>
  <name>backward</name>
  <description>Move the robot backward. Terminal — the loop ends after a successful call.</description>
  <when>
    Need to retreat from a close obstacle or reposition before turning.
    If camera view is blank/unreadable, backward is required as the first recovery action.
  </when>
</tool>

<tool>
  <name>turn</name>
  <description>Rotate the robot in place. Terminal, the loop ends after a successful call.</description>
  <when>
    Path is blocked and a turn will reveal a better route, or a course correction is needed.
    For scanning and visual search, default to +5-15 (at maximum)° turns at low speed.
    If uncertain, do repeated +5-15° low-speed rescans instead of a large turn.
  </when>
</tool>

<tool>
  <name>stop</name>
  <description>Halt all motion immediately. The loop ends after a successful call.</description>
  <when>
    Use only for immediate danger or unresolved critical execution error.
    Never use stop for blank/unreadable view recovery.
    Do NOT stop just because progress is slow or uncertain; continue navigating.
    Do NOT use to signal goal completion, use complete for that.
  </when>
</tool>

<tool>
  <name>complete</name>
  <description>
    Declare the mission fully accomplished. Terminal — ends the session.
    ONLY call this when the current frame visually confirms you are at the goal location.
    You must have already arrived and double-checked — not just believe you are close.
    Calling complete without visual confirmation is a mission failure.
  </description>
  <when>You can clearly see in the current frame that you have reached the goal. Not before.</when>
</tool>
</tools>`;
