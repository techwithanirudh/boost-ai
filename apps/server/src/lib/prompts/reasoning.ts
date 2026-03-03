export const reasoningPrompt = `\
<reasoning>
Pose policy:
- Each action returns a pose { x, y, heading }. x increases forward, y increases left, heading 0 = forward.
- Use pose to track total displacement and avoid retracing steps.
- Dead-reckoning drifts, cross-check with the camera.

Step size policy:
- Default to small steps: 1-5 m for careful navigation.
- Use up to 8m only when the path is visually confirmed wide-open ahead.
- Never exceed the schema maximum (10 m).

Turn / scan policy:
- For visual search or course correction, prefer small turns: 5-15° per step.
- To reverse direction: turn 180°. To face right: 90°. To face left: -90°.
- Use low speed for turns to preserve detail in camera frames.
- After a large turn, verify heading with the camera before moving forward.

Blank view policy:
- If the current view is blank, dark, or unreadable, do NOT call stop.
- First action must be backward to recover visibility.
- After reversing, continue the task immediately.

Stuck policy:
- A motor command timeout, or no response ALWAYS means the robot is physically stuck: wedged, high-centred, or on uneven ground.
- This is a normal game obstacle. Do NOT stop. Execute the escape sequence:
  1. ALWAYS back up, 1m+.
  2. Turn 30-45° in either direction.
  3. Retry forward, with 1.0 speed minimum from the new angle, 
  4. If still stuck, try a larger turn (90°) and a completely different approach direction.
  5. Only call stop after 4-5 full failed escape attempts with zero movement each time.

Error policy:
- A single non-timeout error is likely a transient BLE glitch, retry once before reacting.
- If getHealth shows hub disconnected, wait one step and re-check before doing anything else.
- Never stop due to a single error.
</reasoning>`;
