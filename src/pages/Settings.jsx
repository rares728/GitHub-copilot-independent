import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Trash2, Pencil, Check, X, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PicklistManager from '../components/documents/PicklistManager';
import UsersFileActions from '@/components/settings/UsersFileActions';

const PAGE_PERMISSION_KEYS = [
  { key: 'Dashboard', label: 'Dashboard' },
  { key: 'Issues', label: 'Issues' },
  { key: 'BatchMonitor', label: 'Production Monitor' },
  { key: 'Analytics', label: 'Analytics' },
  { key: 'Documents', label: 'Documents' },
  { key: 'Archive', label: 'Archive' },
  { key: 'ProductionMeeting', label: 'Production Meeting' },
  { key: 'Settings', label: 'Settings' },
  { key: 'VisualInspection', label: 'Visual Inspection AI' },
];

function parsePerms(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function Settings() {
  const [confirming, setConfirming] = useState(false);
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [expandedPermsId, setExpandedPermsId] = useState(null);
  const [invitingUserId, setInvitingUserId] = useState(null);
  const [inviteMessage, setInviteMessage] = useState('');

  const reloadUsers = () => apiClient.functions.invoke('getUsers', {}).then(res => setUsers(res.data?.full || [])).catch(() => {});

  useEffect(() => {
    apiClient.auth.me().then(u => setCurrentUser(u));
    reloadUsers();
  }, []);

  const startEdit = (user) => {
    setEditingUserId(user.id);
    setEditingName(user.display_name || user.full_name || '');
  };

  const cancelEdit = () => { setEditingUserId(null); setEditingName(''); };

  const togglePerm = async (user, pageKey) => {
    const perms = parsePerms(user.page_permissions) || {};
    // If no perms object yet, all pages are accessible by default — first toggle means restrict everything else
    const allGranted = !user.page_permissions;
    const base = allGranted
      ? Object.fromEntries(PAGE_PERMISSION_KEYS.map(p => [p.key, true]))
      : { ...perms };
    base[pageKey] = !base[pageKey];
    const newPermsStr = JSON.stringify(base);
    await apiClient.entities.User.update(user.id, { page_permissions: newPermsStr });
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, page_permissions: newPermsStr } : u));
  };

  const saveEdit = async (userId) => {
    setSavingId(userId);
    await apiClient.entities.User.update(userId, { display_name: editingName });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, display_name: editingName } : u));
    setEditingUserId(null);
    setSavingId(null);
  };

  const inviteUser = async (user) => {
    setInvitingUserId(user.id);
    setInviteMessage('');
    try {
      await apiClient.users.inviteUser(user.email, user.role);
      setInviteMessage(`Invitation sent to ${user.email}.`);
    } catch (error) {
      setInviteMessage(`Invitation failed: ${error.message}`);
    } finally {
      setInvitingUserId(null);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return (a.display_name || a.full_name || '').localeCompare(b.display_name || b.full_name || '');
  });

  const pagesFor = (u) => {
    let perms = null;
    try { perms = u.page_permissions ? JSON.parse(u.page_permissions) : null; } catch { }
    if (!perms) return 'All pages';
    return PAGE_PERMISSION_KEYS.filter(p => perms[p.key]).map(p => p.label).join(', ') || 'None';
  };

  const handleDeleteAccount = async () => {
    if (!confirming) { setConfirming(true); return; }
    try {
      const user = await apiClient.auth.me();
      if (user) await apiClient.entities.User.delete(user.id);
    } catch (_) {}
    apiClient.auth.logout();
  };

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-slate-700"
            onClick={() => apiClient.auth.logout()}
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>

          <Button
            variant="outline"
            className={`w-full justify-start gap-2 ${confirming ? 'border-red-400 text-red-600 bg-red-50' : 'text-red-500'}`}
            onClick={handleDeleteAccount}
          >
            <Trash2 className="w-4 h-4" />
            {confirming ? 'Tap again to confirm — you will be logged out' : 'Delete Account'}
          </Button>
          {confirming && (
            <p className="text-xs text-slate-400">
              This will log you out. Contact your admin to fully remove account data.
            </p>
          )}
        </CardContent>
      </Card>
      {currentUser?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700">User Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <UsersFileActions
              title="Users"
              headers={['Name', 'Email', 'Role', 'Pages']}
              rows={sortedUsers.map(u => [
                u.display_name || u.full_name || '',
                u.email || '',
                u.role || '',
                pagesFor(u),
              ])}
              existingEmails={sortedUsers.map(u => u.email)}
              onInvited={reloadUsers}
            />
            {users.length === 0 && <p className="text-xs text-slate-400">No users found.</p>}
            {inviteMessage && <p role="status" className="text-xs text-slate-600">{inviteMessage}</p>}
            {sortedUsers
              .map(user => (
              <div key={user.id}>
              <div className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                {editingUserId === user.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(user.id); if (e.key === 'Escape') cancelEdit(); }}
                    />
                    <button onClick={() => saveEdit(user.id)} disabled={!!savingId} className="text-green-600 hover:text-green-700 p-1">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{user.display_name || user.full_name || <span className="text-slate-400 italic">No name</span>}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                    <span className="text-xs text-slate-400 capitalize">{user.role}</span>
                    {!user.has_login && (
                      <button
                        onClick={() => inviteUser(user)}
                        disabled={invitingUserId === user.id}
                        title="Send account invitation"
                        className="text-slate-400 hover:text-blue-600 p-1 disabled:opacity-50"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => startEdit(user)} className="text-slate-400 hover:text-blue-600 p-1">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {(user.full_name || '').toLowerCase() !== 'rares728' && (
                      <button onClick={() => setExpandedPermsId(expandedPermsId === user.id ? null : user.id)} className="text-slate-400 hover:text-blue-600 p-1">
                        {expandedPermsId === user.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </>
                )}
              </div>
              {expandedPermsId === user.id && (user.full_name || '').toLowerCase() !== 'rares728' && (
                <div className="mt-1 mb-2 ml-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {PAGE_PERMISSION_KEYS.map(({ key, label }) => {
                    const perms = parsePerms(user.page_permissions);
                    const checked = perms ? !!perms[key] : true;
                    return (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerm(user, key)}
                          className="accent-blue-600 w-3.5 h-3.5"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <PicklistManager />
    </div>
  );
}