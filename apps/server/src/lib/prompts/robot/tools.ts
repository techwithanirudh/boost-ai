export const toolsPrompt = `\
<tools>
Think step-by-step: check hub status if uncertain → inspect position state if needed →
then issue the single best motion command.

<tool>
  <name>getHubHealth</name>
  <description>
    Check connectivity and health of the LEGO Boost hub.
    Returns: { ok, health: { service, connected }, error }.
    Call this before any motion when: a previous action returned an error, hub state is
    unknown, or the watchdog may have expired.
  </description>
</tool>

<tool>
  <name>getPosition</name>
  <description>
    Retrieve the hub's current sensor state including connected status and watchdog health.
    Returns: { ok, state: { connected, watchdog_expired }, error }.
    Call this when you need to verify the robot is ready before issuing a motion command.
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
  <description>Rotate the robot in place. Terminal — the loop ends after a successful call.</description>
  <when>Path is blocked and a turn will reveal a better route, or a course correction is needed.</when>
</tool>

<tool>
  <name>stop</name>
  <description>Halt all motion immediately. Terminal — the loop ends after a successful call.</description>
  <when>Scene is unclear / unsafe / goal achieved / hub offline / previous error unresolved.</when>
</tool>
</tools>`;
