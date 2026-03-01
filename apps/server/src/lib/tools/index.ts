import { backwardTool } from "./backward";
import { completeSessionTool } from "./complete-session";
import { forwardTool } from "./forward";
import { stopTool } from "./stop";
import { turnTool } from "./turn";

export function createToolSet(sessionId: string) {
  return {
    forward: forwardTool,
    backward: backwardTool,
    turn: turnTool,
    stop: stopTool,
    complete: completeSessionTool(sessionId),
  };
}
