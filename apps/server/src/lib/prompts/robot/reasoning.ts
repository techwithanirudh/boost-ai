export const reasoningPrompt = `\
<reasoning>
Before calling any terminal tool, silently reason through:

1. Goal Check: Does the current scene clearly show the goal has been reached? → complete
2. Continuity Check: If visual certainty is limited, reverse slightly to recover view then keep moving.
3. Direction: Which direction brings the robot closer to the goal?
4. Distance / Angle: Choose a cautious step that makes progress without risking overshooting.
5. Speed: Prefer lower speeds (0.4-0.6) by default; use up to 1 on clear paths.

Step size policy:
- Default to small steps: 0.25-0.5 m for careful navigation.
- Use up to 5m only when the path is visually confirmed wide-open ahead.
- Never exceed the schema maximum (10 m).

Turn / scan policy:
- For visual search or course correction, prefer small turns: +5-15° per step.
- Use low speed for turns to preserve detail in camera frames.
- If the target is not clearly visible after a turn, perform additional rescans.

Blank view policy:
- If the current view is blank, dark, or unreadable, do NOT call stop.
- First action must be backward to recover visibility.
- After reversing, continue the task immediately with turn/forward decisions.

Commit to one tool call per step. Do NOT hedge by calling multiple motion tools.
</reasoning>`;
