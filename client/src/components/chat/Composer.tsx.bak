import { Paperclip, Send, Smile } from "lucide-react";
import { useRef, useState } from "react";
import { getSocket } from "@/services/socket";
import { useChat } from "@/store/chat";
import { EmojiPicker } from "./EmojiPicker";

export function Composer({ replyTo, onCancelReply }: { replyTo: string | null; onCancelReply: () => void }) {
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const sendText = useChat((s) => s.sendText);
  const sendFile = useChat((s) => s.sendFile);
  const activeId = useChat((s) => s.activeId);
  const messages = useChat((s) => (activeId ? s.messages[activeId] : []) ?? []);
  const reply = messages.find((m) => m.id === replyTo);

  function emitTyping(on: boolean) {
    if (!activeId) return;
    getSocket()?.emit(on ? "typing:start" : "typing:stop", { conversationId: activeId });
  }

  async function submit() {
    const value = text.trim();
    if (!value) return;
    setText("");
    emitTyping(false);
    await sendText(value, replyTo);
    onCancelReply();
  }

  return (
    <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] p-3">
      {reply && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-[rgb(var(--bg-hover))] px-3 py-2 text-xs">
          <span>Replying to: {reply.text || "attachment"}</span>
          <button onClick={onCancelReply}>✕</button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="relative">
          <button className="rounded-xl p-2 hover:bg-[rgb(var(--bg-hover))]" onClick={() => setAttachOpen((s) => !s)} aria-label="Attach">
            <Paperclip size={18} />
          </button>
          {attachOpen && (
            <div className="absolute bottom-11 left-0 w-40 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-1 shadow-panel">
              <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[rgb(var(--bg-hover))]" onClick={() => imageRef.current?.click()}>
                Photo
              </button>
              <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[rgb(var(--bg-hover))]" onClick={() => fileRef.current?.click()}>
                File
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button className="rounded-xl p-2 hover:bg-[rgb(var(--bg-hover))]" onClick={() => setEmoji((s) => !s)} aria-label="Emoji">
            <Smile size={18} />
          </button>
          {emoji && (
            <div className="absolute bottom-11 left-0 z-20">
              <EmojiPicker
                onPick={(e) => {
                  setText((t) => t + e);
                  setEmoji(false);
                }}
              />
            </div>
          )}
        </div>
        <textarea
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            emitTyping(true);
          }}
          onBlur={() => emitTyping(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Write a message"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm outline-none"
        />
        <button
          onClick={() => void submit()}
          className="rounded-xl bg-[rgb(var(--accent))] p-3 text-white disabled:opacity-40"
          disabled={!text.trim()}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void sendFile(e.target.files[0], replyTo)} />
      <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && void sendFile(e.target.files[0], replyTo)} />
    </div>
  );
}
