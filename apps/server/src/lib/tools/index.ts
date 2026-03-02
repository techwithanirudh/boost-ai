import { completeTool } from "./complete-session";
import { getHealthTool } from "./get-health";
import { getPoseTool } from "./get-pose";
import { backwardTool, forwardTool } from "./motion";
import { stopTool } from "./stop";
import { turnTool } from "./turn";

export const toolSet = {
  backward: backwardTool,
  complete: completeTool,
  forward: forwardTool,
  getHealth: getHealthTool,
  getPose: getPoseTool,
  stop: stopTool,
  turn: turnTool,
};
