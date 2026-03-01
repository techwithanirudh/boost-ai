import type { StepRequest } from "@boost/validators";
import { getHubHealthTool } from "./get-hub-health";
import { createGetObservationTool } from "./get-observation";
import { getPositionTool } from "./get-position";

export function createDecisionTools(observation: StepRequest["observation"]) {
  return {
    getPosition: getPositionTool,
    getHubHealth: getHubHealthTool,
    getObservation: createGetObservationTool(observation),
  };
}
