import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { api } from "@/services/api";
import { useAuth } from "@/store/auth";
import { useChat } from "@/store/chat";
import { useUi } from "@/store/ui";
import { conversationTitle } from "@/utils/format";

export function DetailsPanel() {
  const open = useUi((s) => s.detailsOpen);
  const setDetails = useUi((s) => s.setDetails);
  const conversation = useChat((s) => s.conversations.find((c) => c.id === s.activeId));
  const messages = useChat((s) => (s.activeId ? s.messages[s.activeId] : []) ?? []);
  const me = useAuth((s) => s.user);
  const archive = useChat((s) => s.archive);
  const [name, setName] = useState(conversation?.name ?? "");

  if (!open || !conversation) return null;
  const title = conversationTitle(conversation.name, conversation.participants, me?.id);
  const otherId = conversation.participants.find((p) => p.id !== me?.id)?.id;
  const media = messages.filter((m) => m.type === "image" && m.attachment);
  const files = messages.filter((m) => m.type === "file" && m.attachment);
  const isAdmin = conversation.admins.includes(me?.id ?? "");

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col border-l border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] xl:flex">
      <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-4">
        <h2 className="font-semibold">Details</h2>
        <button onClick={() => setDetails(false)}>✕</button>
      </div>
      <div className="orin-scroll flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center text-center">
          <Avatar name={title} src={conversation.avatar ?? conversation.participants.find((p) => p.id !== me?.id)?.avatar} size="lg" />
          <h3 className="mt-3 font-semibold">{title}</h3>
          <p className="text-sm text-[rgb(var(--muted))]">{conversation.type === "group" ? conversation.description : "Direct conversation"}</p>
        </div>
        {conversation.type === "group" && isAdmin && (
          <form
            className="mt-4 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData();
              form.append("name", name || title);
              await api.patch(`/conversations/${conversation.id}`, form);
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
            <Button className="w-full">Save group name</Button>
          </form>
        )}
        <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">Members</h4>
        <ul className="mt-2 space-y-2">
          {conversation.participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar name={p.name} src={p.avatar} size="sm" online={p.status === "online"} />
                <div>
                  <div className="text-sm">{p.name}</div>
                  <div className="text-xs text-[rgb(var(--muted))]">@{p.username}</div>
                </div>
              </div>
              {conversation.type === "group" && isAdmin && p.id !== me?.id && (
                <button
                  className="text-xs text-[rgb(var(--danger))]"
                  onClick={() => void api.delete(`/conversations/${conversation.id}/members/${p.id}`)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {conversation.type === "group" && (
          <Button
            variant="muted"
            className="mt-4 w-full"
            onClick={() => me && void api.delete(`/conversations/${conversation.id}/members/${me.id}`)}
          >
            Leave group
          </Button>
        )}
        <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">Shared media</h4>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {media.length === 0 && <p className="col-span-3 text-xs text-[rgb(var(--muted))]">No media yet</p>}
          {media.map((m) => (
            <a key={m.id} href={m.attachment?.url} target="_blank" rel="noreferrer">
              <img src={m.attachment?.url} alt="" className="h-20 w-full rounded-lg object-cover" />
            </a>
          ))}
        </div>
        <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">Files</h4>
        <ul className="mt-2 space-y-1 text-sm">
          {files.length === 0 && <li className="text-xs text-[rgb(var(--muted))]">No files yet</li>}
          {files.map((m) => (
            <li key={m.id}>
              <a className="underline" href={m.attachment?.url} target="_blank" rel="noreferrer">
                {m.attachment?.filename}
              </a>
            </li>
          ))}
        </ul>
        {conversation.type === "direct" && otherId && (
          <Button
            variant="danger"
            className="mt-6 w-full"
            onClick={() => void api.post(`/users/${otherId}/block`)}
          >
            Block user
          </Button>
        )}
        <Button variant="muted" className="mt-6 w-full" onClick={() => void archive(conversation.id)}>
          {conversation.archived ? "Unarchive" : "Archive conversation"}
        </Button>
      </div>
    </aside>
  );
}
