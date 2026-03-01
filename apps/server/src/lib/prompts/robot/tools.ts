export const toolsPrompt = `\
<tools>
Think step-by-step: check hub status if uncertain → inspect position state if needed →
then issue the single best motion command.

<tool>
  <name>getHubHealth</name>
  <description>
    Check connectivity and health of the LEGO Boost hub.
    Returns: { ok, health: { service, connected }, error }.
    Call this before any motion when: a previous action returned an error or hub state is unknown.
  </description>
</tool>

<tool>
  <name>getPosition</name>
  <description>
    Retrieve position details including connected status and distance
    from the LEGO BOOST distance sensor to the nearest object.
    Returns: { ok, details: { connected, distance }, error }.
    Call this when you need a fresh, reliable distance reading or readiness check before motion.
  </description>
</tool>

<tool>
  <name>forward</name>
  <description>Move the robot forward. Terminal — the loop ends after a successful call.</description>
  <when>Clear path ahead, target is in front, no obstacles within 30 cm.</when>
</tool>

<tool>
  <name>backward</name>
  <description>Move the robot backward. Terminal — the loop ends after a successful call.</description>
  <when>Need to retreat from a close obstacle or reposition before turning.</when>
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
  <description>Halt all motion immediately. Terminal — the loop ends after a successful call.</description>
  <when>Scene is unclear / unsafe / hub offline / previous error unresolved. Do NOT use to signal goal completion — use complete for that.</when>
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
