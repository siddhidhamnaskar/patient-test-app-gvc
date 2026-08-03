"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  createUserAction,
  updateUserAction,
  deleteUserAction,
  uploadImagesAction,
  updateImageNameAction,
  createQuestionAction,
  importQuestionsCSVAction,
  getQuestionsAction,
  saveLevelsAction,
  uploadVoicePromptAction,
  deleteVoicePromptAction,
} from "./actions";
import { formatUTCDate, formatUTCDateTime } from "@/lib/date-utils";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdBy: string | null;
  createdAt: string;
}

interface ImageMetadata {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  createdAt: string;
}

interface QuestionMetadata {
  id: string;
  text: string;
}

interface ScreenMetadata {
  id: string;
  name: string;
  imageId?: string;
  imageIds?: string[];
  questionId?: string;
  questionIds?: string[];
  voiceRecordEnabled?: boolean[];
  voicePromptUrls?: string[];
  answers?: string[];
  order: number;
}

interface LevelMetadata {
  id: string;
  name: string;
  order: number;
  screens?: ScreenMetadata[];
}

interface AdminDashboardClientProps {
  initialUsers: User[];
  initialImages: ImageMetadata[];
  initialQuestions: QuestionMetadata[];
  initialLevels: LevelMetadata[];
  currentUserId?: string;
  currentUserEmail?: string | null;
}

type TabType = "users" | "system" | "security" | "images" | "questions" | "tests";

interface VoiceRecorderWidgetProps {
  levelId: string;
  screenId: string;
  slotIndex: number;
  initialAudioUrl?: string;
  onSaveAudio: (relativeUrl: string) => void;
  onDeleteAudio: () => void;
}

function VoiceRecorderWidget({
  levelId,
  screenId,
  slotIndex,
  initialAudioUrl = "",
  onSaveAudio,
  onDeleteAudio,
}: VoiceRecorderWidgetProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Sync initialAudioUrl prop with local state when it changes (e.g., switching screens)
  useEffect(() => {
    setAudioUrl(initialAudioUrl);
  }, [initialAudioUrl, levelId, screenId, slotIndex]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Stop all media tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      setRecordingTime(0);
      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const saveRecording = async () => {
    if (audioChunksRef.current.length === 0) return;
    setIsUploading(true);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const file = new File([audioBlob], "recording.webm", { type: "audio/webm" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("levelId", levelId);
      formData.append("screenId", screenId);
      formData.append("slotIndex", slotIndex.toString());

      const res = await uploadVoicePromptAction(formData);
      if (res.success && res.url) {
        setAudioUrl(res.url);
        onSaveAudio(res.url);
      } else {
        alert(res.error || "Failed to upload recording.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error saving recording: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteRecording = async () => {
    if (!audioUrl) return;

    // If it's a saved recording on the server, delete it
    if (audioUrl.startsWith("/recordings/")) {
      const confirmDel = window.confirm("Are you sure you want to delete this recording from the server?");
      if (!confirmDel) return;

      setIsUploading(true);
      try {
        const res = await deleteVoicePromptAction(audioUrl);
        if (res.success) {
          setAudioUrl("");
          onDeleteAudio();
        } else {
          alert(res.error || "Failed to delete audio file.");
        }
      } catch (err: any) {
        console.error(err);
        alert("Error deleting recording: " + err.message);
      } finally {
        setIsUploading(false);
      }
    } else {
      // It's a local unsaved blob, just clear it
      setAudioUrl("");
      audioChunksRef.current = [];
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="mt-2.5 p-3 rounded-lg border border-dashed border-teal-200 bg-teal-50/20 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Record Voice Option
        </span>
        {isRecording ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-650 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-red-600"></span>
            RECORDING {formatTime(recordingTime)}
          </span>
        ) : audioUrl ? (
          <span className="text-[10px] font-bold text-teal-650 flex items-center gap-1">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Ready
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">Empty</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isRecording && !audioUrl && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-150 transition-colors cursor-pointer"
          >
            <svg className="h-3.5 w-3.5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
            Record Voice
          </button>
        )}

        {isRecording && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-850 hover:bg-gray-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            Stop
          </button>
        )}

        {audioUrl && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
            <audio src={audioUrl} controls className="h-7 w-full sm:w-48 outline-none" />
            <div className="flex items-center gap-2 mt-1 sm:mt-0">
              {audioChunksRef.current.length > 0 && !audioUrl.startsWith("/recordings/") && (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={saveRecording}
                  className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  {isUploading ? (
                    <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Save Audio
                </button>
              )}

              <button
                type="button"
                disabled={isUploading}
                onClick={deleteRecording}
                className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete audio"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ImageSelectProps {
  value: string;
  onChange: (value: string) => void;
  images: ImageMetadata[];
}

function ImageSelect({ value, onChange, images }: ImageSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedImage = images.find((img) => img.id === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white font-medium cursor-pointer focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 min-h-[70px]"
      >
        <div className="flex items-center gap-2.5 truncate text-left">
          {selectedImage ? (
            <>
              <img
                src={selectedImage.url}
                alt={selectedImage.name}
                className="h-14 w-20 rounded-lg object-cover border border-gray-150 flex-shrink-0 shadow-xs"
              />
              <span className="truncate text-gray-855 font-bold">{selectedImage.name}</span>
            </>
          ) : (
            <span className="text-gray-400">-- Empty --</span>
          )}
        </div>
        <svg className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5 scrollbar-thin">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-gray-50 font-bold cursor-pointer"
          >
            -- Empty --
          </button>
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                onChange(image.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs hover:bg-teal-50/50 cursor-pointer ${
                value === image.id ? "bg-teal-50 font-bold text-teal-900" : "text-gray-700 font-medium"
              }`}
            >
              <img
                src={image.url}
                alt={image.name}
                className="h-14 w-20 rounded-lg object-cover border border-gray-200 shadow-xs flex-shrink-0"
              />
              <span className="truncate">{image.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ImageSlotSelectProps {
  value: string;
  onChange: (value: string) => void;
  images: ImageMetadata[];
  activeImageIds: string[];
}

function ImageSlotSelect({ value, onChange, images, activeImageIds }: ImageSlotSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedImageId = value;
  const selectedImageIndex = activeImageIds.indexOf(selectedImageId);
  const selectedImage = images.find((img) => img.id === selectedImageId);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white font-medium cursor-pointer focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 min-h-[70px]"
      >
        <div className="flex items-center gap-2.5 truncate text-left">
          {selectedImage && selectedImageIndex !== -1 ? (
            <>
              <img
                src={selectedImage.url}
                alt={selectedImage.name}
                className="h-14 w-20 rounded-lg object-cover border border-gray-150 flex-shrink-0 shadow-xs"
              />
              <span className="truncate text-gray-855 font-bold">
                Slot {selectedImageIndex + 1}: {selectedImage.name}
              </span>
            </>
          ) : (
            <span className="text-gray-400">-- No Answer / Empty --</span>
          )}
        </div>
        <svg className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5 scrollbar-thin">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-gray-50 font-bold cursor-pointer"
          >
            -- No Answer / Empty --
          </button>
          {activeImageIds.filter(Boolean).map((imgId, imgIdx) => {
            const foundImg = images.find((i) => i.id === imgId);
            if (!foundImg) return null;
            return (
              <button
                key={imgId}
                type="button"
                onClick={() => {
                  onChange(imgId);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs hover:bg-teal-50/50 cursor-pointer ${
                  value === imgId ? "bg-teal-50 font-bold text-teal-900" : "text-gray-700 font-medium"
                }`}
              >
                <img
                  src={foundImg.url}
                  alt={foundImg.name}
                  className="h-14 w-20 rounded-lg object-cover border border-gray-200 shadow-xs flex-shrink-0"
                />
                <span className="truncate">
                  Slot {imgIdx + 1}: {foundImg.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardClient({
  initialUsers,
  initialImages,
  initialQuestions,
  initialLevels,
  currentUserId,
  currentUserEmail,
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [images, setImages] = useState<ImageMetadata[]>(initialImages);
  const [questions, setQuestions] = useState<QuestionMetadata[]>(initialQuestions);
  const [levels, setLevels] = useState<LevelMetadata[]>(initialLevels || []);

  // Level Management states
  const [newLevelName, setNewLevelName] = useState("");
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editingLevelName, setEditingLevelName] = useState("");

  // Screen Management states
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenImageIds, setNewScreenImageIds] = useState<string[]>(["", "", "", ""]);
  const [newScreenQuestionIds, setNewScreenQuestionIds] = useState<string[]>(["", "", "", ""]);
  const [editingScreenId, setEditingScreenId] = useState<string | null>(null);
  const [editingScreenName, setEditingScreenName] = useState("");
  
  // Search/Filters states
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [imageSearchTerm, setImageSearchTerm] = useState("");
  const [questionText, setQuestionText] = useState("");
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [isCsvImporting, setIsCsvImporting] = useState(false);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Image Edit Modal states
  const [isImageEditModalOpen, setIsImageEditModalOpen] = useState(false);
  const [activeImage, setActiveImage] = useState<ImageMetadata | null>(null);
  const [imageEditName, setImageEditName] = useState("");

  // Upload Form states
  const [uploadName, setUploadName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // Test Settings states
  const [testSettings, setTestSettings] = useState({
    duration: "60m",
    passingScore: 70,
    shuffleQuestions: false,
    shuffleAnswers: false,
    negativeMarking: false,
    showResultsImmediately: true,
  });
  
  // Status notifications
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const [isPending, startTransition] = useTransition();
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  // Filtered images
  const filteredImages = useMemo(() => {
    return images.filter((image) =>
      image.name.toLowerCase().includes(imageSearchTerm.toLowerCase()) ||
      image.uploadedBy.toLowerCase().includes(imageSearchTerm.toLowerCase())
    );
  }, [images, imageSearchTerm]);

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

  // Handlers for Local Image Management
  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileInput = fileInputRef.current;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      showNotification("error", "Please select at least one image file.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < fileInput.files.length; i++) {
      formData.append("files", fileInput.files[i]);
    }

    try {
      const res = await uploadImagesAction(formData);
      if (res.success && res.data) {
        setImages((prev) => [...res.data!, ...prev]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        showNotification("success", `Successfully uploaded ${res.data.length} images. Edit their names below.`);
      } else {
        showNotification("error", res.error || "Upload failed.");
      }
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "An error occurred during file upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenImageEditModal = (image: ImageMetadata) => {
    setActiveImage(image);
    setImageEditName(image.name);
    setIsImageEditModalOpen(true);
  };

  const handleUpdateImageName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeImage || !imageEditName.trim()) return;

    startTransition(async () => {
      const res = await updateImageNameAction(activeImage.id, imageEditName);
      if (res.success) {
        setImages((prev) =>
          prev.map((img) => (img.id === activeImage.id ? { ...img, name: imageEditName.trim() } : img))
        );
        setIsImageEditModalOpen(false);
        setActiveImage(null);
        showNotification("success", "Image name successfully updated.");
      } else {
        showNotification("error", res.error || "Failed to update image name.");
      }
    });
  };

  // Handlers for Local Questions Management
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      showNotification("error", "Question text is required.");
      return;
    }

    startTransition(async () => {
      const res = await createQuestionAction({ text: questionText });
      if (res.success && res.data) {
        setQuestions((prev) => [res.data!, ...prev]);
        setQuestionText("");
        showNotification("success", "Question added successfully.");
      } else {
        showNotification("error", res.error || "Failed to save question.");
      }
    });
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileInput = csvFileInputRef.current;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      showNotification("error", "Please select a CSV file first.");
      return;
    }

    setIsCsvImporting(true);
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
      const res = await importQuestionsCSVAction(formData);
      if (res.success) {
        // Refresh questions list
        const fetchRes = await getQuestionsAction();
        if (fetchRes.success && fetchRes.data) {
          setQuestions(fetchRes.data);
        }
        
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        if (res.warning) {
          showNotification("success", `${res.message}\nWarning: ${res.warning}`);
        } else {
          showNotification("success", res.message || "Questions imported successfully.");
        }
      } else {
        showNotification("error", res.error || "CSV Import failed.");
      }
    } catch (err: any) {
      console.error(err);
      showNotification("error", err.message || "An error occurred during CSV import.");
    } finally {
      setIsCsvImporting(false);
    }
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

  const handleSaveTestSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSettingsSaving(true);
    setTimeout(() => {
      setIsSettingsSaving(false);
      showNotification("success", "Test settings and policies saved successfully.");
    }, 800);
  };

  // Level Management Handlers
  const handleMoveLevel = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= levels.length) return;

    const reordered = [...levels];
    const temp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = temp;

    const updated = reordered.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    setLevels(updated);

    startTransition(async () => {
      const res = await saveLevelsAction(updated);
      if (res.success) {
        showNotification("success", "Test levels order updated.");
      } else {
        showNotification("error", res.error || "Failed to update levels order.");
      }
    });
  };

  const handleAddLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLevelName.trim()) {
      showNotification("error", "Level name is required.");
      return;
    }

    const newLevel: LevelMetadata = {
      id: "lvl_" + Date.now(),
      name: newLevelName.trim(),
      order: levels.length + 1,
    };

    const updated = [...levels, newLevel];
    setLevels(updated);
    setNewLevelName("");

    startTransition(async () => {
      const res = await saveLevelsAction(updated);
      if (res.success) {
        showNotification("success", `Level "${newLevel.name}" added successfully.`);
      } else {
        showNotification("error", res.error || "Failed to add new level.");
      }
    });
  };

  const handleStartEditLevel = (level: LevelMetadata) => {
    setEditingLevelId(level.id);
    setEditingLevelName(level.name);
  };

  const handleCancelEditLevel = () => {
    setEditingLevelId(null);
    setEditingLevelName("");
  };

  const handleSaveLevelName = async (id: string) => {
    if (!editingLevelName.trim()) {
      showNotification("error", "Level name cannot be empty.");
      return;
    }

    const updated = levels.map((lvl) => {
      if (lvl.id === id) {
        return { ...lvl, name: editingLevelName.trim() };
      }
      return lvl;
    });

    setLevels(updated);
    setEditingLevelId(null);
    setEditingLevelName("");

    startTransition(async () => {
      const res = await saveLevelsAction(updated);
      if (res.success) {
        showNotification("success", "Level name updated successfully.");
      } else {
        showNotification("error", res.error || "Failed to save level name.");
      }
    });
  };

  const handleDeleteLevel = async (id: string) => {
    const updated = levels.filter((lvl) => lvl.id !== id).map((lvl, idx) => ({
      ...lvl,
      order: idx + 1,
    }));

    setLevels(updated);
    if (selectedLevelId === id) {
      setSelectedLevelId(null);
      setSelectedScreenId(null);
    }

    startTransition(async () => {
      const res = await saveLevelsAction(updated);
      if (res.success) {
        showNotification("success", "Level deleted successfully.");
      } else {
        showNotification("error", res.error || "Failed to delete level.");
      }
    });
  };

  // Screen Management Handlers
  const handleAddScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevelId) return;
    if (!newScreenName.trim()) {
      showNotification("error", "Screen name is required.");
      return;
    }

    const level = levels.find(l => l.id === selectedLevelId);
    if (!level) return;

    const activeImageIds = [...newScreenImageIds];
    const activeQuestionIds = [...newScreenQuestionIds];

    const newScreen: ScreenMetadata = {
      id: "scr_" + Date.now(),
      name: newScreenName.trim(),
      imageIds: activeImageIds,
      questionIds: activeQuestionIds,
      order: (level.screens?.length || 0) + 1,
    };

    const updatedLevels = levels.map(l => {
      if (l.id === selectedLevelId) {
        return {
          ...l,
          screens: [...(l.screens || []), newScreen]
        };
      }
      return l;
    });

    setLevels(updatedLevels);
    setNewScreenName("");
    setNewScreenImageIds(["", "", "", ""]);
    setNewScreenQuestionIds(["", "", "", ""]);

    startTransition(async () => {
      const res = await saveLevelsAction(updatedLevels);
      if (res.success) {
        showNotification("success", `Screen "${newScreen.name}" added successfully.`);
      } else {
        showNotification("error", res.error || "Failed to add screen.");
      }
    });
  };

  const handleUpdateScreen = async (screenId: string, updates: Partial<ScreenMetadata>) => {
    if (!selectedLevelId) return;

    const updatedLevels = levels.map(l => {
      if (l.id === selectedLevelId) {
        const updatedScreens = (l.screens || []).map(s => {
          if (s.id === screenId) {
            return { ...s, ...updates };
          }
          return s;
        });
        return { ...l, screens: updatedScreens };
      }
      return l;
    });

    setLevels(updatedLevels);

    startTransition(async () => {
      const res = await saveLevelsAction(updatedLevels);
      if (!res.success) {
        showNotification("error", res.error || "Failed to update screen.");
      }
    });
  };

  const handleUpdateScreenImage = (screen: ScreenMetadata, imageIndex: number, newImageId: string) => {
    let currentImageIds: string[];
    if (screen.imageIds) {
      currentImageIds = [...screen.imageIds];
    } else if (screen.imageId) {
      currentImageIds = [screen.imageId];
    } else {
      currentImageIds = [];
    }

    while (currentImageIds.length <= imageIndex) {
      currentImageIds.push("");
    }
    currentImageIds[imageIndex] = newImageId;
    handleUpdateScreen(screen.id, { imageIds: currentImageIds });
  };

  const handleUpdateScreenQuestion = (screen: ScreenMetadata, questionIndex: number, newQuestionId: string) => {
    let currentQuestionIds: string[];
    if (screen.questionIds) {
      currentQuestionIds = [...screen.questionIds];
    } else if (screen.questionId) {
      currentQuestionIds = [screen.questionId];
    } else {
      currentQuestionIds = [];
    }

    while (currentQuestionIds.length <= questionIndex) {
      currentQuestionIds.push("");
    }
    currentQuestionIds[questionIndex] = newQuestionId;
    
    // Reset voice recording toggle for this slot if it's cleared or changed
    let currentVoiceRecord = screen.voiceRecordEnabled ? [...screen.voiceRecordEnabled] : [];
    while (currentVoiceRecord.length <= questionIndex) {
      currentVoiceRecord.push(false);
    }
    currentVoiceRecord[questionIndex] = false;

    // Reset saved voice prompt URL for this slot as well
    let currentVoiceUrls = screen.voicePromptUrls ? [...screen.voicePromptUrls] : [];
    while (currentVoiceUrls.length <= questionIndex) {
      currentVoiceUrls.push("");
    }
    const previousUrl = currentVoiceUrls[questionIndex];
    currentVoiceUrls[questionIndex] = "";

    // Trigger delete action for old prompt audio file in the background if it exists
    if (previousUrl && previousUrl.startsWith("/recordings/")) {
      deleteVoicePromptAction(previousUrl).catch(console.error);
    }

    // Reset answer for this slot as well
    let currentAnswers = screen.answers ? [...screen.answers] : [];
    while (currentAnswers.length <= questionIndex) {
      currentAnswers.push("");
    }
    currentAnswers[questionIndex] = "";

    handleUpdateScreen(screen.id, { 
      questionIds: currentQuestionIds,
      voiceRecordEnabled: currentVoiceRecord,
      voicePromptUrls: currentVoiceUrls,
      answers: currentAnswers
    });
  };

  const handleUpdateScreenAnswer = (screen: ScreenMetadata, questionIndex: number, newAnswerImageId: string) => {
    let currentAnswers = screen.answers ? [...screen.answers] : [];
    while (currentAnswers.length <= questionIndex) {
      currentAnswers.push("");
    }
    currentAnswers[questionIndex] = newAnswerImageId;
    handleUpdateScreen(screen.id, { answers: currentAnswers });
  };

  const handleUpdateScreenVoiceRecord = (screen: ScreenMetadata, questionIndex: number, enabled: boolean) => {
    let currentVoiceRecord = screen.voiceRecordEnabled ? [...screen.voiceRecordEnabled] : [];
    while (currentVoiceRecord.length <= questionIndex) {
      currentVoiceRecord.push(false);
    }
    currentVoiceRecord[questionIndex] = enabled;
    handleUpdateScreen(screen.id, { voiceRecordEnabled: currentVoiceRecord });
  };

  const handleUpdateScreenVoicePromptUrl = (screen: ScreenMetadata, questionIndex: number, newVoiceUrl: string) => {
    let currentVoiceUrls = screen.voicePromptUrls ? [...screen.voicePromptUrls] : [];
    while (currentVoiceUrls.length <= questionIndex) {
      currentVoiceUrls.push("");
    }
    currentVoiceUrls[questionIndex] = newVoiceUrl;
    handleUpdateScreen(screen.id, { voicePromptUrls: currentVoiceUrls });
  };

  const handleDeleteScreenVoicePromptUrl = (screen: ScreenMetadata, questionIndex: number) => {
    let currentVoiceUrls = screen.voicePromptUrls ? [...screen.voicePromptUrls] : [];
    while (currentVoiceUrls.length <= questionIndex) {
      currentVoiceUrls.push("");
    }
    currentVoiceUrls[questionIndex] = "";
    handleUpdateScreen(screen.id, { voicePromptUrls: currentVoiceUrls });
  };

  const handleDeleteScreen = async (screenId: string) => {
    if (!selectedLevelId) return;

    if (selectedScreenId === screenId) {
      setSelectedScreenId(null);
    }

    const updatedLevels = levels.map(l => {
      if (l.id === selectedLevelId) {
        const filteredScreens = (l.screens || []).filter(s => s.id !== screenId);
        // Reorder remaining screens
        const updatedScreens = filteredScreens.map((s, idx) => ({
          ...s,
          order: idx + 1
        }));
        return { ...l, screens: updatedScreens };
      }
      return l;
    });

    setLevels(updatedLevels);

    startTransition(async () => {
      const res = await saveLevelsAction(updatedLevels);
      if (res.success) {
        showNotification("success", "Screen deleted successfully.");
      } else {
        showNotification("error", res.error || "Failed to delete screen.");
      }
    });
  };

  const handleMoveScreen = async (screenIndex: number, direction: "up" | "down") => {
    if (!selectedLevelId) return;

    const level = levels.find(l => l.id === selectedLevelId);
    if (!level || !level.screens) return;

    const newIndex = direction === "up" ? screenIndex - 1 : screenIndex + 1;
    if (newIndex < 0 || newIndex >= level.screens.length) return;

    const reordered = [...level.screens];
    const temp = reordered[screenIndex];
    reordered[screenIndex] = reordered[newIndex];
    reordered[newIndex] = temp;

    const updatedScreens = reordered.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    const updatedLevels = levels.map(l => {
      if (l.id === selectedLevelId) {
        return { ...l, screens: updatedScreens };
      }
      return l;
    });

    setLevels(updatedLevels);

    startTransition(async () => {
      const res = await saveLevelsAction(updatedLevels);
      if (res.success) {
        showNotification("success", "Screens order updated.");
      } else {
        showNotification("error", res.error || "Failed to reorder screens.");
      }
    });
  };

  const handleStartEditScreen = (screen: ScreenMetadata) => {
    setEditingScreenId(screen.id);
    setEditingScreenName(screen.name);
  };

  const handleCancelEditScreen = () => {
    setEditingScreenId(null);
    setEditingScreenName("");
  };

  const handleSaveScreenName = async (screenId: string) => {
    if (!editingScreenName.trim()) {
      showNotification("error", "Screen name cannot be empty.");
      return;
    }
    await handleUpdateScreen(screenId, { name: editingScreenName.trim() });
    setEditingScreenId(null);
    setEditingScreenName("");
    showNotification("success", "Screen name updated successfully.");
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
                className={`flex-1 min-w-[110px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "users"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                Users Settings
              </button>
              <button
                onClick={() => setActiveTab("images")}
                className={`flex-1 min-w-[110px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "images"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                Image Settings
              </button>
              <button
                onClick={() => setActiveTab("questions")}
                className={`flex-1 min-w-[110px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "questions"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                Questions Config
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`flex-1 min-w-[110px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "tests"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                Test Settings
              </button>
              {/* <button
                onClick={() => setActiveTab("system")}
                className={`flex-1 min-w-[110px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "system"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                System Config
              </button> */}
              {/* <button
                onClick={() => setActiveTab("security")}
                className={`flex-1 min-w-[110px] text-center rounded-lg py-2.5 text-xs font-bold transition-all ${
                  activeTab === "security"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:text-gray-700 border border-gray-200"
                }`}
              >
                Security Settings
              </button> */}
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
              onClick={() => setActiveTab("images")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === "images"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image Settings
            </button>

            <button
              onClick={() => setActiveTab("questions")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === "questions"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Questions Settings
            </button>

            <button
              onClick={() => setActiveTab("tests")}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === "tests"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Test Settings
            </button>

            {/* <button
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
            </button> */}

            {/* <button
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
            </button> */}
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

              {/* Users Table */}
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
                                {formatUTCDate(user.createdAt)}
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

          {/* TAB 2: SHARED IMAGE SETTINGS */}
          {activeTab === "images" && (
            <div className="space-y-6">
              
              {/* Upload Image Section */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Upload New Local Image</h3>
                  <p className="text-sm text-gray-500 mt-1">Upload images to the local filesystem server, accessible by all users.</p>
                </div>

                <form onSubmit={handleUploadImage} className="space-y-4">
                  <div className="w-full">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Choose Image File(s)</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      required
                      multiple
                      accept="image/*"
                      className="mt-2 w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                    />
                    <span className="text-[10px] text-gray-400 mt-1.5 block">
                      You can select one or more images. The default names will be the original filenames.
                    </span>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-gray-50">
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isUploading ? "Uploading locally..." : "Upload Images"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Uploaded Images Search Bar */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="relative flex-1 max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search images by name or uploader..."
                    value={imageSearchTerm}
                    onChange={(e) => setImageSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                  />
                </div>
              </div>

              {/* Images Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredImages.length > 0 ? (
                  filteredImages.map((image) => (
                    <div key={image.id} className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all">
                      <div className="aspect-video relative overflow-hidden bg-gray-50 border-b border-gray-100">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="font-bold text-gray-900 truncate" title={image.name}>
                            {image.name}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            Uploaded by: {image.uploadedBy}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Date: {formatUTCDateTime(image.createdAt)}
                          </p>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-gray-50">
                          <button
                            onClick={() => handleOpenImageEditModal(image)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-900 transition-colors cursor-pointer"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit Name
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full rounded-2xl border border-gray-100 bg-white py-16 text-center text-gray-400">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2 text-sm font-semibold">No images uploaded yet.</p>
                       <Link
                                  href="/"
                                  className="bg-teal-400 mt-4 inline-flex items-center gap-1.5 rounded-xl bg-teal-650 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-600"
                                >
                                  Return to Dashboard
                                </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM CONFIGURATION SETTINGS */}
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

          {/* TAB 4: SECURITY SETTINGS */}
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

          {/* TAB 5: QUESTIONS SETTINGS */}
          {activeTab === "questions" && (
            <div className="space-y-6">
              
              {/* Add Question & Import CSV side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Add Question Section */}
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Add New Local Question</h3>
                    <p className="text-sm text-gray-500 mt-1">Configure diagnostic or intake questions saved locally.</p>
                  </div>

                  <form onSubmit={handleCreateQuestion} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Question Text</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="e.g. Do you have any pre-existing health conditions?"
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 resize-none"
                      />
                    </div>

                    <div className="flex justify-end pt-2 border-t border-gray-50">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isPending ? "Adding locally..." : "Add Question"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Import Questions from CSV Section */}
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Import Questions from CSV</h3>
                    <p className="text-sm text-gray-500 mt-1">Upload a CSV file containing questions. Matches columns by headers (ID, Text / Question / Heading).</p>
                  </div>

                  <form onSubmit={handleImportCSV} className="space-y-4 mt-auto">
                    <div className="w-full">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Choose CSV File</label>
                      <input
                        type="file"
                        ref={csvFileInputRef}
                        required
                        accept=".csv"
                        className="mt-2 w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                      />
                      <span className="text-[10px] text-gray-400 mt-1.5 block">
                        CSV should have a header row. Duplicate IDs will automatically update existing question text.
                      </span>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-gray-50">
                      <button
                        type="submit"
                        disabled={isCsvImporting}
                        className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isCsvImporting ? "Importing questions..." : "Import CSV"}
                      </button>
                    </div>
                  </form>
                </div>

              </div>

              {/* Questions List */}
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                  <h4 className="font-bold text-gray-900">Questions Library</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Read-only list of configured intake questions.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-gray-500">
                    <thead className="bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-600 border-b border-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-4 w-1/4">Question ID</th>
                        <th scope="col" className="px-6 py-4 w-3/4">Question Text</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {questions && questions.length > 0 ? (
                        questions.map((q) => (
                          <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="whitespace-nowrap px-6 py-4 font-mono text-sm font-semibold text-teal-850">
                              {q.id}
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-pre-wrap">
                              {q.text}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                              <svg className="h-10 w-10 text-gray-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="mt-2 text-sm font-semibold">No questions configured yet.</p>
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

          {/* TAB 6: TEST SETTINGS */}
          {activeTab === "tests" && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
              
              {/* Breadcrumb Navigation / Header */}
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Assessment Configuration</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Configure test levels, add diagnostic screens, and map target images and intake questions.
                    </p>
                  </div>
                </div>

                {/* Breadcrumbs */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-150">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLevelId(null);
                      setSelectedScreenId(null);
                    }}
                    className={`font-semibold hover:text-teal-650 transition-colors ${
                      !selectedLevelId ? "text-teal-650 cursor-default" : "text-gray-500 cursor-pointer"
                    }`}
                    disabled={!selectedLevelId}
                  >
                    Test Levels
                  </button>

                  {selectedLevelId && (
                    <>
                      <span className="text-gray-300">/</span>
                      <button
                        type="button"
                        onClick={() => setSelectedScreenId(null)}
                        className={`font-semibold hover:text-teal-650 transition-colors max-w-[150px] truncate ${
                          !selectedScreenId ? "text-teal-650 cursor-default" : "text-gray-500 cursor-pointer"
                        }`}
                        disabled={!selectedScreenId}
                      >
                        {levels.find(l => l.id === selectedLevelId)?.name || "Selected Level"} Screens
                      </button>
                    </>
                  )}

                  {selectedLevelId && selectedScreenId && (
                    <>
                      <span className="text-gray-300">/</span>
                      <span className="font-semibold text-teal-650 max-w-[180px] truncate">
                        {levels.find(l => l.id === selectedLevelId)?.screens?.find(s => s.id === selectedScreenId)?.name || "Screen"} Configuration
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* View 1: Levels List (selectedLevelId is null) */}
              {!selectedLevelId && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                      Select or Manage Test Levels
                    </h4>
                    
                    {/* Add New Level Form */}
                    <form onSubmit={handleAddLevel} className="flex gap-2 w-full sm:w-auto max-w-sm">
                      <input
                        type="text"
                        placeholder="Add Level Name (e.g. Level 5)"
                        value={newLevelName}
                        onChange={(e) => setNewLevelName(e.target.value)}
                        className="flex-1 min-w-[200px] rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                        required
                      />
                      <button
                        type="submit"
                        className="flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                      >
                        Add Level
                      </button>
                    </form>
                  </div>

                  {/* Levels Table */}
                  <div className="overflow-hidden rounded-xl border border-gray-150 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm text-gray-500">
                        <thead className="bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-600 border-b border-gray-150">
                          <tr>
                            <th scope="col" className="px-5 py-3 w-16 text-center">Order</th>
                            <th scope="col" className="px-5 py-3 w-20 text-center">Move</th>
                            <th scope="col" className="px-5 py-3">Level Name</th>
                            <th scope="col" className="px-5 py-3 w-28 text-center">Screens Count</th>
                            <th scope="col" className="px-5 py-3 text-right w-44">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {levels && levels.length > 0 ? (
                            levels.map((level, idx) => {
                              const isEditing = editingLevelId === level.id;
                              return (
                                <tr
                                  key={level.id}
                                  onClick={() => setSelectedLevelId(level.id)}
                                  className="hover:bg-teal-50/20 transition-colors cursor-pointer group"
                                >
                                  <td className="whitespace-nowrap px-5 py-3.5 text-center font-mono font-bold text-teal-650 text-xs">
                                    {level.order}
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveLevel(idx, "up")}
                                        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                                        title="Move Up"
                                      >
                                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === levels.length - 1}
                                        onClick={() => handleMoveLevel(idx, "down")}
                                        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                                        title="Move Down"
                                      >
                                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3.5 font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={editingLevelName}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setEditingLevelName(e.target.value)}
                                        className="w-full max-w-sm rounded-lg border border-gray-200 px-2.5 py-1 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                                        placeholder="Level Name"
                                        autoFocus
                                      />
                                    ) : (
                                      <span>{level.name}</span>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3.5 text-center font-semibold text-xs text-gray-500">
                                    <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-650 ring-1 ring-inset ring-gray-500/10 group-hover:bg-teal-50 group-hover:text-teal-705 transition-colors">
                                      {level.screens?.length || 0} screens
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                    <div className="flex justify-end gap-2.5" onClick={(e) => e.stopPropagation()}>
                                      {isEditing ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveLevelName(level.id)}
                                            className="text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            onClick={handleCancelEditLevel}
                                            className="text-xs font-bold bg-gray-50 text-gray-600 hover:bg-gray-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditLevel(level)}
                                            className="text-xs font-bold text-teal-650 hover:text-teal-900 hover:underline transition-colors cursor-pointer"
                                          >
                                            Rename
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteLevel(level.id)}
                                            className="text-xs font-bold text-red-500 hover:text-red-800 hover:underline transition-colors cursor-pointer"
                                          >
                                            Delete
                                          </button>
                                       
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-5 py-12 text-center text-gray-400 font-medium">
                                No levels added yet. Create one above.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* View 2: Screens Sequence List (selectedLevelId is active, selectedScreenId is null) */}
              {selectedLevelId && !selectedScreenId && (
                (() => {
                  const selectedLevel = levels.find(l => l.id === selectedLevelId);
                  if (!selectedLevel) return null;
                  return (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      
                      {/* Sub-Header / Back button */}
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedLevelId(null)}
                            className="flex items-center gap-1 text-xs font-bold text-teal-650 hover:text-teal-900 border border-teal-100 rounded-lg px-2.5 py-1.5 hover:bg-teal-50/20 transition-all cursor-pointer"
                          >
                            &larr; Back to Levels
                          </button>
                          <h4 className="text-base font-extrabold text-gray-950 flex items-center gap-2">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teal-500 animate-pulse"></span>
                            {selectedLevel.name} Screens Sequence
                          </h4>
                        </div>
                        <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-150">
                          {selectedLevel.screens?.length || 0} total screens
                        </span>
                      </div>

                      {/* Add New Screen Quick Form */}
                      <div className="bg-teal-50/10 p-4 rounded-xl border border-teal-100/50 space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-teal-800">Add New Screen</h5>
                        <form onSubmit={handleAddScreen} className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="text"
                            placeholder="Screen Name (e.g. Screen 1: Welcome / Introduction)"
                            value={newScreenName}
                            onChange={(e) => setNewScreenName(e.target.value)}
                            className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10 bg-white"
                            required
                          />
                          <button
                            type="submit"
                            className="bg-teal-500 flex items-center justify-center gap-1.5 rounded-xl bg-teal-650 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-600 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7-7H5" />
                            </svg>
                            Add Screen
                          </button>
                        </form>
                      </div>

                      {/* Screen List Table / Card layout */}
                      <div className="overflow-hidden rounded-xl border border-gray-150 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-sm text-gray-500">
                            <thead className="bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-600 border-b border-gray-150">
                              <tr>
                                <th scope="col" className="px-5 py-3 w-16 text-center">Order</th>
                                <th scope="col" className="px-5 py-3 w-20 text-center">Move</th>
                                <th scope="col" className="px-5 py-3">Screen Name</th>
                                <th scope="col" className="px-5 py-3 w-40 text-center">Configuration Summary</th>
                                <th scope="col" className="px-5 py-3 text-right w-48">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {selectedLevel.screens && selectedLevel.screens.length > 0 ? (
                                [...selectedLevel.screens]
                                  .sort((a, b) => a.order - b.order)
                                  .map((screen, sIdx) => {
                                    const isScreenEditing = editingScreenId === screen.id;
                                    const imgCount = (screen.imageIds || (screen.imageId ? [screen.imageId] : [])).filter(Boolean).length;
                                    const qCount = (screen.questionIds || (screen.questionId ? [screen.questionId] : [])).filter(Boolean).length;
                                    
                                    return (
                                      <tr
                                        key={screen.id}
                                        onClick={() => setSelectedScreenId(screen.id)}
                                        className="hover:bg-teal-50/20 transition-colors cursor-pointer group"
                                      >
                                        <td className="whitespace-nowrap px-5 py-3.5 text-center font-mono font-bold text-teal-650 text-xs">
                                          {screen.order}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-center">
                                          <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                            <button
                                              type="button"
                                              disabled={sIdx === 0}
                                              onClick={() => handleMoveScreen(sIdx, "up")}
                                              className="p-1 rounded-md text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-30 transition-all cursor-pointer"
                                              title="Move Up"
                                            >
                                              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                              </svg>
                                            </button>
                                            <button
                                              type="button"
                                              disabled={sIdx === (selectedLevel.screens?.length || 0) - 1}
                                              onClick={() => handleMoveScreen(sIdx, "down")}
                                              className="p-1 rounded-md text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-30 transition-all cursor-pointer"
                                              title="Move Down"
                                            >
                                              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </button>
                                          </div>
                                        </td>
                                        <td className="px-5 py-3.5 font-semibold text-gray-900 group-hover:text-teal-700 transition-colors">
                                          {isScreenEditing ? (
                                            <input
                                              type="text"
                                              value={editingScreenName}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditingScreenName(e.target.value)}
                                              className="w-full max-w-sm rounded-lg border border-gray-200 px-2.5 py-1 text-xs outline-none focus:border-teal-500 focus:ring-1"
                                              autoFocus
                                            />
                                          ) : (
                                            <span>{screen.name}</span>
                                          )}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-center text-xs font-medium text-gray-500">
                                          <div className="flex items-center justify-center gap-2">
                                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                                              imgCount > 0 ? "bg-blue-50 text-blue-700 ring-blue-600/10" : "bg-gray-50 text-gray-400 ring-gray-200"
                                            }`}>
                                              {imgCount} / 4 Images
                                            </span>
                                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                                              qCount > 0 ? "bg-teal-50 text-teal-700 ring-teal-600/10" : "bg-gray-50 text-gray-400 ring-gray-200"
                                            }`}>
                                              {qCount} / 4 Questions
                                            </span>
                                          </div>
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                          <div className="flex justify-end gap-2.5" onClick={(e) => e.stopPropagation()}>
                                            {isScreenEditing ? (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSaveScreenName(screen.id)}
                                                  className="text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                                >
                                                  Save
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={handleCancelEditScreen}
                                                  className="text-xs font-bold bg-gray-50 text-gray-600 hover:bg-gray-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                                >
                                                  Cancel
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => handleStartEditScreen(screen)}
                                                  className="text-xs font-bold text-teal-650 hover:text-teal-900 hover:underline transition-colors cursor-pointer"
                                                >
                                                  Rename
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteScreen(screen.id)}
                                                  className="text-xs font-bold text-red-500 hover:text-red-800 hover:underline transition-colors cursor-pointer"
                                                >
                                                  Delete
                                                </button>
            
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                              ) : (
                                <tr>
                                  <td colSpan={5} className="px-5 py-12 text-center text-gray-400 font-medium">
                                    No screens configured for this level. Create one using the form above.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* View 3: Screen Configuration Slots (selectedLevelId is active, selectedScreenId is active) */}
              {selectedLevelId && selectedScreenId && (
                (() => {
                  const selectedLevel = levels.find(l => l.id === selectedLevelId);
                  const screen = selectedLevel?.screens?.find(s => s.id === selectedScreenId);
                  if (!screen) return null;

                  const activeImageIds = screen.imageIds || (screen.imageId ? [screen.imageId] : []);
                  const activeQuestionIds = screen.questionIds || (screen.questionId ? [screen.questionId] : []);
                  const isScreenEditing = editingScreenId === screen.id;

                  return (
                    <div className="space-y-6 border border-teal-100 bg-teal-50/5 p-6 rounded-2xl border-l-4 border-l-teal-500 animate-in fade-in duration-200">
                      
                      {/* View 3 header */}
                      <div className="flex items-center justify-between border-b border-gray-150 pb-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedScreenId(null)}
                            className="flex items-center gap-1 text-xs font-bold text-teal-650 hover:text-teal-900 border border-teal-100 rounded-lg px-2.5 py-1.5 hover:bg-teal-50/20 transition-all cursor-pointer"
                          >
                            &larr; Back to Screens List
                          </button>
                          <div className="flex items-center gap-2">
                            {isScreenEditing ? (
                              <input
                                type="text"
                                value={editingScreenName}
                                onChange={(e) => setEditingScreenName(e.target.value)}
                                className="rounded-lg border border-gray-200 px-3 py-1 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 bg-white font-bold"
                                autoFocus
                              />
                            ) : (
                              <h4 className="text-base font-extrabold text-gray-900">
                                {screen.name}
                              </h4>
                            )}
                            <div className="flex items-center gap-1.5">
                              {isScreenEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveScreenName(screen.id)}
                                    className="text-[10px] font-bold bg-teal-150 text-teal-805 hover:bg-teal-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditScreen}
                                    className="text-[10px] font-bold bg-gray-150 text-gray-650 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditScreen(screen)}
                                  className="text-[10px] font-bold text-teal-600 hover:text-teal-900 transition-colors"
                                >
                                  (Rename)
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2.5 py-1 rounded-full">
                          Order Pos: {screen.order}
                        </span>
                      </div>

                      {/* Main Slots Configurations Form */}
                      <div className="bg-white p-6 rounded-xl border border-gray-150 shadow-sm space-y-6">
                        
                        {/* Images Slot Configuration */}
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-sm font-bold text-gray-900">Assign Screen Images (Max 4)</h5>
                            <p className="text-xs text-gray-500 mt-0.5">Select image assets to display on this screen. Slots align to the layout sequence.</p>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[0, 1, 2, 3].map((idx) => {
                              const currentVal = activeImageIds[idx] || "";
                              return (
                                <div key={idx} className="space-y-1.5 bg-gray-50/50 p-3 rounded-xl border border-gray-200/60">
                                  <div className="flex items-center justify-between">
                                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Slot {idx + 1}</span>
                                    {currentVal && (
                                      <span className="inline-flex h-2 w-2 rounded-full bg-teal-500"></span>
                                    )}
                                  </div>
                                  <ImageSelect
                                    value={currentVal}
                                    onChange={(val) => handleUpdateScreenImage(screen, idx, val)}
                                    images={images}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Image Previews */}
                          {activeImageIds.filter(Boolean).length > 0 && (
                            <div className="pt-2">
                              <span className="block text-xs font-bold text-gray-700 mb-2">Selected Images Preview:</span>
                              <div className="grid grid-cols-4 gap-3 sm:gap-4">
                                {activeImageIds.map((imgId, idx) => {
                                  const imgItem = images.find(img => img.id === imgId);
                                  if (!imgItem) return null;
                                  return (
                                    <div key={imgId + "_" + idx} className="relative group w-full aspect-[16/10] rounded-2xl overflow-hidden border border-gray-250 shadow-md transition-transform hover:scale-[1.02]" title={imgItem.name}>
                                      <img
                                        src={imgItem.url}
                                        alt={imgItem.name}
                                        className="h-full w-full object-cover"
                                      />
                                      <div className="absolute top-1.5 left-1.5 bg-teal-600 text-[10px] font-bold text-white h-5 w-5 rounded-full flex items-center justify-center shadow-sm">
                                        #{idx + 1}
                                      </div>
                                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white px-2 py-1 truncate text-center font-medium">
                                        {imgItem.name}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Questions Slot Configuration */}
                        <div className="border-t border-gray-150 pt-6 space-y-4">
                          <div>
                            <h5 className="text-sm font-bold text-gray-900">Assign Screening Questions (Max 4)</h5>
                            <p className="text-xs text-gray-500 mt-0.5">Select intake or diagnostic questions to present to patients on this screen.</p>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[0, 1, 2, 3].map((idx) => {
                              const currentVal = activeQuestionIds[idx] || "";
                              const voiceEnabled = screen.voiceRecordEnabled?.[idx] || false;
                              return (
                                <div key={idx} className="space-y-2 bg-gray-50/50 p-3 rounded-xl border border-gray-200/60 flex flex-col justify-between">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Question Slot {idx + 1}</span>
                                      {currentVal && (
                                        <span className="inline-flex h-2 w-2 rounded-full bg-teal-500"></span>
                                      )}
                                    </div>
                                    <select
                                      value={currentVal}
                                      onChange={(e) => handleUpdateScreenQuestion(screen, idx, e.target.value)}
                                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none transition-all focus:border-teal-500 focus:ring-1 focus:ring-teal-500/10 bg-white font-medium cursor-pointer"
                                    >
                                      <option value="">-- Empty --</option>
                                      {questions.map((q) => (
                                        <option key={q.id} value={q.id}>
                                          ({q.id}) {q.text.length > 45 ? q.text.substring(0, 45) + "..." : q.text}
                                        </option>
                                      ))}
                                    </select>

                                    {currentVal && (
                                      <div className="space-y-1 mt-1.5">
                                        <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                          Correct Answer Image
                                        </label>
                                        <ImageSlotSelect
                                           value={screen.answers?.[idx] || ""}
                                           onChange={(val) => handleUpdateScreenAnswer(screen, idx, val)}
                                           images={images}
                                           activeImageIds={activeImageIds}
                                         />
                                      </div>
                                    )}
                                  </div>

                                  {/* Voice recording toggle and recorder */}
                                  {currentVal && (
                                    <div className="mt-1.5 space-y-2">
                                      <label className="flex items-center gap-2 text-[11px] text-gray-650 cursor-pointer font-medium select-none">
                                        <input
                                          type="checkbox"
                                          checked={voiceEnabled}
                                          onChange={(e) => handleUpdateScreenVoiceRecord(screen, idx, e.target.checked)}
                                          className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                        />
                                        <span className="flex items-center gap-1">
                                          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                          </svg>
                                          Enable Voice Recording
                                        </span>
                                      </label>

                                      {voiceEnabled && selectedLevelId && (
                                        <VoiceRecorderWidget
                                          levelId={selectedLevelId}
                                          screenId={screen.id}
                                          slotIndex={idx}
                                          initialAudioUrl={screen.voicePromptUrls?.[idx] || ""}
                                          onSaveAudio={(url) => handleUpdateScreenVoicePromptUrl(screen, idx, url)}
                                          onDeleteAudio={() => handleDeleteScreenVoicePromptUrl(screen, idx)}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Questions Previews */}
                          {activeQuestionIds.filter(Boolean).length > 0 && (
                            <div className="pt-2 space-y-2">
                              <span className="block text-xs font-bold text-gray-700">Selected Questions Preview:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {activeQuestionIds.map((qId, idx) => {
                                  const qItem = questions.find(q => q.id === qId);
                                  if (!qItem) return null;
                                  const voiceEnabled = screen.voiceRecordEnabled?.[idx] || false;
                                  const voiceUrl = screen.voicePromptUrls?.[idx] || "";
                                  return (
                                    <div key={qId + "_" + idx} className="p-3 rounded-xl bg-gray-50 border border-gray-150 flex items-start gap-2.5 text-[11px] shadow-2xs">
                                      <span className="bg-teal-100 text-teal-800 font-mono font-extrabold h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        #{idx + 1}
                                      </span>
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[9px] font-mono font-bold text-gray-400 tracking-wider uppercase block">{qItem.id}</span>
                                          {voiceEnabled && (
                                            <div className="flex items-center gap-1.5">
                                              {voiceUrl && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const audio = new Audio(voiceUrl);
                                                    audio.play().catch(e => console.error(e));
                                                  }}
                                                  className="p-1 hover:bg-gray-200 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                                                  title="Play Recorded Prompt"
                                                >
                                                  <svg className="h-3.5 w-3.5 text-teal-650" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                  </svg>
                                                </button>
                                              )}
                                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 select-none animate-pulse">
                                                <svg className="h-2.5 w-2.5 text-red-650" fill="currentColor" viewBox="0 0 24 24">
                                                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                                                </svg>
                                                Voice Record
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <p className="text-gray-700 italic leading-snug">
                                          "{qItem.text}"
                                        </p>
                                        {(() => {
                                          const answerId = screen.answers?.[idx];
                                          if (!answerId) return null;
                                          const foundImg = images.find(img => img.id === answerId);
                                          if (!foundImg) return null;
                                          return (
                                            <div className="flex items-center gap-1.5 mt-2 bg-teal-50 px-2 py-0.5 rounded border border-teal-150 w-fit text-[9px] text-teal-800 font-bold">
                                              <span className="text-gray-400 font-semibold uppercase tracking-wider">Answer:</span>
                                              <img src={foundImg.url} alt={foundImg.name} className="h-4.5 w-4.5 rounded object-contain bg-white border border-gray-200" />
                                              <span>{foundImg.name}</span>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  );
                })()
              )}

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

      {/* Edit Image Name Modal */}
      {isImageEditModalOpen && activeImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsImageEditModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-150 animate-in scale-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit Image Name Label</h3>
              <button
                onClick={() => setIsImageEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateImageName} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Image Name</label>
                <input
                  type="text"
                  required
                  value={imageEditName}
                  onChange={(e) => setImageEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsImageEditModalOpen(false)}
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

    </div>
  );
}
