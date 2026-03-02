import { completeTool } from "./complete-session";
import { getHealthTool } from "./get-health";
import { getPositionTool } from "./get-position";
import { backwardTool, forwardTool } from "./motion";
import { stopTool } from "./stop";
import { turnTool } from "./turn";

export const toolSet = {
  backward: backwardTool,
  complete: completeTool,
  forward: forwardTool,
  getHealth: getHealthTool,
  getPosition: getPositionTool,
  stop: stopTool,
  turn: turnTool,
};

export type RobotToolSet = typeof toolSet;

export function createToolSet(_sessionId?: string) {
  return toolSet;
}
