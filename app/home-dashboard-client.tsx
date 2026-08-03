"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { createServiceUserAction, updateServiceUserAction, deleteServiceUserAction } from "@/app/actions";
import { ServiceUser } from "@/lib/service-user-store";

interface HomeDashboardClientProps {
  initialServiceUsers: ServiceUser[];
  currentUser: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

export default function HomeDashboardClient({
  initialServiceUsers,
  currentUser,
}: HomeDashboardClientProps) {
  const [serviceUsers, setServiceUsers] = useState<ServiceUser[]>(initialServiceUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [isDebug, setIsDebug] = useState(false);

  useEffect(() => {
    console.log("HomeDashboardClient: currentUser info:", {
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      roleLower: currentUser.role?.toLowerCase(),
      isAdmin: (currentUser.role || "").toLowerCase() === "superadmin" || (currentUser.role || "").toLowerCase() === "admin"
    });

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "true" || params.get("debug") === "1") {
        setIsDebug(true);
      }
    }
  }, [currentUser]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formNhsNumber, setFormNhsNumber] = useState("");
  const [formClientRef, setFormClientRef] = useState("");
  const [formGender, setFormGender] = useState("Prefer not to say");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Edit/Delete state
  const [editingUser, setEditingUser] = useState<ServiceUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ServiceUser | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEditClick = (user: ServiceUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormDob(user.dob || "");
    setFormNhsNumber(user.nhsNumber || "");
    setFormClientRef(user.clientRef || "");
    setFormGender(user.gender || "Prefer not to say");
    setFormNotes(user.notes || "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingUser(null);
    setFormName("");
    setFormDob("");
    setFormNhsNumber("");
    setFormClientRef("");
    setFormGender("Prefer not to say");
    setFormNotes("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (user: ServiceUser) => {
    setDeletingUser(user);
    setDeleteError(null);
  };

  const confirmDelete = () => {
    if (!deletingUser) return;
    startTransition(async () => {
      const res = await deleteServiceUserAction(deletingUser.id);
      if (res.success) {
        setServiceUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
        setDeletingUser(null);
      } else {
        setDeleteError(res.error || "Failed to delete Service User.");
      }
    });
  };

  // Age Calculator
  const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Clean NHS Number formatting (e.g., "123 456 7890")
  const formatNhsNumber = (nhs: string | undefined): string => {
    if (!nhs) return "Not provided";
    const cleaned = nhs.replace(/\s+/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return nhs;
  };

  // Process search, filters and sorting
  const processedUsers = useMemo(() => {
    let list = [...serviceUsers];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (user) =>
          user.name.toLowerCase().includes(q) ||
          user.nhsNumber?.toLowerCase().includes(q) ||
          user.clientRef?.toLowerCase().includes(q)
      );
    }

    // 2. Gender Filter
    if (genderFilter !== "All") {
      list = list.filter(
        (user) => user.gender?.toLowerCase() === genderFilter.toLowerCase()
      );
    }

    // 3. Sorting
    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "name_az") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name_za") {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === "dob_youngest") {
        const timeA = a.dob ? new Date(a.dob).getTime() : 0;
        const timeB = b.dob ? new Date(b.dob).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === "dob_oldest") {
        const timeA = a.dob ? new Date(a.dob).getTime() : Infinity;
        const timeB = b.dob ? new Date(b.dob).getTime() : Infinity;
        return timeA - timeB;
      }
      return 0;
    });

    return list;
  }, [serviceUsers, searchQuery, genderFilter, sortBy]);

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formName.trim()) {
      setFormError("Full Name is required.");
      return;
    }
    if (formDob) {
      const birthDate = new Date(formDob);
      if (birthDate > new Date()) {
        setFormError("Date of Birth cannot be in the future.");
        return;
      }
    }

    const cleanNhs = formNhsNumber.replace(/\s+/g, "");
    if (cleanNhs && !/^\d{10}$/.test(cleanNhs)) {
      setFormError("NHS Number must be a 10-digit number.");
      return;
    }

    startTransition(async () => {
      if (editingUser) {
        const res = await updateServiceUserAction({
          id: editingUser.id,
          name: formName,
          dob: formDob,
          nhsNumber: cleanNhs,
          clientRef: formClientRef,
          gender: formGender,
          notes: formNotes,
        });

        if (res.success && res.data) {
          setServiceUsers((prev) =>
            prev.map((user) => (user.id === editingUser.id ? (res.data as ServiceUser) : user))
          );
          // Reset Form & Close Modal
          setFormName("");
          setFormDob("");
          setFormNhsNumber("");
          setFormClientRef("");
          setFormGender("Prefer not to say");
          setFormNotes("");
          setEditingUser(null);
          setIsModalOpen(false);
        } else {
          setFormError(res.error || "Failed to update Service User.");
        }
      } else {
        const res = await createServiceUserAction({
          name: formName,
          dob: formDob,
          nhsNumber: cleanNhs,
          clientRef: formClientRef,
          gender: formGender,
          notes: formNotes,
        });

        if (res.success && res.data) {
          setServiceUsers((prev) => [res.data as ServiceUser, ...prev]);
          // Reset Form & Close Modal
          setFormName("");
          setFormDob("");
          setFormNhsNumber("");
          setFormClientRef("");
          setFormGender("Prefer not to say");
          setFormNotes("");
          setIsModalOpen(false);
        } else {
          setFormError(res.error || "Failed to create Service User.");
        }
      }
    });
  };

  const getGenderBadgeStyles = (gender: string = "") => {
    switch (gender.toLowerCase()) {
      case "male":
        return "bg-blue-50 text-blue-700 ring-blue-600/20";
      case "female":
        return "bg-rose-50 text-rose-700 ring-rose-600/20";
      case "other":
        return "bg-purple-50 text-purple-700 ring-purple-600/20";
      default:
        return "bg-gray-50 text-gray-700 ring-gray-600/20";
    }
  };

  const getGenderAvatarBg = (gender: string = "") => {
    switch (gender.toLowerCase()) {
      case "male":
        return "bg-gradient-to-br from-blue-500 to-indigo-600 text-white";
      case "female":
        return "bg-gradient-to-br from-pink-500 to-rose-600 text-white";
      case "other":
        return "bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white";
      default:
        return "bg-gradient-to-br from-teal-500 to-emerald-600 text-white";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50 font-sans">
      {isDebug && (
        <div className="bg-amber-100 border-b border-amber-250 text-amber-900 text-xs px-4 py-2.5 font-mono text-center flex flex-col items-center justify-center gap-1">
          <div><strong>[DEBUG ACTIVE]</strong> User Session Info:</div>
          <div>Name: {currentUser.name || "N/A"} | Email: {currentUser.email || "N/A"} | Role: {currentUser.role || "N/A"}</div>
          <div>Is Admin: {String((currentUser.role || "").toLowerCase() === "superadmin" || (currentUser.role || "").toLowerCase() === "admin")}</div>
        </div>
      )}
      {/* Premium Navigation Header */}
      <header className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-teal-500 shadow-md">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-gray-900">ClinicalPortal</span>
              <span className="ml-1.5 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">App</span>
            </div>
          </div>

          {/* Profile & Navigation Options */}
          <div className="flex items-center gap-4">
            {((currentUser.role || "").toLowerCase() === "superadmin" || (currentUser.role || "").toLowerCase() === "admin") && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/40 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 text-xs font-bold text-teal-800 shadow-sm transition-all hover:bg-teal-50 hover:border-teal-300 active:scale-95 cursor-pointer"
                title="Admin Panel"
              >
                <svg className="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Admin Panel</span>
              </Link>
            )}

            {/* Profile widget */}
            <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
              {currentUser.image ? (
                <img
                  src={currentUser.image}
                  alt={currentUser.name || "Profile"}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-gray-100 shadow-sm"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800 uppercase">
                  {currentUser.name ? currentUser.name[0] : "U"}
                </div>
              )}
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-gray-800 leading-none truncate max-w-[85px] sm:max-w-none">{currentUser.name || "User"}</span>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider leading-none mt-1">{currentUser.role || "User"}</span>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* Welcome Section / Hero banner */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              Service Users Directory
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Review existing patient files, perform intakes, and register new service users.
            </p>
          </div>

          <button
            onClick={handleAddClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-teal-500 hover:to-teal-400 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Service User
          </button>
        </div>

        {/* Filters and Controls Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-4.5 w-4.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by name, NHS number, or reference ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Filter and Sort Dropdowns */}
            <div className="flex flex-wrap gap-3">
              {/* Gender Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Gender:</span>
                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  className="rounded-xl border border-gray-350 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border border-gray-350 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  <option value="newest">Added (Newest)</option>
                  <option value="oldest">Added (Oldest)</option>
                  <option value="name_az">Name (A-Z)</option>
                  <option value="name_za">Name (Z-A)</option>
                  <option value="dob_youngest">Age (Youngest)</option>
                  <option value="dob_oldest">Age (Oldest)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Service Users Directory Display */}
        {processedUsers.length > 0 ? (
          <div className="flex flex-col gap-4">
            {processedUsers.map((user) => {
              const age = calculateAge(user.dob || "");
              const initials = user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <div
                  key={user.id}
                  className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-teal-200 transition-all duration-200"
                >
                  {/* Left Section: Avatar & Name details */}
                  <div className="flex items-center gap-4 min-w-0 md:w-1/4 shrink-0">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold text-lg shadow-inner ${getGenderAvatarBg(user.gender)}`}>
                      {initials}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="font-extrabold text-gray-900 truncate leading-snug group-hover:text-teal-650 transition-colors" title={user.name}>
                        {user.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {user.clientRef ? (
                          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600 ring-1 ring-inset ring-gray-500/10">
                            REF: {user.clientRef}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">No Ref Code</span>
                        )}
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${getGenderBadgeStyles(user.gender)}`}>
                          {user.gender || "Prefer not to say"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: Demographics & Notes */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 items-center text-xs min-w-0 md:border-l md:border-r md:border-gray-100 md:px-6">
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Date of Birth</span>
                      <span className={`font-bold ${user.dob ? "text-gray-700" : "text-gray-400 italic"}`}>{user.dob || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Age</span>
                      <span className={`font-bold ${user.dob ? "text-gray-700" : "text-gray-400 italic"}`}>{user.dob ? `${age} years old` : "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">NHS Number</span>
                      <span className="font-mono font-bold text-gray-700">{formatNhsNumber(user.nhsNumber)}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 min-w-0">
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Notes</span>
                      {user.notes ? (
                        <p className="text-xs text-gray-500 line-clamp-1 italic leading-relaxed" title={user.notes}>
                          "{user.notes}"
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300 italic">No notes recorded.</p>
                      )}
                    </div>
                  </div>

                  {/* Right Section: Action Buttons */}
                  <div className="shrink-0 flex items-center gap-2 md:pl-2">
                    <button
                      onClick={() => handleEditClick(user)}
                      title="Edit Service User"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-teal-650 hover:border-teal-200 hover:bg-teal-50/30 transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user)}
                      title="Delete Service User"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:text-rose-750 hover:bg-rose-100/70 hover:border-rose-200 transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <Link
                      href={`/test/${user.id}`}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-teal-50 px-4 text-xs font-bold text-teal-800 transition-all hover:bg-teal-100 hover:text-teal-900 active:scale-98 cursor-pointer shadow-sm"
                    >
                      <svg className="h-3.5 w-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start Test
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600 mb-4 ring-8 ring-teal-50/30">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Service Users found</h3>
            <p className="mt-1.5 max-w-sm text-sm text-gray-400 leading-normal">
              {searchQuery.trim() || genderFilter !== "All"
                ? "No service users match your search terms or filters. Try adjusting your query."
                : "Your system has no registered service users. Create a patient file to begin performing clinical diagnostic tests."}
            </p>
            {(searchQuery.trim() || genderFilter !== "All") ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setGenderFilter("All");
                }}
                className="mt-4 rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 cursor-pointer"
              >
                Clear Search & Filters
              </button>
            ) : (
              <button
                onClick={handleAddClick}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-550 cursor-pointer"
              >
                Register First User
              </button>
            )}
          </div>
        )}

      </main>

      {/* Add/Edit Service User Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-150 animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4.5">
              <div className="flex items-center gap-2 text-gray-800">
                <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  {editingUser ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  )}
                </svg>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingUser ? "Edit Service User Details" : "Register New Service User"}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingUser(null);
                  setFormError(null);
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-6 py-5 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="rounded-xl bg-red-50 p-3.5 border border-red-100 text-xs font-medium text-red-700 flex gap-2 items-start">
                    <svg className="h-4.5 w-4.5 shrink-0 text-red-550" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="formName" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="formName"
                    required
                    placeholder="e.g. Johnathan Doe"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* DOB & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="formDob" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      id="formDob"
                      value={formDob}
                      onChange={(e) => setFormDob(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="formGender" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Gender
                    </label>
                    <select
                      id="formGender"
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors cursor-pointer"
                    >
                      <option value="Prefer not to say">Prefer not to say</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* NHS Number & Client Ref */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="formNhsNumber" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      NHS Number <span className="text-[10px] text-gray-400 font-medium">(10 digits)</span>
                    </label>
                    <input
                      type="text"
                      id="formNhsNumber"
                      placeholder="e.g. 324 502 9183"
                      value={formNhsNumber}
                      onChange={(e) => setFormNhsNumber(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="formClientRef" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Client Reference ID
                    </label>
                    <input
                      type="text"
                      id="formClientRef"
                      placeholder="e.g. REF-2890"
                      value={formClientRef}
                      onChange={(e) => setFormClientRef(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label htmlFor="formNotes" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Notes & Clinical Observation
                  </label>
                  <textarea
                    id="formNotes"
                    rows={3}
                    placeholder="Enter any medical, behavioral, or special care recommendations..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>

               {/* Modal Actions */}
               <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                 <button
                   type="button"
                   onClick={() => {
                     setIsModalOpen(false);
                     setEditingUser(null);
                     setFormError(null);
                   }}
                   className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-98 cursor-pointer"
                 >
                   Cancel
                 </button>
                 <button
                   type="submit"
                   disabled={isPending}
                   className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-4.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-teal-500 hover:to-teal-400 active:scale-98 disabled:opacity-55 cursor-pointer"
                 >
                   {isPending ? (
                     <>
                       <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                       Saving...
                     </>
                   ) : (
                     <>
                       <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                       </svg>
                       {editingUser ? "Save Changes" : "Save User"}
                     </>
                   )}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-150 animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-red-50/50 px-6 py-4.5">
              <div className="flex items-center gap-2 text-red-805">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-lg font-bold text-red-900">Delete Service User</h2>
              </div>
              <button
                onClick={() => setDeletingUser(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {deleteError && (
                <div className="rounded-xl bg-red-50 p-3.5 border border-red-100 text-xs font-medium text-red-700 flex gap-2 items-start">
                  <svg className="h-4.5 w-4.5 shrink-0 text-red-550" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{deleteError}</span>
                </div>
              )}

              <p className="text-sm text-gray-600 leading-relaxed">
                Are you sure you want to delete the clinical profile for <span className="font-extrabold text-gray-900">{deletingUser.name}</span>?
              </p>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 text-xs text-amber-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Warning: Irreversible action
                </p>
                <p className="leading-normal text-amber-700">
                  This will permanently delete their clinical files and references from the local system store.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-98 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-650 px-4.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 active:scale-98 disabled:opacity-55 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Profile
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
