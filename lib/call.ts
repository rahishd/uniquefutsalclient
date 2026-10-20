// One-to-one voice calls in a direct chat. The audio goes straight between the two phones (WebRTC); the server only carries the
// call set-up and state (see backend docs/API.md, "Voice calls"). Calls are audio only.
//
// Flow: the caller makes an offer and rings the other person; the other person's app sees it (it asks every few seconds, and a
// phone alert opens the app) and answers; the caller's app picks the answer up and the two phones connect.
import { useSyncExternalStore } from "react";
import { api, errorText } from "@/lib/api";

export type CallPhase = "idle" | "calling" | "incoming" | "connecting" | "active";

export interface CallState {
  phase: CallPhase;
  callId: string | null;
  threadId: string | null;
  peer: string; // the other person's name
  avatar: string | null;
  muted: boolean;
  startedAt: number | null; // when the audio connected
  notice: string | null; // why the last call ended, or a problem to show
}

interface IncomingCall {
  id: string;
  threadId: string;
  from: string;
  avatar: string | null;
  offer: string;
}

const IDLE: CallState = { phase: "idle", callId: null, threadId: null, peer: "", avatar: null, muted: false, startedAt: null, notice: null };

let state: CallState = IDLE;
const listeners = new Set<() => void>();
const set = (patch: Partial<CallState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let pc: RTCPeerConnection | null = null;
let local: MediaStream | null = null;
let remote: HTMLAudioElement | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let ringing: IncomingCall | null = null;
const declined = new Set<string>(); // calls I already refused or that ended: never ring again

export const supported = () =>
  typeof window !== "undefined" && "RTCPeerConnection" in window && !!navigator.mediaDevices?.getUserMedia;

export function useCall(): CallState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => IDLE,
  );
}

function audioEl() {
  if (!remote) {
    remote = new Audio();
    remote.autoplay = true;
    remote.setAttribute("playsinline", "");
  }
  return remote;
}

function cleanup() {
  if (poll) clearInterval(poll);
  poll = null;
  if (pc) {
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    try { pc.close(); } catch { /* already closed */ }
  }
  pc = null;
  local?.getTracks().forEach((t) => t.stop());
  local = null;
  if (remote) remote.srcObject = null;
  ringing = null;
}

function finish(notice: string | null) {
  cleanup();
  state = { ...IDLE, notice };
  listeners.forEach((l) => l());
  if (notice) setTimeout(() => { if (state.phase === "idle" && state.notice === notice) set({ notice: null }); }, 4000);
}

async function microphone(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  } catch {
    throw new Error("Allow the microphone for this site to make calls.");
  }
}

async function connection(): Promise<RTCPeerConnection> {
  const { iceServers } = await api<{ iceServers: RTCIceServer[] }>("/chat/calls/ice");
  const c = new RTCPeerConnection({ iceServers });
  local!.getTracks().forEach((t) => c.addTrack(t, local!));
  c.ontrack = (e) => {
    const el = audioEl();
    el.srcObject = e.streams[0];
    void el.play().catch(() => {});
  };
  c.onconnectionstatechange = () => {
    if (c.connectionState === "connected" && state.startedAt === null) set({ phase: "active", startedAt: Date.now() });
    if (c.connectionState === "failed" && state.callId) {
      void api(`/chat/calls/${state.callId}/end`, { method: "POST" }).catch(() => {});
      finish("The call could not connect. Please try again.");
    }
  };
  return c;
}

// the set-up is sent once, complete (no trickling): wait until the phone has found its network addresses
function gathered(c: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (c.iceGatheringState === "complete") return resolve();
    const done = () => { c.removeEventListener("icegatheringstatechange", check); resolve(); };
    const check = () => { if (c.iceGatheringState === "complete") done(); };
    c.addEventListener("icegatheringstatechange", check);
    setTimeout(done, 4000);
  });
}

// ask the server how the call stands until it is over
function watch(callId: string, onAnswer?: (answer: string) => Promise<void>) {
  let answered = false;
  poll = setInterval(async () => {
    try {
      const s = await api<{ status: string; answer: string | null }>(`/chat/calls/${callId}`);
      if (s.status === "active" && s.answer && onAnswer && !answered) {
        answered = true;
        await onAnswer(s.answer);
      }
      if (s.status === "declined") finish("They declined the call.");
      else if (s.status === "missed") finish(state.phase === "incoming" ? "Missed call." : "No answer.");
      else if (s.status === "ended") finish("Call ended.");
    } catch {
      // a failed check just tries again
    }
  }, 1500);
}

/** Call the other person in a direct chat. */
export async function startCall(threadId: string, peer: string, avatar: string | null = null) {
  if (state.phase !== "idle") return;
  if (!supported()) { set({ notice: "Voice calls are not available in this browser." }); return; }
  set({ ...IDLE, phase: "calling", threadId, peer, avatar });
  try {
    local = await microphone();
    pc = await connection();
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const { id } = await api<{ id: string }>("/chat/calls", { method: "POST", body: { threadId, offer: JSON.stringify(pc.localDescription) } });
    set({ callId: id });
    watch(id, async (answer) => {
      await pc?.setRemoteDescription(JSON.parse(answer));
      set({ phase: "connecting" });
    });
  } catch (e) {
    finish(e instanceof Error && e.message.startsWith("Allow") ? e.message : errorText(e));
  }
}

/** Pick up the call that is ringing. */
export async function acceptCall() {
  const call = ringing;
  if (!call || state.phase !== "incoming") return;
  set({ phase: "connecting" });
  try {
    local = await microphone();
    pc = await connection();
    await pc.setRemoteDescription(JSON.parse(call.offer));
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    await api(`/chat/calls/${call.id}/answer`, { method: "POST", body: { answer: JSON.stringify(pc.localDescription) } });
    watch(call.id);
  } catch (e) {
    void api(`/chat/calls/${call.id}/end`, { method: "POST" }).catch(() => {});
    finish(e instanceof Error && e.message.startsWith("Allow") ? e.message : errorText(e));
  }
}

/** Refuse a ringing call, or hang up one in progress. */
export async function endCall() {
  const id = state.callId;
  if (state.phase === "incoming" && ringing) declined.add(ringing.id);
  if (id) declined.add(id);
  finish(null);
  if (id) await api(`/chat/calls/${id}/end`, { method: "POST" }).catch(() => {});
}

export function toggleMute() {
  const on = !state.muted;
  local?.getAudioTracks().forEach((t) => { t.enabled = !on; });
  set({ muted: on });
}

/** Ask whether someone is calling me. Run every few seconds while signed in; does nothing during a call. */
export async function checkIncoming() {
  if (state.phase !== "idle" && state.phase !== "incoming") return;
  try {
    const c = await api<IncomingCall | null>("/chat/calls/incoming");
    if (c && !declined.has(c.id)) {
      if (state.phase === "idle") {
        ringing = c;
        try { navigator.vibrate?.([300, 150, 300]); } catch { /* not supported */ }
        set({ ...IDLE, phase: "incoming", callId: c.id, threadId: c.threadId, peer: c.from, avatar: c.avatar });
      }
    } else if (state.phase === "incoming") {
      finish("Missed call."); // they hung up or it timed out before I answered
    }
  } catch {
    // offline or signed out: try again next time
  }
}

export function clearNotice() {
  if (state.notice) set({ notice: null });
}
