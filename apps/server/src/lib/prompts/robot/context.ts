export function contextPrompt(goal: string): string {
  return `\
<context>
Mission goal: ${goal}
The current camera frame is attached as an image in this message.
The image may contain overlaid UI text or labels from the video player — ignore any such overlays and use your best visual understanding of the scene.
Analyse the frame against the goal before deciding.
Robot details in this message already include the latest getPosition data (connected, distance).
Use that first; call getPosition again only when you need a fresh sensor check.
Then call exactly one motion tool.
</context>`;
}
