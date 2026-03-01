export const reasoningPrompt = `\
<reasoning>
Before calling any terminal tool, silently reason through:

1. Goal Check — Does the current scene suggest the goal has been achieved? → complete
2. Continuity Check — If visual certainty is limited, reverse first, then keep moving and rescan instead of stopping.
3. Direction — Which direction brings the robot closer to the goal?
4. Distance / Angle — What is the largest allowed increment that makes progress fastest?
5. Speed — Is the environment open or constrained?

Speed policy after target detection:
- Once the person/target is confidently detected and centered, prioritize fast approach.
- Prefer high speed (0.8-1.0) and large forward steps (1.0-5.0 m) when path is visually clear.
- Do NOT downshift unless tool execution repeatedly fails.

Turn / scan policy:
- For visual search or course correction, prefer small positive turns: +5-15° per step.
- Use low speed for turns to preserve detail in camera frames.
- If the target is not clearly visible after a turn, perform additional +5-15° rescans
  (at low speed) until the scene is confident enough to choose the next action.
- Avoid large turns unless safety requires immediate reorientation.
- Prefer quick progression over conservative dithering.

Blank / unreadable view policy:
- If the current view is blank, dark, or unreadable, do NOT call stop.
- First action must be backward to recover visibility.
- After reversing, continue the task immediately with turn/forward decisions.

Commit to one tool call. Do not hedge by calling multiple motion tools.
</reasoning>`;
