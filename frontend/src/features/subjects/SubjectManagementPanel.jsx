import React, { useEffect, useMemo, useState } from "react";
import { Globe2, RefreshCcw, Shield, Users } from "lucide-react";

import {
  deleteSubjectAccess,
  listSubjectAccess,
  listSubjectActivity,
  listSubjectSharingUsers,
  requestSubjectPublic,
  upsertSubjectAccess
} from "@/api";
import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

const ACCESS_LEVELS = ["reader", "maintainer", "owner"];

const roleLabel = (role) => role.charAt(0).toUpperCase() + role.slice(1);

const formatEventType = (event) => {
  const action = roleLabel(event.event_type || "event");
  const entity = String(event.entity_type || "item").replaceAll("_", " ");
  return `${action} ${entity}`;
};

const formatEventTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
};

export const reconcileSubjectAccessAfterGrant = (currentGrants, grant) => {
  const nextGrantByUserId = new Map(currentGrants.map((item) => [item.user_id, item]));
  if (grant.access_level === "owner") {
    for (const [userId, existingGrant] of nextGrantByUserId.entries()) {
      if (userId !== grant.user_id && existingGrant.access_level === "owner") {
        nextGrantByUserId.set(userId, {
          ...existingGrant,
          access_level: "maintainer"
        });
      }
    }
  }
  nextGrantByUserId.set(grant.user_id, grant);
  return Array.from(nextGrantByUserId.values());
};

export const reconcileSubjectAfterAccessGrant = (subject, grant, currentUser, isAdmin) => {
  if (!subject || grant.access_level !== "owner") {
    return subject;
  }
  return {
    ...subject,
    owner_user_id: grant.user_id,
    current_user_access_level:
      !isAdmin && subject.owner_user_id === currentUser?.id && grant.user_id !== currentUser?.id
        ? "maintainer"
        : subject.current_user_access_level
  };
};

export function SubjectManagementPanel({
  subject,
  currentUser,
  isAdmin,
  onSubjectUpdated,
  onClose
}) {
  const [users, setUsers] = useState([]);
  const [accessGrants, setAccessGrants] = useState([]);
  const [activity, setActivity] = useState([]);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantLevel, setGrantLevel] = useState("reader");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const grantedUserIds = useMemo(
    () => new Set(accessGrants.map((grant) => grant.user_id)),
    [accessGrants]
  );
  const availableGrantUsers = users.filter((user) => !grantedUserIds.has(user.id));
  const canTransferOwner = Boolean(isAdmin || subject?.owner_user_id === currentUser?.id);
  const grantLevels = canTransferOwner ? ACCESS_LEVELS : ACCESS_LEVELS.filter((level) => level !== "owner");
  const isPublic = subject?.visibility === "public";
  const publicRequested = subject?.visibility === "public_requested";

  const loadSubjectManagement = async () => {
    if (!subject?.id) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextUsers, nextGrants, nextActivity] = await Promise.all([
        listSubjectSharingUsers(subject.id),
        listSubjectAccess(subject.id),
        listSubjectActivity(subject.id)
      ]);
      setUsers(nextUsers);
      setAccessGrants(nextGrants);
      setActivity(nextActivity);
    } catch (loadError) {
      setError(loadError.message || "Failed to load Subject management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setGrantUserId("");
    setGrantLevel("reader");
    loadSubjectManagement();
  }, [subject?.id]);

  const handleRequestPublic = async () => {
    if (!subject?.id) {
      return;
    }
    setActionId("request-public");
    setError("");
    try {
      const updated = await requestSubjectPublic(subject.id);
      onSubjectUpdated?.(updated);
    } catch (requestError) {
      setError(requestError.message || "Failed to request public review");
    } finally {
      setActionId("");
    }
  };

  const handleGrantAccess = async () => {
    if (!subject?.id || !grantUserId) {
      return;
    }
    setActionId("grant");
    setError("");
    try {
      const grant = await upsertSubjectAccess(subject.id, grantUserId, grantLevel);
      setAccessGrants((current) => reconcileSubjectAccessAfterGrant(current, grant));
      onSubjectUpdated?.(reconcileSubjectAfterAccessGrant(subject, grant, currentUser, isAdmin));
      setGrantUserId("");
      setGrantLevel("reader");
    } catch (grantError) {
      setError(grantError.message || "Failed to grant Subject access");
    } finally {
      setActionId("");
    }
  };

  const handleGrantLevelChange = async (grant, accessLevel) => {
    if (!subject?.id) {
      return;
    }
    setActionId(`grant:${grant.user_id}`);
    setError("");
    try {
      const updated = await upsertSubjectAccess(subject.id, grant.user_id, accessLevel);
      setAccessGrants((current) => reconcileSubjectAccessAfterGrant(current, updated));
      onSubjectUpdated?.(reconcileSubjectAfterAccessGrant(subject, updated, currentUser, isAdmin));
    } catch (grantError) {
      setError(grantError.message || "Failed to update Subject access");
    } finally {
      setActionId("");
    }
  };

  const handleDeleteGrant = async (grant) => {
    if (!subject?.id) {
      return;
    }
    setActionId(`delete:${grant.user_id}`);
    setError("");
    try {
      await deleteSubjectAccess(subject.id, grant.user_id);
      setAccessGrants((current) => current.filter((item) => item.user_id !== grant.user_id));
    } catch (grantError) {
      setError(grantError.message || "Failed to revoke Subject access");
    } finally {
      setActionId("");
    }
  };

  if (!subject) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <Shield className="size-3" /> Subject management
            </Badge>
            <Badge variant="outline">{roleLabel(subject.current_user_access_level || "maintainer")}</Badge>
            <Badge variant="outline">{subject.visibility}</Badge>
          </div>
          <h2 className="text-2xl font-semibold tracking-normal">{subject.title}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Manage sharing, public review status, and recent create/delete activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={loadSubjectManagement} disabled={loading}>
            <RefreshCcw className="size-4" /> Refresh
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <ErrorAlert title="Subject management failed" message={error} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Public status</h3>
            <p className="text-sm text-muted-foreground">
              Owners and maintainers can request public review. Admin approval is still required.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleRequestPublic}
            disabled={isPublic || publicRequested || actionId === "request-public"}
          >
            <Globe2 className="size-4" />
            {isPublic ? "Public" : publicRequested ? "Review requested" : "Request public"}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Subject sharing</h3>
            <p className="text-sm text-muted-foreground">Grant reader or maintainer access by user.</p>
          </div>
          {loading ? <span className="text-sm text-muted-foreground">Loading...</span> : null}
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="subject-grant-user">User</label>
              <select
                id="subject-grant-user"
                className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm"
                value={grantUserId}
                onChange={(event) => setGrantUserId(event.target.value)}
              >
                <option value="">Select user</option>
                {availableGrantUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="subject-grant-level">Access</label>
              <select
                id="subject-grant-level"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={grantLevel}
                onChange={(event) => setGrantLevel(event.target.value)}
              >
                {grantLevels.map((level) => (
                  <option key={level} value={level}>
                    {roleLabel(level)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              onClick={handleGrantAccess}
              disabled={!grantUserId || actionId === "grant"}
            >
              <Users className="size-4" /> Grant access
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accessGrants.map((grant) => {
                const user = usersById.get(grant.user_id);
                const isCurrentOwnerGrant =
                  grant.user_id === subject.owner_user_id || grant.access_level === "owner";
                const editableLevels =
                  !isCurrentOwnerGrant && canTransferOwner
                    ? grantLevels
                    : isCurrentOwnerGrant
                      ? ["owner"]
                      : grantLevels.filter((level) => level !== "owner");
                return (
                  <TableRow key={grant.id}>
                    <TableCell>{user?.email || grant.user_id}</TableCell>
                    <TableCell>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={grant.access_level}
                        onChange={(event) => handleGrantLevelChange(grant, event.target.value)}
                        disabled={
                          actionId === `grant:${grant.user_id}` ||
                          isCurrentOwnerGrant
                        }
                      >
                        {editableLevels.map((level) => (
                          <option key={level} value={level}>
                            {roleLabel(level)}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteGrant(grant)}
                        disabled={
                          actionId === `delete:${grant.user_id}` ||
                          grant.access_level === "owner"
                        }
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!accessGrants.length ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No explicit grants for this Subject.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Activity</h3>
          <p className="text-sm text-muted-foreground">Recent create/delete events for this Subject.</p>
        </div>
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatEventTime(event.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{formatEventType(event)}</TableCell>
                  <TableCell className="max-w-xl whitespace-normal">
                    {event.entity_title || event.entity_id}
                  </TableCell>
                  <TableCell>{event.actor_email || event.actor_user_id || "System"}</TableCell>
                </TableRow>
              ))}
              {!activity.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No activity yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
