"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { ServiceUser } from "@/lib/service-user-store";

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
  order: number;
}

interface LevelMetadata {
  id: string;
  name: string;
  order: number;
  screens?: ScreenMetadata[];
}

interface TestPortalClientProps {
  serviceUser: ServiceUser;
  initialLevels: LevelMetadata[];
  images: ImageMetadata[];
  questions: QuestionMetadata[];
}

interface AssessmentResult {
  levelId: string;
  levelName: string;
  screenId: string;
  screenName: string;
  questionIndex: number;
  questionText: string;
  clickedImageId: string;
  clickedImageName: string;
  timestamp: string;
  voiceRecorded?: boolean;
}

export default function TestPortalClient({
  serviceUser,
  initialLevels,
  images,
  questions,
}: TestPortalClientProps) {
  // Sort levels by order
  const sortedLevels = useMemo(() => {
    return [...initialLevels].sort((a, b) => a.order - b.order);
  }, [initialLevels]);

  // Assessment Indices
  const [levelIndex, setLevelIndex] = useState(0);
  const [screenIndex, setScreenIndex] = useState(0);
  const [questionSlotIndex, setQuestionSlotIndex] = useState(0);
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [results, setResults] = useState<AssessmentResult[]>([]);

  // Voice recording state for patient
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceRecordedForCurrent, setVoiceRecordedForCurrent] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Active level/screen helpers
  const activeLevel = sortedLevels[levelIndex];
  const activeScreens = useMemo(() => {
    if (!activeLevel?.screens) return [];
    return [...activeLevel.screens].sort((a, b) => a.order - b.order);
  }, [activeLevel]);

  const activeScreen = activeScreens[screenIndex];

  // Resolve screen questions & images
  const screenQuestions = useMemo(() => {
    if (!activeScreen) return [];
    let list = (activeScreen.questionIds || []).filter((id) => id !== "");
    if (list.length === 0 && activeScreen.questionId) {
      list = [activeScreen.questionId];
    }
    return list.map((qId) => {
      const found = questions.find((q) => q.id === qId);
      return {
        id: qId,
        text: found ? found.text : `Question ID: ${qId} (Text missing)`,
      };
    });
  }, [activeScreen, questions]);

  const screenImages = useMemo(() => {
    if (!activeScreen) return [];
    let list = (activeScreen.imageIds || []).filter((id) => id !== "");
    if (list.length === 0 && activeScreen.imageId) {
      list = [activeScreen.imageId];
    }
    return list.map((imgId) => {
      const found = images.find((i) => i.id === imgId);
      return {
        id: imgId,
        name: found ? found.name : "Missing Image",
        url: found ? found.url : "/favicon.ico",
      };
    });
  }, [activeScreen, images]);

  // Active Screen details
  const activeQuestion = screenQuestions[questionSlotIndex];
  const activeScreenName = activeScreen ? activeScreen.name : "Screen";
  const activeLevelName = activeLevel ? activeLevel.name : "Level";

  // Current voice record settings
  const isVoiceRecordEnabled = useMemo(() => {
    if (!activeScreen || !activeScreen.voiceRecordEnabled) return false;
    return !!activeScreen.voiceRecordEnabled[questionSlotIndex];
  }, [activeScreen, questionSlotIndex]);

  const voicePromptUrl = useMemo(() => {
    if (!activeScreen || !activeScreen.voicePromptUrls) return "";
    return activeScreen.voicePromptUrls[questionSlotIndex] || "";
  }, [activeScreen, questionSlotIndex]);

  // Clean recording timers
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  // Voice recording triggers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        setVoiceRecordedForCurrent(true);
        stream.getTracks().forEach((track) => track.stop());
      };

      setRecordingTime(0);
      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert("Microphone access denied or not available. Continuing with keyboard/mouse inputs.");
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

  // Click on image handler: Records answer and moves forward
  const handleImageClick = (clickedImageId: string, clickedImageName: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // Stop reading current question
    }

    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause(); // Stop network TTS playback
    }

    if (isRecording) {
      // Automatically stop recording if it's currently running
      stopRecording();
    }

    const currentQuestion = screenQuestions[questionSlotIndex];

    // Log assessment result
    const newResult: AssessmentResult = {
      levelId: activeLevel.id,
      levelName: activeLevel.name,
      screenId: activeScreen.id,
      screenName: activeScreen.name,
      questionIndex: questionSlotIndex,
      questionText: currentQuestion ? currentQuestion.text : "Unknown Question",
      clickedImageId,
      clickedImageName,
      timestamp: new Date().toLocaleTimeString(),
      voiceRecorded: voiceRecordedForCurrent,
    };

    setResults((prev) => [...prev, newResult]);
    setVoiceRecordedForCurrent(false); // Reset voice recorder flag

    // Transition to next question, screen or level
    if (questionSlotIndex < screenQuestions.length - 1) {
      // 1. Move to next question on the same screen
      setQuestionSlotIndex((prev) => prev + 1);
    } else {
      // 2. Move to next screen in this level
      if (screenIndex < activeScreens.length - 1) {
        setScreenIndex((prev) => prev + 1);
        setQuestionSlotIndex(0);
      } else {
        // 3. Move to next level
        if (levelIndex < sortedLevels.length - 1) {
          setLevelIndex((prev) => prev + 1);
          setScreenIndex(0);
          setQuestionSlotIndex(0);
        } else {
          // End of assessment
          setAssessmentCompleted(true);
        }
      }
    }
  };

  // Format timer seconds
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Play instruction audio from doctor using HTML5 audio ref
  const playPromptAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }
  };

  // Speak question text aloud using Google Translate TTS proxy (falls back to native TTS if offline)
  const speakQuestion = (text: string) => {
    if (typeof window !== "undefined") {
      try {
        // Cancel native SpeechSynthesis in case it was running
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }

        // Stop any current network TTS audio playing
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
        }

        const cleanText = text.replace(/[*_#`~[\]]/g, "").trim();
        if (!cleanText) return;

        // Use our local API route proxy (bypasses CORS and Referrer policy blocks)
        const encodedText = encodeURIComponent(cleanText);
        const ttsUrl = `/api/tts?text=${encodedText}`;

        if (ttsAudioRef.current) {
          ttsAudioRef.current.src = ttsUrl;
          ttsAudioRef.current.currentTime = 0;
          ttsAudioRef.current.play().catch((err) => {
            console.warn("Proxy TTS playback failed. Falling back to local SpeechSynthesis:", err);
            fallbackLocalTTS(cleanText);
          });
        } else {
          fallbackLocalTTS(cleanText);
        }
      } catch (err) {
        console.error("speakQuestion error:", err);
        const cleanText = text.replace(/[*_#`~[\]]/g, "").trim();
        fallbackLocalTTS(cleanText);
      }
    }
  };

  // Local fallback offline speech synthesis engine
  const fallbackLocalTTS = (cleanText: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "hi-IN";
        
        // Attempt to find a Hindi voice, otherwise fallback to default browser choice for the language
        const voices = window.speechSynthesis.getVoices();
        const hindiVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("hi"));
        if (hindiVoice) {
          utterance.voice = hindiVoice;
        }

        utterance.rate = 0.92;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }, 50);
    }
  };

  // Pre-trigger voice fetching on component mount
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
  }, []);

  // Unified helper to play recorded doctor prompt (if it exists) or local TTS voice
  const playQuestionVoice = () => {
    if (voicePromptUrl) {
      playPromptAudio();
    } else if (activeQuestion) {
      speakQuestion(activeQuestion.text);
    }
  };

  // Automatically read the question aloud (or play recorded voice prompt) when the question slot or screen changes
  useEffect(() => {
    if (!activeQuestion || assessmentCompleted) return;

    const autoPlayTimer = setTimeout(() => {
      playQuestionVoice();
    }, 450); // slight delay to allow rendering transition

    return () => {
      clearTimeout(autoPlayTimer);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [levelIndex, screenIndex, questionSlotIndex, voicePromptUrl, assessmentCompleted]);

  // Render Completed Summary
  if (assessmentCompleted) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6 font-sans">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600 shadow-md">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              Assessment Completed!
            </h1>
            <p className="text-sm text-gray-500">
              Diagnostic test report for <span className="font-bold text-gray-800">{serviceUser.name}</span>
            </p>
          </div>

          {/* Results Summary Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
              <h3 className="font-bold text-gray-900 text-sm">Response Timeline Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Level / Screen</th>
                    <th className="px-6 py-3">Question Text</th>
                    <th className="px-6 py-3">Selected Asset</th>
                    
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {results.map((res, index) => (
                    <tr key={index} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-medium">
                        <div className="text-gray-900 font-bold">{res.levelName}</div>
                        <div className="text-gray-400 text-[10px] mt-0.5">{res.screenName}</div>
                      </td>
                      <td className="px-6 py-3.5 whitespace-pre-wrap max-w-xs">{res.questionText}</td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 font-bold text-teal-800 ring-1 ring-inset ring-teal-600/10">
                          {res.clickedImageName}
                        </span>
                      </td>
                     
                      
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-center">
            <Link
              href="/"
              className="bg-teal-400 inline-flex items-center gap-2 rounded-xl bg-teal-650 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-teal-600 transition-all active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Return to Dashboard Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen max-h-screen overflow-hidden bg-gray-50/50 p-4 sm:p-5 font-sans flex flex-col">
      {voicePromptUrl && (
        <audio ref={audioRef} src={voicePromptUrl} preload="auto" className="hidden" />
      )}
      <audio ref={ttsAudioRef} preload="auto" className="hidden" />
      <div className="mx-auto w-full max-w-4xl h-full flex flex-col gap-3 overflow-hidden">
        
        {/* Top Assessment Control Bar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white rounded-2xl p-3 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-bold text-xs">
              {serviceUser.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Testing Candidate</span>
              <h2 className="text-sm font-bold text-gray-800">{serviceUser.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-semibold text-teal-800 ring-1 ring-inset ring-teal-600/20">
              {activeLevelName}
            </span>
            <Link
              href="/"
              onClick={(e) => {
                if (!window.confirm("Are you sure you want to exit the assessment? Your progress will be lost.")) {
                  e.preventDefault();
                }
              }}
              className="rounded-xl border border-red-200 bg-red-50/40 px-3.5 py-1.5 text-xs font-bold text-red-800 shadow-sm hover:bg-red-50 hover:border-red-350 cursor-pointer"
            >
              Exit Assessment
            </Link>
          </div>
        </div>

        {/* Diagnostic Testing Area */}
        {activeScreen ? (
          <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
            
            {/* Screen Interaction Column */}
            <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
              {/* Question card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2 shrink-0">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-[10px] font-bold text-teal-650 uppercase tracking-wider">
                    {activeScreenName} — Question slot {questionSlotIndex + 1} of {screenQuestions.length}
                  </span>
                  
                  {voicePromptUrl && (
                    <button
                      onClick={playPromptAudio}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 hover:bg-teal-100 cursor-pointer transition-colors"
                      title="Play doctor prompt"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      Listen Instruction
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-md sm:text-lg font-extrabold text-gray-900 whitespace-pre-wrap leading-snug flex-1 animate-in fade-in duration-300">
                    {activeQuestion ? activeQuestion.text : "Configure a question for this slot in Admin panel."}
                  </h3>
                  {activeQuestion && (
                    <button
                      type="button"
                      onClick={playQuestionVoice}
                      className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-650 hover:bg-teal-100 hover:text-teal-700 active:scale-95 transition-all shadow-sm cursor-pointer"
                      title="Play question audio"
                    >
                      <svg className="h-4.5 w-4.5 transition-transform group-hover:scale-105" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Choices Images */}
              <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden py-1">
                {screenImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:gap-2 w-full max-w-2xl mx-auto h-full max-h-[62vh] items-center justify-items-center">
                    {screenImages.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => handleImageClick(img.id, img.name)}
                        className="group w-full max-w-[27vh] h-full max-h-[27vh] aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-teal-400 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center"
                      >
                        <div className="w-full h-full relative overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center">
                          <img
                            src={img.url}
                            alt={img.name}
                            className="h-full w-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-400 w-full shrink-0">
                    <p className="text-xs font-semibold">No images configured for this Screen in Admin panel.</p>
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

            {/* Sidebar info / Speech recording Column */}
            {/* <div className="space-y-6">
            
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4.5">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-2">
                  Assessment Progress
                </h4>
                
              
                <div className="space-y-3.5 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold text-gray-500 mb-1">
                      <span>Testing Levels</span>
                      <span>Level {levelIndex + 1} of {sortedLevels.length}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-300"
                        style={{ width: `${((levelIndex + 1) / sortedLevels.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-gray-500 mb-1">
                      <span>Level Screen Progress</span>
                      <span>Screen {screenIndex + 1} of {activeScreens.length}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-300"
                        style={{ width: `${((screenIndex + 1) / activeScreens.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold text-gray-500 mb-1">
                      <span>Screen Question Progress</span>
                      <span>Q {questionSlotIndex + 1} of {screenQuestions.length}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-300"
                        style={{ width: `${((questionSlotIndex + 1) / (screenQuestions.length || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-teal-50/30 border border-teal-100/50 p-3 text-[11px] text-teal-800 font-semibold flex items-start gap-1.5">
                  <svg className="h-4 w-4 shrink-0 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Clicking any choice image records candidate's click and automatically loads the next item.</span>
                </div>
              </div>

             
              {isVoiceRecordEnabled && (
                <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/15 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                    <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      Voice Response Required
                    </span>
                    {isRecording ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-650 animate-pulse">
                        <span className="h-2 w-2 rounded-full bg-red-600"></span>
                        RECORDING {formatTime(recordingTime)}
                      </span>
                    ) : voiceRecordedForCurrent ? (
                      <span className="text-[10px] font-bold text-teal-700 flex items-center gap-0.5">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Voice Logged
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">Awaiting audio</span>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-500 leading-normal">
                    This question has voice recording enabled. Ask the candidate to speak their response before choosing the image.
                  </p>

                  <div className="flex items-center gap-2">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                        </svg>
                        {voiceRecordedForCurrent ? "Re-record Voice" : "Record Response"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer animate-pulse"
                      >
                        <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                        Stop Recording
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div> */}

          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-400 shrink-0">
            <h3 className="font-bold text-gray-800">No Assessment Screens configured</h3>
            <p className="text-xs mt-1 text-gray-400 max-w-sm mx-auto leading-normal">
              This level has no screens configured. Please set up screens, images, and questions in the Admin Panel settings first.
            </p>
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
  );
}
