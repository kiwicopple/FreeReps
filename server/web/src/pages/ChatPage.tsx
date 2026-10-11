import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Camera, ImagePlus, MessageCircle, Send, X } from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageContent from "../components/PageContent";
import PageSection from "../components/PageSection";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Field, FieldLabel, FieldDescription } from "../components/ui/field";
import { Alert } from "../components/ui/alert";
import { Skeleton } from "../components/ui/skeleton";
import {
  ChatError,
  connectChat,
  getChat,
  prepareChatPhoto,
  sendChat,
  type ChatRequest,
  type ChatTurn,
} from "../chatApi";
import { localToday, localTimeZone } from "../utils/localDate";
import "./chat.css";

export default function ChatPage() {
  const cache = useQueryClient();
  const history = useQuery({
    queryKey: ["chat"],
    queryFn: () => getChat(),
    refetchOnWindowFocus: true,
  });
  const [older, setOlder] = useState<ChatTurn[]>([]);
  const [more, setMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [pending, setPending] = useState<ChatRequest | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState(false);
  const [key, setKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    let fullHeight = window.innerHeight;
    let width = window.innerWidth;
    const resize = () => {
      if (!screen.current) return;
      // Standalone iOS can shrink innerHeight along with visualViewport.height.
      // Keep the pre-keyboard height, resetting it when orientation changes.
      if (width !== window.innerWidth) {
        width = window.innerWidth;
        fullHeight = window.innerHeight;
      }
      fullHeight = Math.max(fullHeight, window.innerHeight);
      screen.current.style.setProperty(
        "--chat-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
      screen.current.style.setProperty(
        "--chat-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      screen.current.dataset.keyboard = String(
        fullHeight - (viewport?.height ?? window.innerHeight) > 150,
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  const current = history.data?.turns ?? [];
  const ids = new Set(current.map((t) => t.id));
  const turns = [...older.filter((t) => !ids.has(t.id)), ...current].filter(
    (t) => t.status !== "pending" || t.id === pending?.id,
  );
  const configured = history.data?.configured ?? false;
  const latestID = current[current.length - 1]?.id;
  useEffect(() => {
    const scroller = end.current?.closest(".chat-scroll");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [latestID, sending]);
  // Returning from another tab reloads the one server-side conversation.
  useEffect(() => {
    if (
      pending &&
      current.some((t) => t.id === pending.id && t.status === "complete")
    ) {
      setPending(null);
      setText("");
      setPhotos([]);
      setError("");
    }
  }, [current, pending]);

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (photos.length + files.length > 3) {
      setError("Attach up to three photos at a time.");
      return;
    }
    setPreparing(true);
    setError("");
    try {
      const added = await Promise.all(files.map(prepareChatPhoto));
      setPhotos((currentPhotos) => [...currentPhotos, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare photo.");
    } finally {
      setPreparing(false);
    }
  }
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (sending || preparing) return;
    const body = pending ?? {
      id: crypto.randomUUID(),
      message: text.trim(),
      images: photos,
      timezone: localTimeZone(),
      local_date: localToday(),
    };
    if (!body.message && !body.images.length) return;
    setPending(body);
    setSending(true);
    setError("");
    try {
      const result = await sendChat(body);
      cache.setQueryData(
        ["chat"],
        (previous: Awaited<ReturnType<typeof getChat>> | undefined) => ({
          configured: true,
          has_more: previous?.has_more ?? false,
          turns: [
            ...(previous?.turns ?? []).filter((t) => t.id !== result.id),
            result,
          ].sort((a, b) => a.sequence - b.sequence),
        }),
      );
      setPending(null);
      setText("");
      setPhotos([]);
      // Nutrition queries have several keys; marking them stale keeps saved meals visible on return.
      await cache.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "chat",
      });
      input.current?.focus();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection lost. Press Send again to check its save status.",
      );
      if (e instanceof ChatError && [400, 502].includes(e.status))
        setPending(null);
      void history.refetch();
    } finally {
      setSending(false);
    }
  }
  async function saveKey(event: FormEvent) {
    event.preventDefault();
    setSavingKey(true);
    setError("");
    try {
      await connectChat(key.trim());
      setKey("");
      setConnection(false);
      await history.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save connection.");
    } finally {
      setSavingKey(false);
    }
  }
  async function loadOlder() {
    const first = turns[0];
    if (!first) return;
    setLoadingOlder(true);
    try {
      const data = await getChat(first.sequence);
      setOlder((existing) => [...data.turns, ...existing]);
      setMore(data.has_more);
    } catch {
      setError("Could not load older messages. Please try again.");
    } finally {
      setLoadingOlder(false);
    }
  }
  const locked = sending || preparing || !!pending;
  return (
    <div className="chat-screen" ref={screen}>
      <PageHeader
        title="Chat"
        actions={
          configured && (
            <Button
              variant="ghost"
              disabled={sending}
              onClick={() => {
                setConnection((value) => !value);
                setKey("");
              }}
            >
              Connection
            </Button>
          )
        }
      />
      <PageContent className="chat-page">
        <div className="chat-scroll">
          {history.isPending && <Skeleton className="h-28 w-full" />}
          {history.isError && (
            <Alert role="alert">
              Could not load chat.{" "}
              <Button variant="outline" onClick={() => void history.refetch()}>
                Retry
              </Button>
            </Alert>
          )}
          {history.data && (!configured || connection) && (
            <PageSection
              title="Connect OpenAI"
              description="Use your OpenAI API key for this private chat."
            >
              <form onSubmit={saveKey} className="space-y-4">
                <Field>
                  <FieldLabel htmlFor="chat-api-key">OpenAI API key</FieldLabel>
                  <Input
                    id="chat-api-key"
                    type="password"
                    autoComplete="off"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sk-…"
                    required
                    maxLength={512}
                    disabled={savingKey}
                  />
                  <FieldDescription>
                    The key is kept on your server and is never included in chat
                    replies. API usage is billed to that key.
                  </FieldDescription>
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={savingKey || !key.trim()}>
                    {savingKey ? "Saving…" : "Save connection"}
                  </Button>
                  {configured && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setConnection(false);
                        setKey("");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </PageSection>
          )}
          {!history.isPending && !history.isError && (
            <div
              className="chat-history"
              role="region"
              aria-label="Conversation"
            >
              {!!turns.length && history.data?.has_more && more && (
                <Button
                  variant="ghost"
                  disabled={loadingOlder}
                  onClick={loadOlder}
                >
                  {loadingOlder ? "Loading…" : "Older messages"}
                </Button>
              )}
              {!turns.length && (
                <div className="chat-empty">
                  <MessageCircle
                    className="mx-auto mb-3 size-8 text-muted-foreground"
                    aria-hidden
                  />
                  <h2>Food, photos, and a quick chat</h2>
                  <p>
                    Tell me what you ate, take a photo, or ask about a menu.
                    Everything stays in this one conversation.
                  </p>
                </div>
              )}
              {turns.map((turn) => (
                <div key={turn.id} className="chat-turn">
                  <article
                    aria-label="Your message"
                    className="chat-message chat-message-user"
                  >
                    {turn.message && <p>{turn.message}</p>}
                    {turn.image_count > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {turn.image_count} photo
                        {turn.image_count > 1 ? "s" : ""} sent · image not
                        stored
                      </p>
                    )}
                  </article>
                  {turn.status === "complete" ? (
                    <article
                      aria-label="Protocol reply"
                      className="chat-message chat-message-assistant"
                    >
                      <p>{turn.reply}</p>
                      {turn.saved_entry_id && (
                        <Button
                          variant="link"
                          className="mt-2 px-0"
                          render={
                            <Link
                              to={`/nutrition?date=${turn.saved_date ?? turn.local_date}&range=day&tab=food-log`}
                            />
                          }
                        >
                          View nutrition log
                        </Button>
                      )}
                    </article>
                  ) : (
                    turn.id !== pending?.id && (
                      <p className="text-sm text-muted-foreground">
                        {turn.status === "prepared"
                          ? "Reply awaiting save confirmation. Sending your next message will recover it."
                          : "No completed reply. You can resend the message; attach photos again if needed."}
                      </p>
                    )
                  )}
                </div>
              ))}
              {pending && !turns.some((t) => t.id === pending.id) && (
                <article
                  aria-label="Your pending message"
                  className="chat-message chat-message-user"
                >
                  <p>{pending.message || "Photo message"}</p>
                </article>
              )}
              {sending && (
                <p role="status" className="text-sm text-muted-foreground">
                  Looking at your message…
                </p>
              )}
              <div ref={end} />
            </div>
          )}
        </div>
        {error && (
          <Alert className="chat-error" role="alert">
            {error}
          </Alert>
        )}
        {configured && !history.isError && (
          <form
            onSubmit={submit}
            className="chat-composer"
            aria-label="Send a message"
          >
            {!!photos.length && (
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <div className="relative" key={index}>
                    <img
                      src={photo}
                      alt={`Attached photo ${index + 1}`}
                      className="size-20 rounded-lg object-cover"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute -right-1 -top-1 size-6"
                      aria-label={`Remove photo ${index + 1}`}
                      disabled={locked}
                      onClick={() =>
                        setPhotos((items) =>
                          items.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Field>
              <FieldLabel htmlFor="chat-message" className="sr-only">
                Message
              </FieldLabel>
              <Textarea
                ref={input}
                id="chat-message"
                value={text}
                maxLength={6000}
                disabled={locked}
                placeholder="What did you eat? Or ask about a menu…"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
            </Field>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                <input
                  ref={camera}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={addPhotos}
                />
                <input
                  ref={gallery}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={addPhotos}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Take a photo"
                  disabled={locked || photos.length === 3}
                  onClick={() => camera.current?.click()}
                >
                  <Camera />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Attach photos"
                  disabled={locked || photos.length === 3}
                  onClick={() => gallery.current?.click()}
                >
                  <ImagePlus />
                </Button>
              </div>
              <Button
                type="submit"
                disabled={
                  sending || preparing || (!text.trim() && !photos.length)
                }
              >
                <Send />
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
            {preparing && (
              <p role="status" className="text-sm text-muted-foreground">
                Preparing photos…
              </p>
            )}
          </form>
        )}
      </PageContent>
    </div>
  );
}
