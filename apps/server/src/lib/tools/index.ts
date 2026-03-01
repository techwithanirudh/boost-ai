import { completeSessionTool } from "./complete-session";
import { backwardTool } from "./backward";
import { forwardTool } from "./forward";
import { getHealthTool } from "./get-health";
import { getPositionTool } from "./get-position";
import { stopTool } from "./stop";
import { turnTool } from "./turn";

export { backwardTool, forwardTool, getHealthTool, getPositionTool, stopTool, turnTool };

export function createToolSet(sessionId: string) {
  return {
    getHubHealth: getHealthTool,
    getPosition: getPositionTool,
    forward: forwardTool,
    backward: backwardTool,
    turn: turnTool,
    stop: stopTool,
    complete: completeSessionTool(sessionId),
  };
}
