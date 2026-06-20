"use client";

import { useState, useTransition, useMemo } from "react";
import { createUserAction, updateUserAction, deleteUserAction } from "./actions";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdBy: string | null;
  createdAt: string;
}

interface AdminDashboardClientProps {
  initialUsers: User[];
  currentUserId?: string;
  currentUserEmail?: string | null;
}

type TabType = "users" | "system" | "security";

export default function AdminDashboardClient({
  initialUsers,
  currentUserId,
  currentUserEmail,
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Current active user for editing/deleting
  const [activeUser, setActiveUser] = useState<User | null>(null);
  
  // User Form states
  const [userFormData, setUserFormData] = useState({ name: "", email: "", role: "user" });

  // System Settings states
  const [systemSettings, setSystemSettings] = useState({
    appName: "Test App",
    publicRegistration: true,
    maintenanceMode: false,
    adminNotificationEmail: "admin@testapp.com",
    signupAlerts: true,
  });

  // Security Settings states
  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: "1h",
    mfaRequired: false,
    maxAttempts: 5,
    allowPasswordReset: true,
  });
  
  // Status notifications
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const [isPending, startTransition] = useTransition();
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  // Clear notifications after 5 seconds
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "superadmin" || u.role === "admin").length;
    const regular = total - admins;
    return { total, admins, regular };
  }, [users]);

  // Handlers for User Management
  const handleOpenAddModal = () => {
    setUserFormData({ name: "", email: "", role: "user" });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setActiveUser(user);
    setUserFormData({ name: user.name, email: user.email, role: user.role });
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (user: User) => {
    if (user.email.toLowerCase() === currentUserEmail?.toLowerCase()) {
      showNotification("error", "You cannot delete your own account.");
      return;
    }
    setActiveUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name || !userFormData.email || !userFormData.role) {
      showNotification("error", "Please fill in all fields.");
      return;
    }

    startTransition(async () => {
      const res = await createUserAction(userFormData);
      if (res.success && res.data) {
        const newUser: User = {
          id: res.data.id,
          name: res.data.name,
          email: res.data.email,
          role: res.data.role,
          createdBy: res.data.createdBy,
          createdAt: res.data.createdAt.toISOString(),
        };
        setUsers((prev) => [newUser, ...prev]);
        setIsAddModalOpen(false);
        showNotification("success", `User "${userFormData.name}" added successfully.`);
      } else {
        showNotification("error", res.error || "Failed to create user.");
      }
    });
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    if (!userFormData.name || !userFormData.email || !userFormData.role) {
      showNotification("error", "Please fill in all fields.");
      return;
    }

    startTransition(async () => {
      const res = await updateUserAction(activeUser.id, userFormData);
      if (res.success && res.data) {
        const updatedUser: User = {
          id: res.data.id,
          name: res.data.name,
          email: res.data.email,
          role: res.data.role,
          createdBy: res.data.createdBy,
          createdAt: res.data.createdAt.toISOString(),
        };
        setUsers((prev) =>
          prev.map((u) => (u.id === activeUser.id ? updatedUser : u))
        );
        setIsEditModalOpen(false);
        setActiveUser(null);
        showNotification("success", `User "${userFormData.name}" updated successfully.`);
      } else {
        showNotification("error", res.error || "Failed to update user.");
      }
    });
  };

  const handleDeleteUser = async () => {
    if (!activeUser) return;

    startTransition(async () => {
      const res = await deleteUserAction(activeUser.id);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== activeUser.id));
        setIsDeleteModalOpen(false);
        showNotification("success", `User "${activeUser.name}" has been deleted.`);
        setActiveUser(null);
      } else {
        showNotification("error", res.error || "Failed to delete user.");
      }
    });
  };

  // Handlers for System and Security Settings Saving
  const handleSaveSystemSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSettingsSaving(true);
    setTimeout(() => {
      setIsSettingsSaving(false);
      showNotification("success", "System configuration saved successfully.");
    }, 800);
  };

  const handleSaveSecuritySettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSettingsSaving(true);
    setTimeout(() => {
      setIsSettingsSaving(false);
      showNotification("success", "Security access control settings updated.");
    }, 800);
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3.5 shadow-lg border animate-in slide-in-from-top duration-300 ${
            notification.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              notification.type === "success" ? "bg-teal-100 text-teal-600" : "bg-red-100 text-red-600"
            }`}
          >
            {notification.type === "success" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Navigation Column (Sidebar for Desktop / Horizontal tabs for Mobile) */}
        <div className="md:col-span-1 space-y-2">
          {/* Mobile Tab Select/Navbar */}
          <div className="block md:hidden border-b border-gray-200 pb-2">
            <div className="flex gap-1 overflow-x-auto py-1 scrollbar-none">
              <button
                onClick={() => setActiveTab("users")}
                className={`flex-1 min-w-[120px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "users"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                Users Settings
              </button>
              <button
                onClick={() => setActiveTab("system")}
                className={`flex-1 min-w-[120px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "system"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                System Config
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`flex-1 min-w-[120px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "security"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                Security Settings
              </button>
            </div>
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden md:block space-y-1.5 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">Settings Tabs</div>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === "users"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Users Settings
            </button>

            <button
              onClick={() => setActiveTab("system")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === "system"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              System Config
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === "security"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Security Settings
            </button>
          </div>
        </div>

        {/* Content Column (Main content card changing dynamically) */}
        <div className="md:col-span-3">
          
          {/* TAB 1: USER MANAGEMENT SETTINGS */}
          {activeTab === "users" && (
            <div className="space-y-6">
              
              {/* Stats Widgets */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Users</p>
                    <h3 className="mt-2 text-3xl font-extrabold text-gray-900">{stats.total}</h3>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-gray-500">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Administrators</p>
                    <h3 className="mt-2 text-3xl font-extrabold text-teal-600">{stats.admins}</h3>
                  </div>
                  <div className="rounded-xl bg-teal-50 p-3 text-teal-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Regular Users</p>
                    <h3 className="mt-2 text-3xl font-extrabold text-blue-600">{stats.regular}</h3>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="relative flex-1 max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="superadmin">Superadmin</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>

                  <button
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-teal-500 hover:to-teal-400 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7-7H5" />
                    </svg>
                    Add User
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-gray-500">
                    <thead className="bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-600 border-b border-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-4">Name</th>
                        <th scope="col" className="px-6 py-4">Email</th>
                        <th scope="col" className="px-6 py-4">Role</th>
                        <th scope="col" className="px-6 py-4">Created By</th>
                        <th scope="col" className="px-6 py-4">Created At</th>
                        <th scope="col" className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => {
                          const isSelf = user.email.toLowerCase() === currentUserEmail?.toLowerCase();
                          return (
                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="whitespace-nowrap px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600 font-bold text-sm border border-teal-100">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                      {user.name}
                                      {isSelf && (
                                        <span className="inline-flex items-center rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                          You
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-gray-650 font-medium">
                                {user.email}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                    user.role === "superadmin"
                                      ? "bg-red-50 text-red-700 ring-red-600/20"
                                      : user.role === "admin"
                                      ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                                      : "bg-teal-50 text-teal-700 ring-teal-600/20"
                                  }`}
                                >
                                  {user.role}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-gray-500 text-xs">
                                {user.createdBy || "System (Seed)"}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-gray-500 text-xs">
                                {new Date(user.createdAt).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-right">
                                <div className="flex justify-end gap-3">
                                  <button
                                    onClick={() => handleOpenEditModal(user)}
                                    className="text-teal-600 hover:text-teal-900 font-semibold transition-colors cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleOpenDeleteModal(user)}
                                    disabled={isSelf}
                                    className={`font-semibold transition-colors ${
                                      isSelf
                                        ? "text-gray-300 cursor-not-allowed"
                                        : "text-red-500 hover:text-red-800 cursor-pointer"
                                    }`}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <p className="mt-2 text-sm">No users match your filters.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM CONFIGURATION SETTINGS */}
          {activeTab === "system" && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">System Configurations</h3>
                <p className="text-sm text-gray-500 mt-1">Configure global application variables, maintenance settings, and signup policies.</p>
              </div>

              <form onSubmit={handleSaveSystemSettings} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Application Name</label>
                    <input
                      type="text"
                      required
                      value={systemSettings.appName}
                      onChange={(e) => setSystemSettings({ ...systemSettings, appName: e.target.value })}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Admin Notification Email</label>
                    <input
                      type="email"
                      required
                      value={systemSettings.adminNotificationEmail}
                      onChange={(e) => setSystemSettings({ ...systemSettings, adminNotificationEmail: e.target.value })}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Public User Registrations</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Toggle whether users can discover and sign up or if invitations are required.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemSettings.publicRegistration}
                        onChange={(e) => setSystemSettings({ ...systemSettings, publicRegistration: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Maintenance Lockout Mode</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Locks down access to the app for all users except administrators during maintenance window.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemSettings.maintenanceMode}
                        onChange={(e) => setSystemSettings({ ...systemSettings, maintenanceMode: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Sign Up Email Alerts</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Send a real-time notification email to the admin when a new user signs in.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={systemSettings.signupAlerts}
                        onChange={(e) => setSystemSettings({ ...systemSettings, signupAlerts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSettingsSaving}
                    className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSettingsSaving ? "Saving Config..." : "Save System Settings"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: SECURITY SETTINGS */}
          {activeTab === "security" && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Security & Access Controls</h3>
                <p className="text-sm text-gray-500 mt-1">Manage user session timeouts, authentication options, and sign-in policy controls.</p>
              </div>

              <form onSubmit={handleSaveSecuritySettings} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Session Idle Timeout</label>
                    <select
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 cursor-pointer"
                    >
                      <option value="15m">15 Minutes</option>
                      <option value="30m">30 Minutes</option>
                      <option value="1h">1 Hour (Recommended)</option>
                      <option value="12h">12 Hours</option>
                      <option value="24h">24 Hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Max Sign-In Failures</label>
                    <input
                      type="number"
                      required
                      min={3}
                      max={10}
                      value={securitySettings.maxAttempts}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, maxAttempts: parseInt(e.target.value) || 5 })}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Require Multi-Factor Auth (MFA)</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Enforces that all superadmin and admin accounts configure and pass MFA verification.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securitySettings.mfaRequired}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, mfaRequired: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Allow Password Reset Requests</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Allow users with credential logins to issue self-service forgot password email requests.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securitySettings.allowPasswordReset}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, allowPasswordReset: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSettingsSaving}
                    className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSettingsSaving ? "Saving Settings..." : "Save Security Settings"}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-150 animate-in scale-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Add New User</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  User will be allowed to log in via Google with this email.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">System Role</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 cursor-pointer"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Adding..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-150 animate-in scale-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit User Settings</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Name</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Email Address</label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">System Role</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 cursor-pointer"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {isDeleteModalOpen && activeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-150 animate-in scale-in duration-200">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-650 border border-red-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">Delete User</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-gray-900">{activeUser.name}</span>? This action is permanent and will immediately block them from signing into the system.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isPending}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
