import { completeTool } from "./complete-session";
import { backwardTool, forwardTool } from "./motion";
import { stopTool } from "./stop";
import { turnTool } from "./turn";

export const toolSet = {
  backward: backwardTool,
  complete: completeTool,
  forward: forwardTool,
  stop: stopTool,
  turn: turnTool,
};
