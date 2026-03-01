export interface MissionState {
  status: "running" | "stopped";
  goal: string;
  updatedAt: string;
}

/** In-memory mission registry. Replaced by DB in a future phase. */
export const missions = new Map<string, MissionState>();

export function getMission(missionId: string): MissionState | undefined {
  return missions.get(missionId);
}

export function setMission(missionId: string, state: MissionState): void {
  missions.set(missionId, state);
}
