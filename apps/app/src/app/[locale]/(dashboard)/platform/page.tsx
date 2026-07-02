"use client";

import { ConfirmButton } from "@/components/confirm-button";
import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useAction, useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-primary">{title}</h2>
        {action}
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}
function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <span className="truncate font-mono text-primary/80">{left}</span>
      <span className="shrink-0 text-primary/60">{right}</span>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4 text-sm text-primary/40">{children}</div>;
}

const isOffline = process.env.NODE_ENV === "development";

export default function PlatformPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const { workspaces, current, select } = useWorkspace();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Local state for offline mode
  const [localMembers, setLocalMembers] = useState<any[]>([]);
  const [localKeys, setLocalKeys] = useState<any[]>([]);
  const [localAudits, setLocalAudits] = useState<any[]>([]);

  // Convex queries (skipped in offline mode)
  const scoped = !isOffline && current ? { workspaceId: current } : "skip";
  const createWorkspaceMut = useMutation(api.orgs.createWorkspace);
  const createKeyAction = useAction(api.apiKeys.create);
  const revokeKeyMut = useMutation(api.apiKeys.revoke);
  const sendInviteMut = useMutation(api.orgs.invite);
  const acceptInviteMut = useMutation(api.orgs.acceptInvite);
  const removeMemberMut = useMutation(api.orgs.removeMember);
  const changeRoleMut = useMutation(api.orgs.changeRole);

  const dbMembers = useQuery(api.orgs.members, scoped);
  const dbKeys = useQuery(api.apiKeys.listMine, scoped);
  const dbUsage = useQuery(api.usage.mine, scoped);
  const dbAudit = useQuery(api.audit.recent, scoped);
  const dbEvents = useQuery(api.backend.listEvents, scoped);
  const dbPending = useQuery(api.orgs.pendingInvites, scoped);
  const dbMyInvites = useQuery(!isOffline ? api.orgs.myInvites : "skip" as any);

  const members = isOffline ? localMembers : (dbMembers || []);
  const keys = isOffline ? localKeys : (dbKeys || []);
  const usage = isOffline ? [] : (dbUsage || []);
  const audit = isOffline ? localAudits : (dbAudit || []);
  const events = isOffline ? [] : (dbEvents || []);
  const pending = isOffline ? [] : (dbPending || []);
  const myInvites = isOffline ? [] : (dbMyInvites || []);

  const myRole = workspaces.find((w) => w._id === current)?.role || "admin";
  const canManage = myRole === "owner" || myRole === "admin" || isOffline;

  // Load local data in offline mode
  const fetchLocalData = async () => {
    if (!isOffline) return;
    const base = `/${locale}/api/platform`;
    const [mRes, kRes, aRes] = await Promise.all([
      fetch(`${base}?action=getMembers`).then((r) => r.json()).catch(() => ({ members: [] })),
      fetch(`${base}?action=getKeys`).then((r) => r.json()).catch(() => ({ keys: [] })),
      fetch(`${base}?action=getAudits`).then((r) => r.json()).catch(() => ({ audits: [] })),
    ]);
    setLocalMembers(mRes.members || []);
    setLocalKeys(kRes.keys || []);
    setLocalAudits(aRes.audits || []);
  };

  useEffect(() => {
    if (isOffline) {
      fetchLocalData();
    }
  }, []);

  if (!current && !isOffline) {
    return (
      <div className="p-8 text-sm text-primary/60">Setting up your workspace…</div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      if (isOffline) {
        const res = await fetch(`/${locale}/api/platform`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "inviteMember", email: inviteEmail, role: inviteRole }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to invite member");
        } else {
          toast.success(`Invitation sent to ${inviteEmail}`);
          setInviteEmail("");
          await fetchLocalData();
        }
      } else {
        await sendInviteMut({
          workspaceId: current!,
          email: inviteEmail,
          role: inviteRole,
        });
        setInviteEmail("");
        toast.success("Invitation sent");
      }
    } catch (err) {
      toast.error("Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCreateKey = async () => {
    const name = window.prompt("Key name") || "key";
    if (!name) return;
    try {
      if (isOffline) {
        const res = await fetch(`/${locale}/api/platform`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "createKey", name }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to create API key");
        } else {
          setNewKey(data.apiKey.key);
          toast.success("API key created — copy it now, it won't be shown again");
          await fetchLocalData();
        }
      } else {
        const r = await createKeyAction({ workspaceId: current!, name });
        setNewKey(r.key);
        toast.success("API key created");
      }
    } catch (err) {
      toast.error("Failed to create API key");
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      if (isOffline) {
        const res = await fetch(`/${locale}/api/platform`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteKey", id }),
        });
        if (!res.ok) { toast.error("Failed to revoke key"); return; }
        toast.success("Key revoked");
        if (newKey) setNewKey(null);
        await fetchLocalData();
      } else {
        await revokeKeyMut({ id: id as Id<"apiKeys"> });
        toast.success("Key revoked");
      }
    } catch {
      toast.error("Failed to revoke key");
    }
  };

  const handleRemoveMember = async (id: string) => {
    try {
      if (isOffline) {
        const res = await fetch(`/${locale}/api/platform`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteMember", id }),
        });
        if (!res.ok) { toast.error("Failed to remove member"); return; }
        toast.success("Member removed");
        await fetchLocalData();
      } else {
        await removeMemberMut({ workspaceId: current!, memberId: id as Id<"members"> });
        toast.success("Member removed");
      }
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const handleCreateWorkspace = async () => {
    const name = window.prompt("New workspace name");
    if (!name) return;
    if (isOffline) {
      toast.success(`Workspace "${name}" created locally`);
      return;
    }
    select(await createWorkspaceMut({ name }));
    toast.success("Workspace created");
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-primary">Platform</h1>
            <p className="text-sm text-primary/60">
              Multi-tenant: members, invites, usage, API keys, audit &amp; events —
              scoped to the selected workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isOffline && (
              <select
                value={current ?? ""}
                onChange={(e) => select(e.target.value as Id<"workspaces">)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                {workspaces.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name} ({w.role})
                  </option>
                ))}
              </select>
            )}
            {isOffline && (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                Development Workspace (admin)
              </div>
            )}
            <Button
              variant="outline"
              onClick={handleCreateWorkspace}
            >
              + Workspace
            </Button>
          </div>
        </div>

        {myInvites.length > 0 && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <p className="mb-2 text-sm font-medium text-primary">
              You have pending invites
            </p>
            {myInvites.map((inv: any) => (
              <div
                key={inv._id}
                className="flex items-center justify-between py-1 text-sm"
              >
                <span className="text-primary/80">
                  {inv.workspaceName ?? "workspace"} · {inv.role}
                </span>
                <Button size="sm" onClick={() => acceptInviteMut({ inviteId: inv._id })}>
                  Accept
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card
            title="Members"
            action={
              <form
                className="flex items-center gap-1"
                onSubmit={handleInvite}
              >
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email to invite"
                  type="email"
                  className="w-40 rounded-md border border-border bg-background px-2 py-1 text-xs"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-md border border-border bg-background px-1 py-1 text-xs"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <Button size="sm" variant="outline" type="submit" disabled={inviteLoading}>
                  {inviteLoading ? "Inviting…" : "Invite"}
                </Button>
              </form>
            }
          >
            {members.length ? (
              members.map((m: any) => (
                <Row
                  key={m._id}
                  left={m.name ?? m.email ?? "—"}
                  right={
                    canManage && m.role !== "owner" ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-blue-600/20 bg-blue-500/10 text-blue-600">
                          {m.role}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-red-500 hover:underline"
                          onClick={() => handleRemoveMember(m._id)}
                        >
                          remove
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-green-600/20 bg-green-500/10 text-green-600">
                        {m.role}
                      </span>
                    )
                  }
                />
              ))
            ) : (
              <Empty>No members — invite someone above</Empty>
            )}
            {pending.map((inv: any) => (
              <Row
                key={inv._id}
                left={`⏳ ${inv.email}`}
                right={`invited · ${inv.role}`}
              />
            ))}
          </Card>

          <Card title="Usage">
            {usage.length ? (
              usage.map((u: any) => (
                <Row key={u._id} left={u.metric} right={String(u.count)} />
              ))
            ) : (
              <Empty>No usage yet</Empty>
            )}
          </Card>

          <Card
            title="API keys"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateKey}
              >
                + Create
              </Button>
            }
          >
            {newKey && (
              <div className="m-3 break-all rounded bg-green-500/10 p-2 font-mono text-xs text-green-700 border border-green-500/30">
                <p className="font-semibold mb-1">🔑 Copy your key now (shown once):</p>
                {newKey}
              </div>
            )}
            {keys.length ? (
              keys.map((k: any) => (
                <Row
                  key={k._id}
                  left={`${k.name} · ${k.prefix ?? k.key?.substring(0, 8)}…`}
                  right={
                    k.revoked ? (
                      "revoked"
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => handleRevokeKey(k._id)}
                      >
                        revoke
                      </button>
                    )
                  }
                />
              ))
            ) : (
              <Empty>No keys — create one above</Empty>
            )}
          </Card>

          <Card title="Audit log">
            {audit.length ? (
              audit.map((a: any) => (
                <Row
                  key={a._id}
                  left={a.action}
                  right={new Date(a.at).toLocaleTimeString()}
                />
              ))
            ) : (
              <Empty>No activity</Empty>
            )}
          </Card>

          <Card title="Events (from backend)">
            {events.length ? (
              events.map((ev: any) => (
                <Row
                  key={ev._id}
                  left={ev.type}
                  right={new Date(ev.receivedAt).toLocaleTimeString()}
                />
              ))
            ) : (
              <Empty>No events yet</Empty>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
