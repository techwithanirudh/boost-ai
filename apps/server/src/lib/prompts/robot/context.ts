export function contextPrompt(
  goal: string,
  movementLog: string,
  hasDepth: boolean
): string {
  return `\
<context>
Mission goal: ${goal}
Movement history this session: ${movementLog}
The first attached image is the current live camera frame.${hasDepth ? " The second image is a depth map — lighter pixels = closer to the robot." : ""}
The frame may contain overlaid UI text from the video player, ignore it.
Analyse the image${hasDepth ? "s" : ""} against the goal, then call a motion tool.
</context>`;
}
