export interface ChatTurn {
  sequence: number;
  id: string;
  message: string;
  image_count: number;
  timezone: string;
  local_date: string;
  reply: string;
  status: "pending" | "prepared" | "complete";
  saved_entry_id?: string;
  saved_date?: string;
  created_at: string;
}
export interface ChatHistory {
  turns: ChatTurn[];
  configured: boolean;
  has_more: boolean;
}
export interface ChatRequest {
  id: string;
  message: string;
  images: string[];
  timezone: string;
  local_date: string;
}
export class ChatError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/chat${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new ChatError(
      body.error || "Chat is unavailable. Please retry.",
      response.status,
    );
  return body;
}
export const getChat = (before?: number) =>
  request<ChatHistory>(before ? `?before=${before}` : "");
export const sendChat = (body: ChatRequest) =>
  request<ChatTurn>("", { method: "POST", body: JSON.stringify(body) });
export const connectChat = (api_key: string) =>
  request<{ configured: boolean }>("/connection", {
    method: "PUT",
    body: JSON.stringify({ api_key }),
  });

/** Resize on the phone and re-encode pixels to strip EXIF/location metadata. */
export async function prepareChatPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024)
    throw new Error("Choose an image under 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error(
        "This photo could not be opened. Try a JPEG or PNG image.",
      );
    }
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000
    )
      throw new Error("This image is too large. Choose a smaller photo.");
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Photo preparation is unavailable in this browser.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.82);
    if (data.length > 2_790_000)
      throw new Error("This photo is still too large. Try a smaller image.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
