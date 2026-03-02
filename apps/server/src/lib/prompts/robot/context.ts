export function contextPrompt(goal: string): string {
  return `\
<context>
Mission goal: ${goal}
The current camera frame is attached as an image in this message.
The image may contain overlaid UI text or labels from the video player — ignore any such overlays and use your best visual understanding of the scene.
Analyse the frame against the goal before deciding.
Do not rely on distance sensor readings; prioritize direct visual confirmation from the frame.
Then call exactly one motion tool.
</context>`;
}
