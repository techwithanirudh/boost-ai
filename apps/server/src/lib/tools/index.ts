import { getHealthTool } from "./get-health";
import { getPositionTool } from "./get-position";

export function createTools() {
  return {
    getPosition: getPositionTool,
    getHubHealth: getHealthTool
  };
}
