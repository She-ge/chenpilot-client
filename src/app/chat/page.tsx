'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store';
import { sendMessage, clearMessages, updateMessage, saveConversationLocally } from '@/store/slices/chatSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ClientOnlyChatLayout } from '@/components/layout/ClientOnlyChatLayout';
import AgentMessage from '@/components/chat/AgentMessage';
import UserMessage from '@/components/chat/UserMessage';
import { 
  Send, 
  Loader2,
  RotateCcw,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Mic,
  Square,
  X,
  Wrench,
  Zap,
  DollarSign,
  Bitcoin,
  Building2,
  Sun,
} from 'lucide-react';
import { formatRelativeTime } from '@/utils/format';
import toast from 'react-hot-toast';

// Speech Recognition types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

function ChatPageContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { messages, isLoading: isChatLoading, isTyping, currentConversation } = useAppSelector((state) => state.chat);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showTools, setShowTools] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [speechResult, setSpeechResult] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save conversation when it changes
  useEffect(() => {
    if (currentConversation && messages.length > 0) {
      dispatch(saveConversationLocally(currentConversation));
    }
  }, [dispatch, currentConversation, messages.length]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          setIsListening(true);
        };

        recognitionRef.current.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setSpeechResult(finalTranscript);
            setInputValue(finalTranscript);
            // Auto-stop recording when final transcript is received
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
          } else {
            setSpeechResult(interimTranscript);
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setIsRecording(false);
          
          let errorMessage = 'Speech recognition failed. ';
          switch (event.error) {
            case 'no-speech':
              errorMessage += 'No speech was detected. Please try again.';
              break;
            case 'audio-capture':
              errorMessage += 'No microphone was found. Please check your microphone.';
              break;
            case 'not-allowed':
              errorMessage += 'Microphone access denied. Please allow microphone access.';
              break;
            case 'network':
              errorMessage += 'Network error occurred. Please check your connection.';
              break;
            default:
              errorMessage += 'Please try again.';
          }
          
          toast.error(errorMessage);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          setIsRecording(false);
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            setRecordingTime(0);
          }
          
          // Clear speech result after a short delay to show the final text
          if (speechResult && speechResult.trim()) {
            toast.success('Speech recognized successfully!');
            setTimeout(() => {
              setSpeechResult('');
            }, 2000);
          }
        };
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isChatLoading) return;

    const message = inputValue.trim();
    setInputValue('');

    try {
      // Include selected tool in the query if one is selected
      const queryWithTool = selectedTool 
        ? `[Using ${selectedTool} tool] ${message}`
        : message;
      
      await dispatch(sendMessage(queryWithTool)).unwrap();
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error || 'Failed to send message');
      toast.error(errorMessage);
    }
  };

  const handleClearChat = () => {
    dispatch(clearMessages());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    dispatch(updateMessage({ id: messageId, updates: { content: newContent } }));
    toast.success('Message updated');
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in this browser');
      return;
    }

    try {
      setSpeechResult('');
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Start speech recognition
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast.error('Failed to start speech recognition');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setIsRecording(false);
    setIsListening(false);
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setRecordingTime(0);
  };

  const toggleVoiceRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const agentTools = [
    { name: 'Soroswap', description: 'Stellar DEX for token swaps', icon: Zap },
    { name: 'Blend', description: 'Lending and borrowing protocol', icon: DollarSign },
    { name: 'Aquarius', description: 'Liquidity pool management', icon: Bitcoin },
    { name: 'Phoenix', description: 'Advanced DeFi operations', icon: Building2 }
  ];

  const handleToolSelect = (toolName: string) => {
    if (selectedTool === toolName) {
      setSelectedTool(null); // Deselect if already selected
    } else {
      setSelectedTool(toolName);
    }
  };

  const suggestedQueries = [
    { text: "What is my current wallet balance?", icon: DollarSign },
    { text: "Show me my recent transactions", icon: Clock },
    { text: "How do I deploy my Stellar account?", icon: Zap },
    { text: "Create a new contact", icon: Copy },
    { text: "Swap 100 USDC to XLM and lend it on Blend", icon: Building2 }
  ];


  if (!isAuthenticated) {
    return (
      <ClientOnlyChatLayout>
        <div className="h-full flex flex-col bg-[#0F0F23] text-white overflow-hidden relative">
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="h-full flex flex-col items-center justify-center p-8">
                <div className="text-center">
                  <p className="text-gray-300">Redirecting to login...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ClientOnlyChatLayout>
    );
  }


  return (
    <ClientOnlyChatLayout>
      <div className="h-full flex flex-col bg-[#0F0F23] text-white overflow-hidden relative">
        {/* Chat Messages */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8">
                {/* Greeting Message */}
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center mb-4">
                    <Sun className="h-8 w-8 text-orange-400 mr-3" />
                    <h2 className="text-2xl font-light text-white">
                      Happy {new Date().toLocaleDateString('en-US', { weekday: 'long' })}, {user?.name || 'User'}
                    </h2>
                  </div>
                  <p className="text-lg text-gray-300">What can we do today?</p>
                </div>

                {/* Chat Input in Middle */}
                <div className="w-full max-w-3xl mb-8">
                  <div className="relative bg-[#1A1A2E] rounded-2xl p-6">
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (inputValue.trim()) {
                            handleSendMessage({ preventDefault: () => {} } as React.FormEvent);
                          }
                        }
                      }}
                      placeholder={isRecording ? "Listening..." : "Ask ChenPilot"}
                      disabled={isChatLoading}
                      className="w-full bg-transparent border-none text-white placeholder:text-gray-500 focus:outline-none text-lg mb-4"
                    />
                    
                    {/* Voice Recording Indicator */}
                    {isRecording && (
                      <div className="absolute right-0 top-0 flex items-center space-x-2 text-red-400">
                        <div className="flex space-x-1">
                          <div className="w-1 h-4 bg-red-400 rounded-full animate-pulse"></div>
                          <div className="w-1 h-4 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-1 h-4 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-xs font-mono">{formatRecordingTime(recordingTime)}</span>
                      </div>
                    )}
                    
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => setShowTools(!showTools)}
                          className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                            selectedTool 
                              ? 'text-purple-300 bg-purple-600/20 border border-purple-500/30' 
                              : 'text-white hover:bg-gray-800/50'
                          }`}
                        >
                          <span className="text-lg">+</span>
                          <span>Tools</span>
                          {selectedTool && (
                            <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded-full">
                              {selectedTool}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (inputValue.trim()) {
                            handleSendMessage({ preventDefault: () => {} } as React.FormEvent);
                          } else {
                            toggleVoiceRecording();
                          }
                        }}
                        disabled={isChatLoading}
                        className={`p-3 rounded-lg transition-colors ${
                          isRecording 
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                            : inputValue.trim() 
                            ? 'text-white hover:bg-gray-800/50' 
                            : 'text-white hover:bg-gray-800/50'
                        }`}
                        title={
                          isRecording 
                            ? "Stop recording" 
                            : inputValue.trim() 
                            ? "Send message" 
                            : "Start voice recording"
                        }
                      >
                        {isRecording ? (
                          <Square className="h-6 w-6" />
                        ) : inputValue.trim() ? (
                          <Send className="h-6 w-6" />
                        ) : (
                          <Mic className="h-6 w-6" />
                        )}
                      </button>
                    </div>
                    
                    {/* Tools Dropdown */}
                    {showTools && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-lg shadow-2xl shadow-black/50 overflow-hidden animate-slide-up">
                        <div className="py-1">
                          {agentTools.map((tool, index) => {
                            const IconComponent = tool.icon;
                            const isSelected = selectedTool === tool.name;
                            return (
                              <button
                                key={index}
                                onClick={() => handleToolSelect(tool.name)}
                                className={`w-full flex items-center space-x-3 px-4 py-2 hover:bg-gray-700/50 transition-all duration-200 text-left ${
                                  isSelected ? 'bg-purple-600/20 border-l-2 border-purple-500' : ''
                                }`}
                              >
                                <div className={`${isSelected ? 'text-purple-400' : 'text-gray-400'}`}>
                                  <IconComponent className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className={`text-sm font-medium ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                                    {tool.name}
                                  </div>
                                  <div className="text-xs text-gray-400">{tool.description}</div>
                                </div>
                                {isSelected && (
                                  <div className="text-purple-400">
                                    <CheckCircle className="h-4 w-4" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          {selectedTool && (
                            <div className="border-t border-gray-700/50 px-4 py-2">
                              <button
                                onClick={() => setSelectedTool(null)}
                                className="text-xs text-gray-400 hover:text-white transition-colors"
                              >
                                Clear selection
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sample Questions */}
                <div className="w-full max-w-2xl">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      "Check wallet balance",
                      "Recent transactions",
                      "Deploy Stellar account",
                      "Create contact",
                      "Swap USDC to XLM",
                      "Bitcoin price"
                    ].map((question, index) => (
                      <button
                        key={index}
                        onClick={() => setInputValue(question)}
                        className="text-left px-3 py-2 bg-transparent border border-gray-600/30 rounded-lg hover:border-gray-500/50 transition-all duration-200 text-gray-300 hover:text-white"
                      >
                        <span className="text-xs font-medium">{question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
          ) : (
              <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.type === 'user' ? (
                    <UserMessage 
                      message={message} 
                      onCopy={copyToClipboard}
                      onEdit={handleEditMessage}
                    />
                  ) : (
                    <div className="max-w-2xl w-full">
                      <AgentMessage message={message} onCopy={copyToClipboard} />
                    </div>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                        <span className="text-sm text-gray-400">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
          </div>
        </div>
        
        {/* Bottom Input Area - Only show when there are messages */}
        {messages.length > 0 && (
          <div className="relative z-10">
            <div className="max-w-4xl mx-auto px-4 py-6">
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <div className="relative bg-[#1A1A2E] rounded-2xl p-6">
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (inputValue.trim()) {
                            handleSendMessage({ preventDefault: () => {} } as React.FormEvent);
                          }
                        }
                      }}
                      placeholder={isRecording ? "Listening..." : "Ask ChenPilot"}
                      disabled={isChatLoading}
                      className="w-full bg-transparent border-none text-white placeholder:text-gray-500 focus:outline-none text-lg mb-4"
                    />
                    
                    {/* Voice Recording Indicator */}
                    {isRecording && (
                      <div className="absolute right-0 top-0 flex items-center space-x-2 text-red-400">
                        <div className="flex space-x-1">
                          <div className="w-1 h-4 bg-red-400 rounded-full animate-pulse"></div>
                          <div className="w-1 h-4 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-1 h-4 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-xs font-mono">{formatRecordingTime(recordingTime)}</span>
                      </div>
                    )}
                    
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => setShowTools(!showTools)}
                          className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                            selectedTool 
                              ? 'text-purple-300 bg-purple-600/20 border border-purple-500/30' 
                              : 'text-white hover:bg-gray-800/50'
                          }`}
                        >
                          <span className="text-lg">+</span>
                          <span>Tools</span>
                          {selectedTool && (
                            <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded-full">
                              {selectedTool}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (inputValue.trim()) {
                            handleSendMessage({ preventDefault: () => {} } as React.FormEvent);
                          } else {
                            toggleVoiceRecording();
                          }
                        }}
                        disabled={isChatLoading}
                        className={`p-3 rounded-lg transition-colors ${
                          isRecording 
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                            : inputValue.trim() 
                            ? 'text-white hover:bg-gray-800/50' 
                            : 'text-white hover:bg-gray-800/50'
                        }`}
                        title={
                          isRecording 
                            ? "Stop recording" 
                            : inputValue.trim() 
                            ? "Send message" 
                            : "Start voice recording"
                        }
                      >
                        {isRecording ? (
                          <Square className="h-6 w-6" />
                        ) : inputValue.trim() ? (
                          <Send className="h-6 w-6" />
                        ) : (
                          <Mic className="h-6 w-6" />
                        )}
                      </button>
                    </div>
                    
                    {/* Tools Dropdown */}
                    {showTools && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-lg shadow-2xl shadow-black/50 overflow-hidden animate-slide-up">
                        <div className="py-1">
                          {agentTools.map((tool, index) => {
                            const IconComponent = tool.icon;
                            const isSelected = selectedTool === tool.name;
                            return (
                              <button
                                key={index}
                                onClick={() => handleToolSelect(tool.name)}
                                className={`w-full flex items-center space-x-3 px-4 py-2 hover:bg-gray-700/50 transition-all duration-200 text-left ${
                                  isSelected ? 'bg-purple-600/20 border-l-2 border-purple-500' : ''
                                }`}
                              >
                                <div className={`${isSelected ? 'text-purple-400' : 'text-gray-400'}`}>
                                  <IconComponent className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className={`text-sm font-medium ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                                    {tool.name}
                                  </div>
                                  <div className="text-xs text-gray-400">{tool.description}</div>
                                </div>
                                {isSelected && (
                                  <div className="text-purple-400">
                                    <CheckCircle className="h-4 w-4" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          {selectedTool && (
                            <div className="border-t border-gray-700/50 px-4 py-2">
                              <button
                                onClick={() => setSelectedTool(null)}
                                className="text-xs text-gray-400 hover:text-white transition-colors"
                              >
                                Clear selection
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


      </div>
    </ClientOnlyChatLayout>
  );
}

export default ChatPageContent;

<style jsx>{`
  @keyframes frequency-wave {
    0%, 100% { 
      transform: scaleY(0.3);
      opacity: 0.7;
    }
    50% { 
      transform: scaleY(1);
      opacity: 1;
    }
  }
  
  @keyframes shine {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  @keyframes border-shine {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  @keyframes slide-up {
    0% {
      transform: translateY(10px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .frequency-bar {
    animation: frequency-wave 1.5s ease-in-out infinite;
  }
  
  .animate-shine {
    animation: shine 2s ease-in-out infinite;
  }
  
  .animate-border-shine {
    animation: border-shine 3s linear infinite;
  }
  
  .animate-slide-up {
    animation: slide-up 0.2s ease-out;
  }
`}</style>