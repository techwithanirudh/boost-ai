- Write server log to a file
- Switch camera feed in web UI from MediaMTX WebRTC iframe to Vidstack (HLS provider) for a proper player with controls — see https://www.vidstack.io and https://github.com/techwithanirudh/portfolio for implementation reference

## Depth Map (ml-depth-pro)
Add depth map as a second image part in the AI user message.
- Sidecar: https://github.com/apple/ml-depth-pro
- In `apps/server/src/services/orchestrator.ts` add `{ type: "image", image: depthMapUrl }` alongside the RGB frame already passed to the model.
