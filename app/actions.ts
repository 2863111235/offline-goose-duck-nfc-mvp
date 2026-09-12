"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  correctPlayer,
  getPlayer,
  killPlayer,
  resetGame,
  resolveTask,
  setPhase,
  startTask,
} from "@/lib/game-service";
import { phases, type ActionResult, type Phase } from "@/lib/types";
import {
  clearPlayerSession,
  getPlayerSession,
  isAdmin,
  setAdminSession,
  setPlayerSession,
  verifyAdminPin,
} from "@/lib/session";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || "");
}

function number(formData: FormData, key: string): number {
  return Number(text(formData, key));
}

function resultRedirect(actionResult: ActionResult, back = "/me"): never {
  const query = new URLSearchParams({
    ok: actionResult.ok ? "1" : "0",
    message: actionResult.message,
    back,
  });
  redirect(`/result?${query.toString()}`);
}

export async function selectPlayerAction(formData: FormData) {
  const playerId = number(formData, "playerId");
  const player = getPlayer(playerId);
  if (!player) resultRedirect({ ok: false, code: "PLAYER_NOT_FOUND", message: "找不到这个玩家" }, "/");
  await setPlayerSession(playerId);
  const returnTo = text(formData, "returnTo");
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/me");
}

export async function clearPlayerAction() {
  await clearPlayerSession();
  redirect("/");
}

export async function killAction(formData: FormData) {
  const actorId = await getPlayerSession();
  if (!actorId)
    resultRedirect({ ok: false, code: "NO_SESSION", message: "请先选择本局身份" }, "/");
  const targetToken = text(formData, "targetToken");
  resultRedirect(
    killPlayer({
      actorId,
      targetToken,
      requestKey: text(formData, "requestKey"),
      issuedAt: number(formData, "issuedAt"),
    }),
    `/nfc/player/${targetToken}`,
  );
}

export async function startTaskAction(formData: FormData) {
  const playerId = await getPlayerSession();
  if (!playerId)
    resultRedirect({ ok: false, code: "NO_SESSION", message: "请先选择本局身份" }, "/");
  const taskToken = text(formData, "taskToken");
  resultRedirect(
    startTask({
      playerId,
      taskToken,
      requestKey: text(formData, "requestKey"),
      issuedAt: number(formData, "issuedAt"),
    }),
    `/nfc/task/${taskToken}`,
  );
}

export async function adminLoginAction(formData: FormData) {
  if (!verifyAdminPin(text(formData, "pin")))
    resultRedirect({ ok: false, code: "BAD_PIN", message: "裁判 PIN 不正确" }, "/admin");
  await setAdminSession();
  redirect("/admin");
}

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin");
}

export async function setPhaseAction(formData: FormData) {
  await requireAdmin();
  const phase = text(formData, "phase") as Phase;
  if (!phases.includes(phase))
    resultRedirect({ ok: false, code: "INVALID_PHASE", message: "未知阶段" }, "/admin");
  setPhase(phase);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/me");
  redirect("/admin");
}

export async function resetGameAction() {
  await requireAdmin();
  resetGame();
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function resolveTaskAction(formData: FormData) {
  await requireAdmin();
  const actionResult = resolveTask(number(formData, "runId"), text(formData, "decision") === "approve");
  if (!actionResult.ok) resultRedirect(actionResult, "/admin");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function correctPlayerAction(formData: FormData) {
  await requireAdmin();
  const actionResult = correctPlayer(
    number(formData, "playerId"),
    text(formData, "correction") as "revive" | "mark_dead" | "clear_cooldown",
    text(formData, "reason"),
  );
  if (!actionResult.ok) resultRedirect(actionResult, "/admin");
  revalidatePath("/admin");
  revalidatePath("/me");
  redirect("/admin");
}
