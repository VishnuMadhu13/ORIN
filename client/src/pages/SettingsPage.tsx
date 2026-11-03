import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, PasswordInput, TextInput } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { api, getErrorMessage } from "@/services/api";
import { useAuth } from "@/store/auth";
import { useUi } from "@/store/ui";
import type { User } from "@/types";

export function SettingsPage() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState<User[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    void api.get("/users/blocked").then(({ data }) => setBlocked(data.data.users));
  }, []);

  if (!user) return null;

  async function saveProfile() {
    try {
      const { data } = await api.patch("/users/me", { name, username, bio });
      setUser(data.data.user);
      setMessage("Profile updated");
    } catch (err) {
      setMessage(getErrorMessage(err));
    }
  }

  async function uploadAvatar(file: File) {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/users/me/avatar", form);
    setUser(data.data.user);
  }

  async function savePrefs() {
    if (!user) return;
    const { data } = await api.patch("/settings", {
      privacy: user.privacy,
      notifications: user.notifications,
    });
    setUser(data.data.user);
    setMessage("Preferences saved");
  }

  return (
    <section className="orin-scroll h-full flex-1 overflow-y-auto bg-[rgb(var(--bg))] p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-[rgb(var(--muted))]">Manage your ORIN identity and privacy.</p>
        </header>
        {message && <p className="rounded-xl bg-[rgb(var(--accent)/0.12)] px-3 py-2 text-sm">{message}</p>}

        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] p-5">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} src={user.avatar} size="lg" />
            <label className="cursor-pointer text-sm text-[rgb(var(--accent))]">
              Change photo
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void uploadAvatar(e.target.files[0])} />
            </label>
          </div>
          <div className="mt-4 grid gap-3">
            <Field label="Display name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Username">
              <TextInput value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="Bio">
              <TextInput value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>
            <Button onClick={() => void saveProfile()}>Save profile</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] p-5">
          <h2 className="font-semibold">Appearance</h2>
          <div className="mt-3 flex gap-2">
            <Button variant={theme === "dark" ? "primary" : "muted"} onClick={() => setTheme("dark")}>
              Dark
            </Button>
            <Button variant={theme === "light" ? "primary" : "muted"} onClick={() => setTheme("light")}>
              Light
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] p-5 space-y-3">
          <h2 className="font-semibold">Notifications</h2>
          <Toggle
            label="In-app notifications"
            checked={user.notifications?.inApp !== false}
            onChange={(v) => setUser({ ...user, notifications: { ...user.notifications!, inApp: v } })}
          />
          <Toggle
            label="Message sounds"
            checked={user.notifications?.messageSound !== false}
            onChange={(v) => setUser({ ...user, notifications: { ...user.notifications!, messageSound: v } })}
          />
          <Toggle
            label="Desktop notifications"
            checked={Boolean(user.notifications?.desktop)}
            onChange={async (v) => {
              if (v && Notification.permission === "default") await Notification.requestPermission();
              setUser({ ...user, notifications: { ...user.notifications!, desktop: v && Notification.permission === "granted" } });
            }}
          />
          <Button onClick={() => void savePrefs()}>Save notification preferences</Button>
        </div>

        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] p-5 space-y-3">
          <h2 className="font-semibold">Privacy</h2>
          <Select
            label="Last seen"
            value={user.privacy?.lastSeen ?? "everyone"}
            onChange={(v) => setUser({ ...user, privacy: { ...user.privacy!, lastSeen: v } })}
          />
          <Select
            label="Profile photo"
            value={user.privacy?.profilePhoto ?? "everyone"}
            onChange={(v) => setUser({ ...user, privacy: { ...user.privacy!, profilePhoto: v } })}
          />
          <Toggle
            label="Read receipts"
            checked={user.privacy?.readReceipts !== false}
            onChange={(v) => setUser({ ...user, privacy: { ...user.privacy!, readReceipts: v } })}
          />
          <Button onClick={() => void savePrefs()}>Save privacy</Button>
        </div>

        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] p-5">
          <h2 className="font-semibold">Blocked users</h2>
          {blocked.length === 0 && <p className="mt-2 text-sm text-[rgb(var(--muted))]">You have not blocked anyone.</p>}
          {blocked.map((u) => (
            <div key={u.id} className="mt-2 flex items-center justify-between">
              <span>{u.name}</span>
              <Button
                variant="muted"
                onClick={async () => {
                  await api.delete(`/users/${u.id}/block`);
                  setBlocked((b) => b.filter((x) => x.id !== u.id));
                }}
              >
                Unblock
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-panel))] p-5 space-y-3">
          <h2 className="font-semibold">Change password</h2>
          <PasswordInput placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <PasswordInput placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordInput placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <Button
            onClick={async () => {
              try {
                await api.post("/settings/password", { currentPassword, password, confirmPassword });
                setMessage("Password updated");
              } catch (err) {
                setMessage(getErrorMessage(err));
              }
            }}
          >
            Update password
          </Button>
        </div>

        <div className="flex gap-3">
          <Button variant="muted" onClick={() => void logout()}>
            Logout
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!window.confirm("Delete your ORIN account permanently?")) return;
              await api.delete("/settings/account");
              await logout();
            }}
          >
            Delete account
          </Button>
        </div>
      </div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "everyone" | "contacts" | "nobody";
  onChange: (v: "everyone" | "contacts" | "nobody") => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[rgb(var(--muted))]">{label}</span>
      <select
        className="mt-1 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value as "everyone" | "contacts" | "nobody")}
      >
        <option value="everyone">Everyone</option>
        <option value="contacts">Contacts</option>
        <option value="nobody">Nobody</option>
      </select>
    </label>
  );
}
