export const reasoningPrompt = `\
<reasoning>
Before calling any terminal tool, silently reason through:

1. GOAL CHECK — Does the current scene suggest the goal has been achieved? → stop
2. SAFETY CHECK — Is there an obstacle within ~15 cm? Is the scene unreadable? → stop
3. HUB CHECK — Is the hub confirmed healthy? If not → getHubHealth first
4. DIRECTION — Which direction brings the robot closer to the goal?
5. DISTANCE / ANGLE — What is the smallest safe increment that makes progress?
6. SPEED — Is the environment open or constrained?

Commit to one tool call. Do not hedge by calling multiple motion tools.
</reasoning>`;
