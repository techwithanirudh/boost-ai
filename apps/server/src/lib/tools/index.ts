import { backwardTool } from "./backward";
import { forwardTool } from "./forward";
import { getHealthTool } from "./get-health";
import { getPositionTool } from "./get-position";
import { stopTool } from "./stop";
import { turnTool } from "./turn";

export { backwardTool, forwardTool, getHealthTool, getPositionTool, stopTool, turnTool };

/** All tools available to the orchestrator. */
export function createTools() {
  return {
    // Diagnostic (non-terminal)
    getHubHealth: getHealthTool,
    getPosition: getPositionTool,
    // Motion (terminal — loop stops on first successful call)
    forward: forwardTool,
    backward: backwardTool,
    turn: turnTool,
    stop: stopTool,
  };
}
