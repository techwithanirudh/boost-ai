- Declare .env at the root
- Write server log to a file and configure global logger
- Add commitlint / configure linting

## Depth Map (ml-depth-pro)
Add depth map as a second image part in the AI user message.
- Sidecar: https://github.com/apple/ml-depth-pro
- In `apps/server/src/services/orchestrator.ts` add `{ type: "image", image: depthMapUrl }`
  alongside the RGB frame already passed to the model.