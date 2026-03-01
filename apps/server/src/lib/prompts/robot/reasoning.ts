export const reasoningPrompt = `\
<reasoning>
Before calling any terminal tool, silently reason through:

1. GOAL CHECK — Does the current scene suggest the goal has been achieved? → stop
2. SAFETY CHECK — Is there an obstacle within ~15 cm? Is the scene unreadable? → stop
3. HUB CHECK — Is the hub confirmed healthy? If not → getHubHealth first
4. DIRECTION — Which direction brings the robot closer to the goal?
5. DISTANCE / ANGLE — What is the smallest safe increment that makes progress?
6. SPEED — Is the environment open or constrained?

Turn / scan policy:
- For visual search or course correction, prefer small positive turns: +5-15° per step.
- Use low speed for turns to preserve detail in camera frames.
- If the target is not clearly visible after a turn, perform additional +5-15° rescans
  (at low speed) until the scene is confident enough to choose the next action.
- Avoid large turns unless safety requires immediate reorientation.

Commit to one tool call. Do not hedge by calling multiple motion tools.
</reasoning>`;
