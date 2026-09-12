export const phases = ["preparation", "action", "meeting", "paused", "ended"] as const;
export type Phase = (typeof phases)[number];

export const phaseLabels: Record<Phase, string> = {
  preparation: "准备中",
  action: "行动阶段",
  meeting: "会议中",
  paused: "已暂停",
  ended: "已结束",
};

export type Role = "good" | "bad";

export interface ActionResult {
  ok: boolean;
  code: string;
  message: string;
  duplicate?: boolean;
}

export interface GameRow {
  id: number;
  code: string;
  phase: Phase;
  created_at: number;
  updated_at: number;
}

export interface PlayerRow {
  id: number;
  game_id: number;
  name: string;
  role: Role;
  alive: number;
  nfc_token: string;
  kill_cooldown_until: number;
}

export interface TaskRow {
  id: number;
  game_id: number;
  name: string;
  nfc_token: string;
}
