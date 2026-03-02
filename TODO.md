- Write server log to a file
- Switch camera feed in web UI from MediaMTX WebRTC iframe to Vidstack (HLS provider) for a proper player with controls — see https://www.vidstack.io and https://github.com/techwithanirudh/portfolio for implementation reference
- **`prepareStep` image pruning**: replace `pruneMessages({ toolCalls: "before-last-2-messages" })` with a custom function that strips only `{ type: "media" }` parts from old tool result outputs, keeping all tool call/result text intact. This preserves the model's action history (e.g. "I already turned right twice") while still preventing image token blowup — the best of all three approaches (main branch, old user-message injection, current pruneMessages).

## Depth Map (ml-depth-pro)
Add depth map as a second image part in the AI user message.
- Sidecar: https://github.com/apple/ml-depth-pro
- In `apps/server/src/services/orchestrator.ts` add `{ type: "image", image: depthMapUrl }` alongside the RGB frame already passed to the model.
- Use tanstack query for calling APIs, and use heyapi for hub logic... re-add all shadcn components

- The loading skeleton for AI Chat is irritating
- If the health status for boost is unhealthy block the whole app-ish becausew whole app rlies on boost
- If boost is disconnected again, always reconnect, indicdate in api tooand frontend
- The title code is cluttered / cursed
- Inject movement map (6 images)
- Take tool snapshot at final, not half way for tools
- delete getPosition tool
- Don't pass task on session create, it restarts the task
- Padding not equal in chat view
- Don't allow to create new sessions when running...
- pass image at first too, not only on tool call
- show portrait view for camera preview
- update title on gen dont wait til reload
- sometimes stream is broken