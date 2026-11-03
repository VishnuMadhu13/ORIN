import { ArrowLeft, Info, Phone, Pin, Search, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/store/auth";
import { useChat } from "@/store/chat";
import { useUi } from "@/store/ui";
import { conversationTitle, formatDay, formatLastSeen } from "@/utils/format";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { api } from "@/services/api";

export function ChatWindow() {
  const activeId = useChat((s) => s.activeId);
  const conversations = useChat((s) => s.conversations);
  const messages = useChat((s) => (activeId ? s.messages[activeId] : []) ?? []);
  const loading = useChat((s) => s.loadingMessages);
  const typingMap = useChat((s) => s.typing);
  const me = useAuth((s) => s.user);
  const setMobileChat = useUi((s) => s.setMobileChat);
  const toggleDetails = useUi((s) => s.toggleDetails);
  const pin = useChat((s) => s.pin);
  const loadMore = useChat((s) => s.loadMessages);
  const hasMore = useChat((s) => (activeId ? s.hasMore[activeId] : false));
  const editMessage = useChat((s) => s.editMessage);
  const deleteMessage = useChat((s) => s.deleteMessage);
  const react = useChat((s) => s.react);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ id: string; text: string; createdAt: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [callNote, setCallNote] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversation = conversations.find((c) => c.id === activeId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeId]);

  const grouped = useMemo(() => {
    const days: { day: string; items: typeof messages }[] = [];
    for (const m of messages) {
      const day = formatDay(m.createdAt);
      const last = days[days.length - 1];
      if (!last || last.day !== day) days.push({ day, items: [m] });
      else last.items.push(m);
    }
    return days;
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[rgb(var(--bg))]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Welcome to ORIN</h2>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">Select a conversation to start messaging.</p>
        </div>
      </div>
    );
  }

  const other = conversation.participants.find((p) => p.id !== me?.id);
  const title = conversationTitle(conversation.name, conversation.participants, me?.id);
  const typingUsers = (typingMap[conversation.id] ?? [])
    .map((id) => conversation.participants.find((p) => p.id === id)?.name)
    .filter(Boolean);

  async function runSearch(value: string) {
    setQuery(value);
    if (!activeId || value.trim().length < 2) {
      setHits([]);
      return;
    }
    const { data } = await api.get(`/messages/${activeId}/search`, { params: { q: value } });
    setHits(data.data.messages);
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-[rgb(var(--bg))]">
      <header className="flex items-center gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-3 py-3">
        <button className="rounded-lg p-2 md:hidden" onClick={() => setMobileChat(false)} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={toggleDetails}>
          <Avatar
            name={title}
            src={conversation.type === "group" ? conversation.avatar : other?.avatar}
            online={conversation.type === "direct" ? other?.status === "online" : undefined}
          />
          <div className="min-w-0">
            <div className="truncate font-medium">{title}</div>
            <div className="truncate text-xs text-[rgb(var(--muted))]">
              {typingUsers.length
                ? `${typingUsers.join(", ")} typing…`
                : conversation.type === "direct"
                  ? other?.status === "online"
                    ? "Online"
                    : formatLastSeen(other?.lastSeen)
                  : `${conversation.participants.length} members`}
            </div>
          </div>
        </button>
        <button className="rounded-lg p-2 hover:bg-[rgb(var(--bg-hover))]" onClick={() => setSearchOpen((s) => !s)} aria-label="Search in conversation">
          <Search size={18} />
        </button>
        <button
          className="rounded-lg p-2 hover:bg-[rgb(var(--bg-hover))]"
          onClick={() => setCallNote("Voice calling is a UI control. WebRTC media is not configured.")}
          aria-label="Voice call"
        >
          <Phone size={18} />
        </button>
        <button
          className="rounded-lg p-2 hover:bg-[rgb(var(--bg-hover))]"
          onClick={() => setCallNote("Video calling is a UI control. WebRTC media is not configured.")}
          aria-label="Video call"
        >
          <Video size={18} />
        </button>
        <button className="rounded-lg p-2 hover:bg-[rgb(var(--bg-hover))]" onClick={() => void pin(conversation.id)} aria-label="Pin">
          <Pin size={18} />
        </button>
        <button className="rounded-lg p-2 hover:bg-[rgb(var(--bg-hover))]" onClick={toggleDetails} aria-label="Details">
          <Info size={18} />
        </button>
      </header>
      {searchOpen && (
        <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] px-4 py-2">
          <input
            value={query}
            onChange={(e) => void runSearch(e.target.value)}
            placeholder="Search messages"
            className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm outline-none"
          />
          {hits.length > 0 && (
            <div className="orin-scroll mt-2 max-h-40 overflow-y-auto text-sm">
              {hits.map((h) => (
                <div key={h.id} className="border-t border-[rgb(var(--border))] py-2">
                  <p className="truncate">{h.text}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">{new Date(h.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {callNote && <div className="bg-[rgb(var(--accent)/0.12)] px-4 py-2 text-xs">{callNote}</div>}
      <div
        className="orin-scroll flex-1 overflow-y-auto py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop < 40 && hasMore && activeId) {
            const first = messages[0];
            if (first) void loadMore(activeId, first.id);
          }
        }}
      >
        {loading && <p className="px-4 text-sm text-[rgb(var(--muted))]">Loading messages…</p>}
        {grouped.map((g) => (
          <div key={g.day}>
            <div className="my-4 text-center text-[11px] text-[rgb(var(--muted))]">{g.day}</div>
            {g.items.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.senderId === me?.id || m.senderId === "me"}
                sender={conversation.participants.find((p) => p.id === m.senderId)}
                reply={messages.find((x) => x.id === m.replyTo)}
                onReply={() => setReplyTo(m.id)}
                onEdit={() => {
                  const next = window.prompt("Edit message", m.text);
                  if (next) void editMessage(m.id, next);
                }}
                onDelete={() => void deleteMessage(m.id)}
                onReact={(emoji) => void react(m.id, emoji)}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <Composer replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
    </section>
  );
}
