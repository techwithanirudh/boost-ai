export const reasoningPrompt = `\
<reasoning>
Before calling any terminal tool, silently reason through:

1. GOAL CHECK — Does the current scene suggest the goal has been achieved? → complete
2. CONTINUITY CHECK — If visual certainty is limited, keep moving and rescan instead of stopping.
3. HUB CHECK — Is the hub confirmed healthy? If not → getHubHealth first
4. DIRECTION — Which direction brings the robot closer to the goal?
5. DISTANCE / ANGLE — What is the largest allowed increment that makes progress fastest?
6. SPEED — Is the environment open or constrained?

Speed policy after target detection:
- Once the person/target is confidently detected and centered, prioritize fast approach.
- Prefer high speed (0.8-1.0) and large legal forward steps (20-30 cm) when path is visually clear.
- Do NOT downshift unless tool execution repeatedly fails.

Turn / scan policy:
- For visual search or course correction, prefer small positive turns: +5-15° per step.
- Use low speed for turns to preserve detail in camera frames.
- If the target is not clearly visible after a turn, perform additional +5-15° rescans
  (at low speed) until the scene is confident enough to choose the next action.
- Avoid large turns unless safety requires immediate reorientation.
- Prefer quick progression over conservative dithering.

Commit to one tool call. Do not hedge by calling multiple motion tools.
</reasoning>`;
