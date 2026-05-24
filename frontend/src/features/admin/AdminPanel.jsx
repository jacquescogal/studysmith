import React, { useEffect, useMemo, useState } from "react";
import { Check, RefreshCcw, Shield, X } from "lucide-react";

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
import {
  approvePublicSubject,
  deleteSubjectAccess,
  keepSubjectPrivate,
  listAdminUsers,
  listPublicSubjectRequests,
  listSubjectAccess,
  updateAdminUserRole,
  upsertSubjectAccess
} from "@/api";

const APP_ROLES = ["reader", "creator", "admin"];
const ACCESS_LEVELS = ["reader", "maintainer", "owner"];

const roleLabel = (role) => role.charAt(0).toUpperCase() + role.slice(1);

export function AdminPanel({ subjects, selectedSubjectId, onSubjectUpdated, onClose }) {
  const [users, setUsers] = useState([]);
  const [publicRequests, setPublicRequests] = useState([]);
  const [accessGrants, setAccessGrants] = useState([]);
  const [subjectId, setSubjectId] = useState(selectedSubjectId || "");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantLevel, setGrantLevel] = useState("reader");
  const [loading, setLoading] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");

  const subjectOptions = useMemo(
    () => subjects.filter((subject) => subject.id),
    [subjects]
  );
  const selectedSubject = subjectOptions.find((subject) => subject.id === subjectId);
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  );
  const grantedUserIds = useMemo(
    () => new Set(accessGrants.map((grant) => grant.user_id)),
    [accessGrants]
  );
  const availableGrantUsers = users.filter((user) => !grantedUserIds.has(user.id));

  useEffect(() => {
    if (subjectId || !subjectOptions.length) {
      return;
    }
    setSubjectId(subjectOptions[0].id);
  }, [subjectId, subjectOptions]);

  const loadAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextUsers, nextRequests] = await Promise.all([
        listAdminUsers(),
        listPublicSubjectRequests()
      ]);
      setUsers(nextUsers);
      setPublicRequests(nextRequests);
    } catch (loadError) {
      setError(loadError.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const loadAccessGrants = async (nextSubjectId = subjectId) => {
    if (!nextSubjectId) {
      setAccessGrants([]);
      return;
    }
    setAccessLoading(true);
    setError("");
    try {
      setAccessGrants(await listSubjectAccess(nextSubjectId));
    } catch (loadError) {
      setAccessGrants([]);
      setError(loadError.message || "Failed to load Subject access grants");
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    loadAccessGrants(subjectId);
  }, [subjectId]);

  const handleRoleChange = async (userId, appRole) => {
    setActionId(`role:${userId}`);
    setError("");
    try {
      const updated = await updateAdminUserRole(userId, appRole);
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
    } catch (roleError) {
      setError(roleError.message || "Failed to update user role");
    } finally {
      setActionId("");
    }
  };

  const handleApprovePublic = async (subject) => {
    setActionId(`approve:${subject.id}`);
    setError("");
    try {
      const updated = await approvePublicSubject(subject.id);
      setPublicRequests((current) => current.filter((item) => item.id !== subject.id));
      onSubjectUpdated?.(updated);
    } catch (requestError) {
      setError(requestError.message || "Failed to approve public Subject");
    } finally {
      setActionId("");
    }
  };

  const handleKeepPrivate = async (subject) => {
    setActionId(`private:${subject.id}`);
    setError("");
    try {
      const updated = await keepSubjectPrivate(subject.id);
      setPublicRequests((current) => current.filter((item) => item.id !== subject.id));
      onSubjectUpdated?.(updated);
    } catch (requestError) {
      setError(requestError.message || "Failed to keep Subject private");
    } finally {
      setActionId("");
    }
  };

  const handleGrantAccess = async () => {
    if (!subjectId || !grantUserId) {
      return;
    }
    setActionId("grant");
    setError("");
    try {
      const grant = await upsertSubjectAccess(subjectId, grantUserId, grantLevel);
      setAccessGrants((current) => [
        ...current.filter((item) => item.user_id !== grant.user_id),
        grant
      ]);
      setGrantUserId("");
      setGrantLevel("reader");
    } catch (grantError) {
      setError(grantError.message || "Failed to grant Subject access");
    } finally {
      setActionId("");
    }
  };

  const handleGrantLevelChange = async (grant, accessLevel) => {
    setActionId(`grant:${grant.user_id}`);
    setError("");
    try {
      const updated = await upsertSubjectAccess(subjectId, grant.user_id, accessLevel);
      setAccessGrants((current) =>
        current.map((item) => (item.user_id === updated.user_id ? updated : item))
      );
    } catch (grantError) {
      setError(grantError.message || "Failed to update Subject access");
    } finally {
      setActionId("");
    }
  };

  const handleDeleteGrant = async (grant) => {
    setActionId(`delete:${grant.user_id}`);
    setError("");
    try {
      await deleteSubjectAccess(subjectId, grant.user_id);
      setAccessGrants((current) => current.filter((item) => item.user_id !== grant.user_id));
    } catch (grantError) {
      setError(grantError.message || "Failed to revoke Subject access");
    } finally {
      setActionId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <Shield className="size-3" /> Admin
            </Badge>
            <Badge variant="outline">{users.length} users</Badge>
            <Badge variant="outline">{publicRequests.length} public requests</Badge>
          </div>
          <h2 className="text-2xl font-semibold tracking-normal">Admin controls</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Manage user roles, public Subject requests, and Subject-level sharing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={loadAdminData} disabled={loading}>
            <RefreshCcw className="size-4" /> Refresh
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <ErrorAlert title="Admin action failed" message={error} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">User roles</h3>
            <p className="text-sm text-muted-foreground">Grant creator or admin capabilities.</p>
          </div>
          {loading ? <span className="text-sm text-muted-foreground">Loading...</span> : null}
        </div>
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={user.app_role}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                      disabled={actionId === `role:${user.id}`}
                    >
                      {APP_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                </TableRow>
              ))}
              {!users.length ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    No users yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Public Subject requests</h3>
          <p className="text-sm text-muted-foreground">Approve creator requests before a Subject becomes public.</p>
        </div>
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publicRequests.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.title}</TableCell>
                  <TableCell className="max-w-xl whitespace-normal text-muted-foreground">
                    {subject.goal || subject.scope || subject.description || "No description"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleApprovePublic(subject)}
                        disabled={actionId === `approve:${subject.id}`}
                      >
                        <Check className="size-4" /> Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleKeepPrivate(subject)}
                        disabled={actionId === `private:${subject.id}`}
                      >
                        <X className="size-4" /> Keep private
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!publicRequests.length ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No pending public requests.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Subject sharing</h3>
            <p className="text-sm text-muted-foreground">Grant reader, maintainer, or owner access by Subject.</p>
          </div>
          <select
            className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="">Select Subject</option>
            {subjectOptions.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.title}
              </option>
            ))}
          </select>
        </div>

        {selectedSubject ? (
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{selectedSubject.visibility}</Badge>
              <span className="text-sm font-medium">{selectedSubject.title}</span>
              {accessLoading ? <span className="text-sm text-muted-foreground">Loading access...</span> : null}
            </div>
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="grant-user">User</label>
                <select
                  id="grant-user"
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
                <label className="text-sm font-medium" htmlFor="grant-level">Access</label>
                <select
                  id="grant-level"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={grantLevel}
                  onChange={(event) => setGrantLevel(event.target.value)}
                >
                  {ACCESS_LEVELS.map((level) => (
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
                Grant access
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
                  return (
                    <TableRow key={grant.id}>
                      <TableCell>{user?.email || grant.user_id}</TableCell>
                      <TableCell>
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={grant.access_level}
                          onChange={(event) => handleGrantLevelChange(grant, event.target.value)}
                          disabled={actionId === `grant:${grant.user_id}`}
                        >
                          {ACCESS_LEVELS.map((level) => (
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
                          disabled={actionId === `delete:${grant.user_id}`}
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
        ) : (
          <div className="rounded-lg border border-dashed bg-white p-6 text-sm text-muted-foreground">
            Select a Subject to manage sharing.
          </div>
        )}
      </section>
    </div>
  );
}
