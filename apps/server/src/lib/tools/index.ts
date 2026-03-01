import { backwardTool } from "./backward";
import { forwardTool } from "./forward";
import { getHealthTool } from "./get-health";
import { getPositionTool } from "./get-position";
import { stopTool } from "./stop";
import { turnTool } from "./turn";

export { backwardTool, forwardTool, getHealthTool, getPositionTool, stopTool, turnTool };
export { createCompleteSessionTool } from "./complete-session";

export function createToolSet() {
  return {
    getHubHealth: getHealthTool,
    getPosition: getPositionTool,
    forward: forwardTool,
    backward: backwardTool,
    turn: turnTool,
    stop: stopTool,
  };
}
