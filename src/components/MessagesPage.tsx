import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  MessageSquare, Send, Search, Plus, Users, User, Archive, 
  RotateCcw, Info, X, Edit3, Trash2, Check, 
  Code, Smile, Shield, CornerDownLeft, Filter 
} from 'lucide-react';
import './MessagesPage.css';
import chatSignalR, { type SignalRConnectionStatus, type TypingNotification } from '../services/chatSignalR';

const API = 'http://localhost:5000/api';

export interface Participant {
  userId: number;
  userName: string | null;
  lastReadAt?: string | null;
  joinedAt?: string;
}

export interface LastMessage {
  id: number;
  content: string;
  messageType: string;
  createdAt: string;
  senderId: number;
  senderName: string | null;
  isDeleted?: boolean;
}

export interface Conversation {
  id: number;
  type: 'Direct' | 'Team';
  name: string | null;
  workspaceId: number | null;
  status: 'Active' | 'Archived';
  updatedAt: string;
  lastReadAt: string | null;
  unreadCount: number;
  lastMessage: LastMessage | null;
  participants: Participant[];
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string | null;
  content: string;
  messageType: string;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
}

export interface ContactUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  department: string | null;
  university: string | null;
  directConversationId: number | null;
}

export interface WorkspaceOption {
  id: number;
  name: string;
  description: string | null;
}

export interface SearchResultMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string | null;
  content: string;
  messageType: string;
  createdAt: string;
}

const QUICK_EMOJIS = ['👍', '🚀', '💡', '👏', '❤️', '🔬', '🤝', '🎉'];

const MessagesPage: React.FC = () => {
  // Current user info
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id ?? -1;

  // Conversations State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [loadingConversations, setLoadingConversations] = useState<boolean>(true);
  const [totalUnread, setTotalUnread] = useState<number>(0);

  // SignalR Real-Time State
  const [signalRStatus, setSignalRStatus] = useState<SignalRConnectionStatus>('Disconnected');
  const [peerTyping, setPeerTyping] = useState<TypingNotification | null>(null);
  const activeConvIdRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const userTypingDebounceRef = useRef<number | null>(null);

  // Filter & Search in sidebar
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'direct' | 'team' | 'archived'>('all');
  const [sidebarSearch, setSidebarSearch] = useState<string>('');

  // Active Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [inConvSearch, setInConvSearch] = useState<string>('');
  const [showInConvSearchBar, setShowInConvSearchBar] = useState<boolean>(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState<boolean>(false);

  // Message Composer
  const [composerText, setComposerText] = useState<string>('');
  const [composerType, setComposerType] = useState<'Text' | 'Code'>('Text');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);

  // Message Inline Editing
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingMsgText, setEditingMsgText] = useState<string>('');

  // Modals
  const [showDirectModal, setShowDirectModal] = useState<boolean>(false);
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState<boolean>(false);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState<boolean>(false);

  // Contacts & Workspaces data for modals
  const [contacts, setContacts] = useState<ContactUser[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState<string>('');
  const [loadingContacts, setLoadingContacts] = useState<boolean>(false);
  const [userWorkspaces, setUserWorkspaces] = useState<WorkspaceOption[]>([]);

  // Team conversation form
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [newTeamWorkspaceId, setNewTeamWorkspaceId] = useState<number | null>(null);
  const [newTeamSelectedUsers, setNewTeamSelectedUsers] = useState<number[]>([]);

  // Global search messages
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [globalSearchResults, setGlobalSearchResults] = useState<SearchResultMessage[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState<boolean>(false);

  // Add participant to active team chat
  const [selectedNewParticipantId, setSelectedNewParticipantId] = useState<number | null>(null);

  // Viewport scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Helper to get conversation display title
  const getConversationTitle = (c: Conversation): string => {
    if (c.type === 'Team') {
      return c.name || 'Team Conversation';
    }
    const other = c.participants.find(p => p.userId !== currentUserId);
    return other?.userName || (c.name || 'Direct Message');
  };

  // Helper to format date
  const formatTimeOrDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format date separators
  const formatDateSeparator = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Fetch all user conversations
  const fetchConversations = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoadingConversations(true);
    try {
      const res = await fetch(`${API}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  };

  // Fetch total unread count
  const fetchTotalUnread = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/chat/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTotalUnread(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching total unread count:', err);
    }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (convId: number, silent = false) => {
    if (!token) return;
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(`${API}/chat/conversations/${convId}/messages?page=1&pageSize=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        setMessages(data);
        if (!silent) {
          setTimeout(() => scrollToBottom('auto'), 80);
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  // Mark conversation as read
  const markAsRead = async (convId: number) => {
    if (!token) return;
    try {
      await fetch(`${API}/chat/conversations/${convId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // update local state
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
      fetchTotalUnread();
    } catch (err) {
      console.error('Error marking conversation read:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
    fetchTotalUnread();
  }, [token]);

  // SignalR connection setup and real-time event listeners
  useEffect(() => {
    if (!token) return;

    // Listen to connection status changes
    const unsubStatus = chatSignalR.onStatusChange(status => {
      setSignalRStatus(status);
    });

    // Start Hub Connection
    chatSignalR.startConnection();

    // Event: Receive real-time message
    const unsubMsg = chatSignalR.onReceiveMessage((newMsg: ChatMessage) => {
      if (newMsg.conversationId === activeConvIdRef.current) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom('smooth'), 40);
      }

      // Update conversation in list
      setConversations(prev => {
        const conv = prev.find(c => c.id === newMsg.conversationId);
        if (!conv) {
          fetchConversations(true);
          return prev;
        }
        const isCurrentActive = newMsg.conversationId === activeConvIdRef.current;
        const isSelf = newMsg.senderId === currentUserId;
        const updatedConv: Conversation = {
          ...conv,
          updatedAt: newMsg.createdAt,
          unreadCount: isCurrentActive || isSelf ? 0 : conv.unreadCount + 1,
          lastMessage: newMsg
        };
        return [updatedConv, ...prev.filter(c => c.id !== newMsg.conversationId)];
      });
      fetchTotalUnread();
    });

    // Event: Message edited in real time
    const unsubEdit = chatSignalR.onMessageEdited((data) => {
      if (data.conversationId === activeConvIdRef.current) {
        setMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content, editedAt: data.editedAt } : m));
      }
      setConversations(prev => prev.map(c => {
        if (c.id === data.conversationId && c.lastMessage?.id === data.id) {
          return {
            ...c,
            lastMessage: { ...c.lastMessage, content: data.content }
          };
        }
        return c;
      }));
    });

    // Event: Message deleted in real time
    const unsubDel = chatSignalR.onMessageDeleted((data) => {
      if (data.conversationId === activeConvIdRef.current) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isDeleted: true, content: '[Message deleted]' } : m));
      }
      setConversations(prev => prev.map(c => {
        if (c.id === data.conversationId && c.lastMessage?.id === data.messageId) {
          return {
            ...c,
            lastMessage: { ...c.lastMessage, isDeleted: true, content: '[Message deleted]' }
          };
        }
        return c;
      }));
    });

    // Event: Peer user typing in real time
    const unsubTyping = chatSignalR.onUserTyping((data: TypingNotification) => {
      if (data.conversationId === activeConvIdRef.current && data.userId !== currentUserId) {
        if (data.isTyping) {
          setPeerTyping(data);
          if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => {
            setPeerTyping(null);
          }, 3500);
        } else {
          setPeerTyping(null);
        }
      }
    });

    // Event: Conversation updated
    const unsubConvUp = chatSignalR.onConversationUpdated((data) => {
      setConversations(prev => {
        const conv = prev.find(c => c.id === data.conversationId);
        if (!conv) {
          fetchConversations(true);
          return prev;
        }
        return [{ ...conv, lastMessage: data.lastMessage, updatedAt: data.lastMessage?.createdAt || conv.updatedAt }, ...prev.filter(c => c.id !== data.conversationId)];
      });
    });

    return () => {
      unsubStatus();
      unsubMsg();
      unsubEdit();
      unsubDel();
      unsubTyping();
      unsubConvUp();
      chatSignalR.stopConnection();
    };
  }, [token, currentUserId]);

  // Keep activeConvIdRef synchronized and manage SignalR room join/leave
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
    setPeerTyping(null);

    if (activeConvId) {
      chatSignalR.joinConversation(activeConvId);
      fetchMessages(activeConvId);
      markAsRead(activeConvId);
    }

    return () => {
      if (activeConvId) {
        chatSignalR.leaveConversation(activeConvId);
      }
    };
  }, [activeConvId, signalRStatus]);

  // Periodic polling for conversations list and total unread
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
      fetchTotalUnread();
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  // Safety periodic polling for active conversation messages (heartbeat when SignalR is connected)
  useEffect(() => {
    if (!activeConvId) return;
    const pollInterval = signalRStatus === 'Connected' ? 15000 : 3500;
    const interval = setInterval(() => {
      fetchMessages(activeConvId, true);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [activeConvId, signalRStatus]);

  // Load Contacts when opening Direct or Team modals
  const fetchContacts = async (query = '') => {
    if (!token) return;
    setLoadingContacts(true);
    try {
      const q = encodeURIComponent(query);
      const res = await fetch(`${API}/chat/contacts${q ? `?search=${q}` : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: ContactUser[] = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Load user workspaces for Team modal
  const fetchUserWorkspaces = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/chat/workspaces`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: WorkspaceOption[] = await res.json();
        setUserWorkspaces(data);
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    }
  };

  // Handle Send Message (over SignalR first with HTTP fallback)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConvId || !composerText.trim() || sendingMessage || !token) return;

    setSendingMessage(true);
    const textToSend = composerText.trim();
    const typeToSend = composerType;

    // Clear typing state
    chatSignalR.sendTyping(activeConvId, false);

    try {
      let sentSuccessfully = false;

      // Try sending via SignalR if connected
      if (signalRStatus === 'Connected') {
        sentSuccessfully = await chatSignalR.sendMessage(activeConvId, textToSend, typeToSend);
      }

      // If SignalR failed or not connected, use HTTP POST fallback
      if (!sentSuccessfully) {
        const res = await fetch(`${API}/chat/conversations/${activeConvId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content: textToSend,
            messageType: typeToSend
          })
        });
        if (res.ok) {
          sentSuccessfully = true;
          await fetchMessages(activeConvId, true);
          fetchConversations(true);
        }
      }

      if (sentSuccessfully) {
        setComposerText('');
        setComposerType('Text');
        setShowEmojiPicker(false);
        await fetchMessages(activeConvId, true);
        fetchConversations(true);
        setTimeout(() => scrollToBottom('smooth'), 50);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle composer text change with typing indicator broadcast
  const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setComposerText(val);

    if (activeConvId && signalRStatus === 'Connected') {
      chatSignalR.sendTyping(activeConvId, true);

      if (userTypingDebounceRef.current) {
        window.clearTimeout(userTypingDebounceRef.current);
      }
      userTypingDebounceRef.current = window.setTimeout(() => {
        if (activeConvIdRef.current) {
          chatSignalR.sendTyping(activeConvIdRef.current, false);
        }
      }, 2500);
    }
  };

  // Handle Message Edit Save
  const handleSaveEdit = async (msgId: number) => {
    if (!activeConvId || !editingMsgText.trim() || !token) return;
    try {
      const res = await fetch(`${API}/chat/conversations/${activeConvId}/messages/${msgId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: editingMsgText.trim()
        })
      });
      if (res.ok) {
        setEditingMsgId(null);
        setEditingMsgText('');
        fetchMessages(activeConvId, true);
        fetchConversations(true);
      }
    } catch (err) {
      console.error('Error editing message:', err);
    }
  };

  // Handle Message Soft Delete
  const handleDeleteMessage = async (msgId: number) => {
    if (!activeConvId || !token) return;
    const confirmed = window.confirm('Are you sure you want to delete this message?');
    if (!confirmed) return;

    try {
      const res = await fetch(`${API}/chat/conversations/${activeConvId}/messages/${msgId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMessages(activeConvId, true);
        fetchConversations(true);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  // Handle Archive / Unarchive
  const handleToggleArchive = async (convId: number, currentStatus: string) => {
    if (!token) return;
    const endpoint = currentStatus === 'Archived' ? 'unarchive' : 'archive';
    try {
      const res = await fetch(`${API}/chat/conversations/${convId}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchConversations(true);
      }
    } catch (err) {
      console.error(`Error toggling archive on conversation ${convId}:`, err);
    }
  };

  // Handle Start Direct Chat
  const handleStartDirectChat = async (targetUserId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/chat/conversations/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });
      if (res.ok) {
        const data = await res.json();
        setShowDirectModal(false);
        await fetchConversations(true);
        setActiveConvId(data.id);
      }
    } catch (err) {
      console.error('Error starting direct chat:', err);
    }
  };

  // Handle Create Team Chat
  const handleCreateTeamChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTeamName.trim()) return;

    try {
      const res = await fetch(`${API}/chat/conversations/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newTeamName.trim(),
          workspaceId: newTeamWorkspaceId,
          participantIds: newTeamSelectedUsers
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNewTeamName('');
        setNewTeamWorkspaceId(null);
        setNewTeamSelectedUsers([]);
        setShowTeamModal(false);
        await fetchConversations(true);
        setActiveConvId(data.id);
      }
    } catch (err) {
      console.error('Error creating team chat:', err);
    }
  };

  // Handle Add Participant to Team Chat
  const handleAddParticipant = async () => {
    if (!activeConvId || !selectedNewParticipantId || !token) return;
    try {
      const res = await fetch(`${API}/chat/conversations/${activeConvId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newUserId: selectedNewParticipantId })
      });
      if (res.ok) {
        setShowAddParticipantModal(false);
        setSelectedNewParticipantId(null);
        fetchConversations(true);
      }
    } catch (err) {
      console.error('Error adding participant:', err);
    }
  };

  // Handle Remove Participant from Team Chat
  const handleRemoveParticipant = async (participantUserId: number) => {
    if (!activeConvId || !token) return;
    const confirmed = window.confirm('Remove this participant from the team conversation?');
    if (!confirmed) return;

    try {
      const res = await fetch(`${API}/chat/conversations/${activeConvId}/participants/${participantUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchConversations(true);
      }
    } catch (err) {
      console.error('Error removing participant:', err);
    }
  };

  // Handle Global Search
  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !globalSearchQuery.trim() || globalSearchQuery.trim().length < 2) return;
    setSearchingGlobal(true);
    try {
      const res = await fetch(`${API}/chat/search?q=${encodeURIComponent(globalSearchQuery.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: SearchResultMessage[] = await res.json();
        setGlobalSearchResults(data);
      }
    } catch (err) {
      console.error('Error searching messages:', err);
    } finally {
      setSearchingGlobal(false);
    }
  };

  // Filtered conversations list
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      // Type / Status filter
      if (sidebarFilter === 'direct' && c.type !== 'Direct') return false;
      if (sidebarFilter === 'team' && c.type !== 'Team') return false;
      if (sidebarFilter === 'archived' && c.status !== 'Archived') return false;
      if (sidebarFilter !== 'archived' && c.status === 'Archived') return false;

      // Text search
      if (sidebarSearch.trim()) {
        const query = sidebarSearch.toLowerCase();
        const title = getConversationTitle(c).toLowerCase();
        const lastMsg = c.lastMessage?.content?.toLowerCase() || '';
        return title.includes(query) || lastMsg.includes(query);
      }
      return true;
    });
  }, [conversations, sidebarFilter, sidebarSearch, currentUserId]);

  // Active conversation object
  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConvId) || null;
  }, [conversations, activeConvId]);

  // Filtered messages inside active conversation
  const displayedMessages = useMemo(() => {
    if (!inConvSearch.trim()) return messages;
    const query = inConvSearch.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(query) || m.senderName?.toLowerCase().includes(query));
  }, [messages, inConvSearch]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: ChatMessage[] }[] = [];
    let currentDate = '';

    displayedMessages.forEach(msg => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.createdAt, msgs: [msg] });
      } else {
        groups[groups.length - 1].msgs.push(msg);
      }
    });

    return groups;
  }, [displayedMessages]);

  return (
    <div id="chat-page-container" className="chat-page-container">
      {/* ==================================================================== */}
      {/* Left Column: Conversations List Pane                                */}
      {/* ==================================================================== */}
      <aside id="chat-conversations-pane" className="chat-conversations-pane">
        <div id="chat-pane-header" className="chat-pane-header">
          <div className="chat-header-top-row">
            <div className="chat-title-wrapper">
              <h2 className="chat-main-title">
                <MessageSquare size={22} color="#38bdf8" /> Chats
              </h2>
              {totalUnread > 0 && (
                <span id="badge-total-unread" className="chat-unread-badge-total">
                  {totalUnread}
                </span>
              )}
              <div
                id="badge-signalr-status"
                className={`chat-signalr-status-badge ${signalRStatus.toLowerCase()}`}
                title={`SignalR Real-Time status: ${signalRStatus}`}
              >
                <span className="signalr-dot" />
                <span id="text-signalr-status">
                  {signalRStatus === 'Connected' ? 'Live' : signalRStatus}
                </span>
              </div>
            </div>

            <div className="chat-header-actions">
              <button
                id="btn-new-direct-chat"
                className="chat-icon-btn"
                title="New Direct Message"
                onClick={() => {
                  fetchContacts();
                  setShowDirectModal(true);
                }}
              >
                <User size={17} />
              </button>
              <button
                id="btn-new-team-chat"
                className="chat-icon-btn"
                title="New Team Conversation"
                onClick={() => {
                  fetchContacts();
                  fetchUserWorkspaces();
                  setShowTeamModal(true);
                }}
              >
                <Users size={17} />
              </button>
              <button
                id="btn-search-all-messages"
                className="chat-icon-btn"
                title="Search All Messages"
                onClick={() => {
                  setGlobalSearchQuery('');
                  setGlobalSearchResults([]);
                  setShowGlobalSearchModal(true);
                }}
              >
                <Search size={17} />
              </button>
            </div>
          </div>

          {/* Search conversations input */}
          <div className="chat-search-bar">
            <Search size={15} className="chat-search-icon" />
            <input
              id="input-search-conversations"
              type="text"
              className="chat-search-input"
              placeholder="Search conversations..."
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="chat-filter-tabs">
          <button
            id="tab-filter-all"
            className={`chat-filter-tab ${sidebarFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSidebarFilter('all')}
          >
            All
          </button>
          <button
            id="tab-filter-direct"
            className={`chat-filter-tab ${sidebarFilter === 'direct' ? 'active' : ''}`}
            onClick={() => setSidebarFilter('direct')}
          >
            Direct
          </button>
          <button
            id="tab-filter-team"
            className={`chat-filter-tab ${sidebarFilter === 'team' ? 'active' : ''}`}
            onClick={() => setSidebarFilter('team')}
          >
            Team
          </button>
          <button
            id="tab-filter-archived"
            className={`chat-filter-tab ${sidebarFilter === 'archived' ? 'active' : ''}`}
            onClick={() => setSidebarFilter('archived')}
          >
            Archived
          </button>
        </div>

        {/* Conversations Scrollable List */}
        <div id="conversations-list" className="chat-conversations-list">
          {loadingConversations ? (
            <div className="chat-list-empty">
              <div className="chat-list-empty-icon">
                <MessageSquare size={22} />
              </div>
              <span>Loading conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="chat-list-empty">
              <div className="chat-list-empty-icon">
                <Filter size={22} />
              </div>
              <span style={{ fontWeight: 600, color: '#94a3b8' }}>No conversations found</span>
              <p style={{ fontSize: '0.78rem', margin: 0 }}>
                {sidebarFilter === 'archived'
                  ? 'No archived conversations.'
                  : 'Start a direct chat or create a team to begin.'}
              </p>
              {sidebarFilter !== 'archived' && (
                <button
                  id="btn-empty-start-direct"
                  className="chat-btn-primary"
                  style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
                  onClick={() => {
                    fetchContacts();
                    setShowDirectModal(true);
                  }}
                >
                  <Plus size={14} /> New Chat
                </button>
              )}
            </div>
          ) : (
            filteredConversations.map(conv => {
              const title = getConversationTitle(conv);
              const isActive = conv.id === activeConvId;
              const hasUnread = conv.unreadCount > 0;
              const initialLetter = title.charAt(0).toUpperCase();

              return (
                <div
                  key={conv.id}
                  id={`conv-item-${conv.id}`}
                  className={`conv-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveConvId(conv.id)}
                >
                  <div className="conv-avatar-wrapper">
                    <div
                      className={`conv-avatar ${conv.type === 'Team' ? 'team' : ''} ${conv.status === 'Archived' ? 'archived' : ''}`}
                    >
                      {conv.type === 'Team' ? <Users size={18} /> : initialLetter}
                    </div>
                    {conv.type === 'Direct' && conv.status === 'Active' && (
                      <span className="conv-status-dot" />
                    )}
                  </div>

                  <div className="conv-body">
                    <div className="conv-top-line">
                      <h4 className="conv-title">{title}</h4>
                      <span className="conv-time">
                        {conv.lastMessage?.createdAt
                          ? formatTimeOrDate(conv.lastMessage.createdAt)
                          : formatTimeOrDate(conv.updatedAt)}
                      </span>
                    </div>

                    <div className="conv-bottom-line">
                      <p
                        className={`conv-last-msg ${hasUnread ? 'unread' : ''} ${conv.lastMessage?.isDeleted ? 'deleted' : ''}`}
                      >
                        {conv.lastMessage ? (
                          <>
                            {conv.lastMessage.senderId === currentUserId && 'You: '}
                            {conv.lastMessage.content}
                          </>
                        ) : (
                          'No messages yet'
                        )}
                      </p>

                      <div className="conv-badges">
                        {hasUnread && (
                          <span id={`unread-badge-${conv.id}`} className="conv-unread-pill">
                            {conv.unreadCount}
                          </span>
                        )}
                        {conv.status === 'Archived' && (
                          <span className="conv-archived-pill">Archived</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hover action menu for quick archive/unarchive */}
                  <div className="conv-actions-hover" onClick={e => e.stopPropagation()}>
                    <button
                      id={`btn-conv-archive-${conv.id}`}
                      className="conv-action-mini-btn"
                      title={conv.status === 'Archived' ? 'Unarchive' : 'Archive'}
                      onClick={() => handleToggleArchive(conv.id, conv.status)}
                    >
                      {conv.status === 'Archived' ? <RotateCcw size={14} /> : <Archive size={14} />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* Center Column: Active Chat & Messages Pane                          */}
      {/* ==================================================================== */}
      <main id="chat-active-pane" className="chat-active-pane">
        {activeConversation ? (
          <>
            {/* Active Conversation Header */}
            <header id="chat-active-header" className="chat-active-header">
              <div className="chat-header-left">
                <div className={`chat-header-avatar ${activeConversation.type === 'Team' ? 'team' : ''}`}>
                  {activeConversation.type === 'Team' ? (
                    <Users size={22} />
                  ) : (
                    getConversationTitle(activeConversation).charAt(0).toUpperCase()
                  )}
                </div>

                <div className="chat-header-details">
                  <div className="chat-header-title-row">
                    <h3 id="active-conv-title" className="active-conv-title">
                      {getConversationTitle(activeConversation)}
                    </h3>
                    <span
                      id="badge-conv-type"
                      className={`badge-conv-type ${activeConversation.type === 'Direct' ? 'direct' : 'team'}`}
                    >
                      {activeConversation.type}
                    </span>
                    {activeConversation.status === 'Archived' && (
                      <span id="badge-conv-status" className="badge-conv-status archived">
                        Archived
                      </span>
                    )}
                    {activeConversation.workspaceId && (
                      <span id="tag-conv-workspace" className="tag-conv-workspace" title="Associated Workspace">
                        <Shield size={12} /> Workspace #{activeConversation.workspaceId}
                      </span>
                    )}
                  </div>

                  <p className="chat-header-subtitle">
                    {activeConversation.type === 'Team'
                      ? `${activeConversation.participants.length} participants: ` +
                        activeConversation.participants.map(p => p.userName || 'Member').join(', ')
                      : 'Direct 1-on-1 Research Collaboration'}
                  </p>
                </div>
              </div>

              <div className="chat-header-right">
                <button
                  id="btn-search-in-conv"
                  className="chat-icon-btn"
                  title="Search inside this conversation"
                  onClick={() => {
                    setShowInConvSearchBar(prev => !prev);
                    if (showInConvSearchBar) setInConvSearch('');
                  }}
                >
                  <Search size={17} />
                </button>

                {activeConversation.type === 'Team' && activeConversation.status !== 'Archived' && (
                  <button
                    id="btn-add-participant"
                    className="chat-icon-btn"
                    title="Add Member to Team"
                    onClick={() => {
                      fetchContacts();
                      setShowAddParticipantModal(true);
                    }}
                  >
                    <Plus size={18} />
                  </button>
                )}

                <button
                  id="btn-archive-active"
                  className="chat-icon-btn"
                  title={activeConversation.status === 'Archived' ? 'Unarchive Conversation' : 'Archive Conversation'}
                  onClick={() => handleToggleArchive(activeConversation.id, activeConversation.status)}
                >
                  {activeConversation.status === 'Archived' ? <RotateCcw size={17} /> : <Archive size={17} />}
                </button>

                <button
                  id="btn-toggle-info"
                  className="chat-icon-btn"
                  title="Conversation Info & Members"
                  onClick={() => setShowInfoDrawer(prev => !prev)}
                >
                  <Info size={17} />
                </button>
              </div>
            </header>

            {/* In-conversation Search Filter Bar */}
            {showInConvSearchBar && (
              <div id="bar-search-in-conv" className="bar-search-in-conv">
                <Search size={15} color="#94a3b8" />
                <input
                  id="input-search-in-conv"
                  type="text"
                  className="search-in-conv-input"
                  placeholder="Filter messages in this conversation..."
                  value={inConvSearch}
                  onChange={e => setInConvSearch(e.target.value)}
                  autoFocus
                />
                <button
                  id="btn-clear-in-conv-search"
                  className="chat-icon-btn"
                  style={{ width: '28px', height: '28px' }}
                  onClick={() => {
                    setInConvSearch('');
                    setShowInConvSearchBar(false);
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Messages Viewport */}
            <div id="chat-messages-viewport" className="chat-messages-viewport">
              {loadingMessages ? (
                <div className="chat-list-empty" style={{ margin: 'auto' }}>
                  <div className="chat-list-empty-icon">
                    <MessageSquare size={24} />
                  </div>
                  <span>Loading messages...</span>
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="chat-list-empty" style={{ margin: 'auto' }}>
                  <div className="chat-list-empty-icon">
                    <MessageSquare size={26} color="#38bdf8" />
                  </div>
                  <h4 style={{ color: '#fff', margin: 0 }}>
                    {inConvSearch ? 'No matching messages found' : 'No messages yet'}
                  </h4>
                  <p style={{ fontSize: '0.85rem' }}>
                    {inConvSearch
                      ? 'Try adjusting your search query.'
                      : 'Send a message below to kick off the research conversation!'}
                  </p>
                </div>
              ) : (
                groupedMessages.map(group => (
                  <React.Fragment key={group.date}>
                    <div className="chat-date-separator">
                      <span className="chat-date-badge">{formatDateSeparator(group.date)}</span>
                    </div>

                    {group.msgs.map(msg => {
                      const isOutgoing = msg.senderId === currentUserId;
                      const isCode = msg.messageType === 'Code';
                      const isSystem = msg.messageType === 'System';
                      const isEditing = editingMsgId === msg.id;
                      const senderInitial = (msg.senderName || 'U').charAt(0).toUpperCase();

                      if (isSystem) {
                        return (
                          <div key={msg.id} id={`msg-item-${msg.id}`} className="msg-row system">
                            <div className="msg-bubble system">{msg.content}</div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          id={`msg-item-${msg.id}`}
                          className={`msg-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
                        >
                          {!isOutgoing && <div className="msg-avatar">{senderInitial}</div>}

                          <div className="msg-content-wrapper">
                            <div className="msg-meta-header">
                              {!isOutgoing && <span className="msg-sender-name">{msg.senderName || 'User'}</span>}
                              <span className="msg-timestamp">{formatTimeOrDate(msg.createdAt)}</span>
                            </div>

                            {/* Normal Bubble or Inline Edit View */}
                            {isEditing ? (
                              <div className="msg-inline-edit">
                                <textarea
                                  id={`input-edit-msg-${msg.id}`}
                                  className="msg-edit-textarea"
                                  value={editingMsgText}
                                  onChange={e => setEditingMsgText(e.target.value)}
                                  autoFocus
                                />
                                <div className="msg-edit-actions">
                                  <button
                                    id={`btn-cancel-edit-${msg.id}`}
                                    className="msg-edit-btn msg-edit-cancel"
                                    onClick={() => setEditingMsgId(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    id={`btn-save-edit-${msg.id}`}
                                    className="msg-edit-btn msg-edit-save"
                                    onClick={() => handleSaveEdit(msg.id)}
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                id={`msg-bubble-${msg.id}`}
                                className={`msg-bubble ${isCode ? 'code' : ''} ${msg.isDeleted ? 'deleted' : ''} ${
                                  inConvSearch && msg.content.toLowerCase().includes(inConvSearch.toLowerCase())
                                    ? 'search-highlight'
                                    : ''
                                }`}
                              >
                                {isCode && (
                                  <div className="code-header">
                                    <span>Code / Technical Snippet</span>
                                    <button
                                      className="conv-action-mini-btn"
                                      onClick={() => navigator.clipboard.writeText(msg.content)}
                                      title="Copy Code"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                )}

                                <div>{msg.content}</div>

                                {msg.editedAt && !msg.isDeleted && (
                                  <span className="msg-edited-badge">(edited)</span>
                                )}

                                {/* Hover actions for author */}
                                {isOutgoing && !msg.isDeleted && activeConversation.status !== 'Archived' && (
                                  <div className="msg-hover-actions">
                                    <button
                                      id={`btn-edit-msg-${msg.id}`}
                                      className="msg-action-btn"
                                      title="Edit Message"
                                      onClick={() => {
                                        setEditingMsgId(msg.id);
                                        setEditingMsgText(msg.content);
                                      }}
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      id={`btn-delete-msg-${msg.id}`}
                                      className="msg-action-btn delete"
                                      title="Delete Message"
                                      onClick={() => handleDeleteMessage(msg.id)}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Live Real-time Typing Indicator */}
            {peerTyping && (
              <div id="indicator-user-typing" className="chat-typing-indicator-bar">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span><strong>{peerTyping.userName}</strong> is typing...</span>
              </div>
            )}

            {/* Bottom: Message Composer */}
            <div id="chat-composer" className="chat-composer-container">
              {activeConversation.status === 'Archived' ? (
                <div className="chat-composer-archived-banner">
                  <span>This conversation is currently archived. Unarchive to send messages.</span>
                  <button
                    id="btn-unarchive-composer"
                    className="chat-btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                    onClick={() => handleToggleArchive(activeConversation.id, activeConversation.status)}
                  >
                    <RotateCcw size={14} /> Unarchive
                  </button>
                </div>
              ) : (
                <>
                  <div className="chat-composer-toolbar">
                    <div className="composer-types">
                      <button
                        id="btn-composer-type-text"
                        type="button"
                        className={`composer-type-pill ${composerType === 'Text' ? 'active' : ''}`}
                        onClick={() => setComposerType('Text')}
                      >
                        <MessageSquare size={13} /> Text
                      </button>
                      <button
                        id="btn-composer-type-code"
                        type="button"
                        className={`composer-type-pill ${composerType === 'Code' ? 'active' : ''}`}
                        onClick={() => setComposerType('Code')}
                      >
                        <Code size={13} /> Code Snippet
                      </button>
                    </div>

                    <div className="composer-emojis">
                      <button
                        id="btn-toggle-emojis"
                        type="button"
                        className="chat-icon-btn"
                        style={{ width: '28px', height: '28px' }}
                        title="Quick Reactions"
                        onClick={() => setShowEmojiPicker(prev => !prev)}
                      >
                        <Smile size={15} />
                      </button>

                      {showEmojiPicker && (
                        <div style={{ display: 'flex', gap: '0.2rem' }}>
                          {QUICK_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              className="emoji-pill"
                              onClick={() => {
                                setComposerText(prev => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleSendMessage} className="chat-input-wrapper">
                    <textarea
                      id="input-chat-message"
                      className="chat-input-textarea"
                      placeholder={
                        composerType === 'Code'
                          ? 'Paste code snippet here... (Press Enter to send)'
                          : 'Type a message... (Press Enter to send, Shift+Enter for new line)'
                      }
                      rows={composerType === 'Code' ? 3 : 1}
                      value={composerText}
                      onChange={handleComposerChange}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />

                    <button
                      id="btn-send-message"
                      type="submit"
                      className="chat-send-btn"
                      disabled={!composerText.trim() || sendingMessage}
                      title="Send Message"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </>
              )}
            </div>
          </>
        ) : (
          /* Empty Active State: No conversation selected */
          <div id="chat-empty-state" className="chat-empty-state-view">
            <div className="empty-state-illustration">
              <MessageSquare size={44} />
            </div>
            <h2 className="empty-state-title">ResCollab Collaboration Chat</h2>
            <p className="empty-state-desc">
              Connect directly with research supervisors, students, team members, and lab collaborators. Real-time
              communication for projects, ideas, and academic workspaces.
            </p>
            <div className="empty-state-actions">
              <button
                id="btn-empty-start-chat"
                className="chat-btn-primary"
                onClick={() => {
                  fetchContacts();
                  setShowDirectModal(true);
                }}
              >
                <Plus size={16} /> Start Direct Chat
              </button>
              <button
                id="btn-empty-start-team"
                className="chat-btn-secondary"
                onClick={() => {
                  fetchContacts();
                  fetchUserWorkspaces();
                  setShowTeamModal(true);
                }}
              >
                <Users size={16} /> Create Team Conversation
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* Right Drawer: Info & Participants Drawer (Slide-out)               */}
      {/* ==================================================================== */}
      {showInfoDrawer && activeConversation && (
        <aside id="drawer-conv-info" className="chat-info-drawer">
          <div className="drawer-header">
            <h3 className="drawer-title">Conversation Details</h3>
            <button
              id="btn-close-drawer"
              className="chat-icon-btn"
              onClick={() => setShowInfoDrawer(false)}
            >
              <X size={16} />
            </button>
          </div>

          <div className="drawer-content">
            <div className="drawer-section">
              <h4 className="drawer-section-title">Overview</h4>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', color: '#cbd5e1' }}>
                <div><strong>Type:</strong> {activeConversation.type} Chat</div>
                <div><strong>Status:</strong> {activeConversation.status}</div>
                <div><strong>Created:</strong> {new Date(activeConversation.updatedAt).toLocaleDateString()}</div>
                {activeConversation.workspaceId && (
                  <div><strong>Workspace:</strong> Workspace #{activeConversation.workspaceId}</div>
                )}
              </div>
            </div>

            <div className="drawer-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 className="drawer-section-title">
                  Participants ({activeConversation.participants.length})
                </h4>
                {activeConversation.type === 'Team' && activeConversation.status !== 'Archived' && (
                  <button
                    id="btn-drawer-add-user"
                    className="chat-icon-btn"
                    style={{ width: '26px', height: '26px' }}
                    title="Add User"
                    onClick={() => {
                      fetchContacts();
                      setShowAddParticipantModal(true);
                    }}
                  >
                    <Plus size={15} />
                  </button>
                )}
              </div>

              <div className="drawer-participants-list">
                {activeConversation.participants.map(p => (
                  <div
                    key={p.userId}
                    id={`participant-item-${p.userId}`}
                    className="drawer-participant-card"
                  >
                    <div className="drawer-participant-info">
                      <div className="msg-avatar" style={{ width: '30px', height: '30px', fontSize: '0.75rem' }}>
                        {(p.userName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="drawer-p-name">
                          {p.userName || `User #${p.userId}`}
                          {p.userId === currentUserId && ' (You)'}
                        </p>
                      </div>
                    </div>

                    {activeConversation.type === 'Team' &&
                      activeConversation.status !== 'Archived' &&
                      p.userId !== currentUserId && (
                        <button
                          id={`btn-remove-user-${p.userId}`}
                          className="conv-action-mini-btn"
                          title="Remove from team"
                          onClick={() => handleRemoveParticipant(p.userId)}
                        >
                          <X size={14} color="#f87171" />
                        </button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ==================================================================== */}
      {/* Modal: New Direct Message                                            */}
      {/* ==================================================================== */}
      {showDirectModal && (
        <div className="chat-modal-backdrop">
          <div id="modal-new-direct-chat" className="chat-modal-card">
            <div className="chat-modal-header">
              <h3 className="chat-modal-title">
                <User size={20} color="#38bdf8" /> Start Direct Message
              </h3>
              <button
                id="btn-close-direct-modal"
                className="chat-icon-btn"
                onClick={() => setShowDirectModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="chat-modal-body">
              <div className="chat-search-bar">
                <Search size={15} className="chat-search-icon" />
                <input
                  id="input-search-contacts"
                  type="text"
                  className="chat-search-input"
                  placeholder="Search colleagues, supervisors, or students..."
                  value={contactSearchQuery}
                  onChange={e => {
                    setContactSearchQuery(e.target.value);
                    fetchContacts(e.target.value);
                  }}
                  autoFocus
                />
              </div>

              <div className="modal-contacts-list">
                {loadingContacts ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    Loading directory contacts...
                  </div>
                ) : contacts.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    No researchers found.
                  </div>
                ) : (
                  contacts.map(c => (
                    <div
                      key={c.id}
                      id={`contact-item-${c.id}`}
                      className="modal-contact-row"
                      onClick={() => handleStartDirectChat(c.id)}
                    >
                      <div className="modal-contact-details">
                        <h5 className="modal-contact-name">{c.fullName}</h5>
                        <p className="modal-contact-sub">
                          {c.role} {c.department ? `• ${c.department}` : ''} {c.university ? `(${c.university})` : ''}
                        </p>
                      </div>

                      <button
                        id={`btn-contact-chat-${c.id}`}
                        className="chat-btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                      >
                        {c.directConversationId ? 'Open Chat' : 'Start Chat'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="chat-modal-footer">
              <button
                className="chat-btn-secondary"
                onClick={() => setShowDirectModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Modal: New Team Conversation                                         */}
      {/* ==================================================================== */}
      {showTeamModal && (
        <div className="chat-modal-backdrop">
          <div id="modal-new-team-chat" className="chat-modal-card">
            <div className="chat-modal-header">
              <h3 className="chat-modal-title">
                <Users size={20} color="#a855f7" /> Create Team Conversation
              </h3>
              <button
                id="btn-close-team-modal"
                className="chat-icon-btn"
                onClick={() => setShowTeamModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTeamChat}>
              <div className="chat-modal-body">
                <div className="chat-form-group">
                  <label htmlFor="input-team-chat-name" className="chat-form-label">
                    Team Conversation Name *
                  </label>
                  <input
                    id="input-team-chat-name"
                    type="text"
                    required
                    className="chat-form-input"
                    placeholder="e.g. AI-Assisted Clinical Trials Team"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                  />
                </div>

                <div className="chat-form-group">
                  <label htmlFor="select-team-workspace" className="chat-form-label">
                    Link to Workspace (Optional)
                  </label>
                  <select
                    id="select-team-workspace"
                    className="chat-form-select"
                    value={newTeamWorkspaceId || ''}
                    onChange={e => setNewTeamWorkspaceId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">None (Standalone Team Chat)</option>
                    {userWorkspaces.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} (#{w.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="chat-form-group">
                  <label className="chat-form-label">
                    Add Initial Members ({newTeamSelectedUsers.length} selected)
                  </label>
                  <div className="modal-contacts-list" style={{ maxHeight: '200px' }}>
                    {contacts.map(c => {
                      const isSelected = newTeamSelectedUsers.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="modal-contact-row"
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="modal-contact-details">
                            <h5 className="modal-contact-name">{c.fullName}</h5>
                            <p className="modal-contact-sub">{c.role} {c.department ? `• ${c.department}` : ''}</p>
                          </div>
                          <input
                            id={`checkbox-user-${c.id}`}
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setNewTeamSelectedUsers(prev =>
                                isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                              );
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="chat-modal-footer">
                <button
                  type="button"
                  className="chat-btn-secondary"
                  onClick={() => setShowTeamModal(false)}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-team-chat"
                  type="submit"
                  className="chat-btn-primary"
                  disabled={!newTeamName.trim()}
                >
                  <Check size={16} /> Create Team Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Modal: Add Participant to Active Team Chat                          */}
      {/* ==================================================================== */}
      {showAddParticipantModal && activeConversation && (
        <div className="chat-modal-backdrop">
          <div id="modal-add-participant" className="chat-modal-card">
            <div className="chat-modal-header">
              <h3 className="chat-modal-title">
                <Users size={20} color="#38bdf8" /> Add Participant to Team
              </h3>
              <button
                id="btn-close-add-participant-modal"
                className="chat-icon-btn"
                onClick={() => setShowAddParticipantModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="chat-modal-body">
              <div className="chat-form-group">
                <label htmlFor="select-new-participant-user" className="chat-form-label">
                  Select User to Add
                </label>
                <select
                  id="select-new-participant-user"
                  className="chat-form-select"
                  value={selectedNewParticipantId || ''}
                  onChange={e => setSelectedNewParticipantId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">-- Choose a colleague or researcher --</option>
                  {contacts
                    .filter(c => !activeConversation.participants.some(p => p.userId === c.id))
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.role} {c.department ? `- ${c.department}` : ''})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="chat-modal-footer">
              <button
                type="button"
                className="chat-btn-secondary"
                onClick={() => setShowAddParticipantModal(false)}
              >
                Cancel
              </button>
              <button
                id="btn-submit-add-participant"
                type="button"
                className="chat-btn-primary"
                disabled={!selectedNewParticipantId}
                onClick={handleAddParticipant}
              >
                <Check size={16} /> Add Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Modal: Global Search All Messages                                   */}
      {/* ==================================================================== */}
      {showGlobalSearchModal && (
        <div className="chat-modal-backdrop">
          <div id="modal-search-messages" className="chat-modal-card" style={{ maxWidth: '600px' }}>
            <div className="chat-modal-header">
              <h3 className="chat-modal-title">
                <Search size={20} color="#38bdf8" /> Search Across Conversations
              </h3>
              <button
                id="btn-close-search-modal"
                className="chat-icon-btn"
                onClick={() => setShowGlobalSearchModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="chat-modal-body">
              <form onSubmit={handleGlobalSearch} className="chat-search-bar">
                <Search size={16} className="chat-search-icon" />
                <input
                  id="input-global-message-search"
                  type="text"
                  className="chat-search-input"
                  placeholder="Type search keywords (min 2 letters) and press Enter..."
                  value={globalSearchQuery}
                  onChange={e => setGlobalSearchQuery(e.target.value)}
                  autoFocus
                />
                <button type="submit" id="btn-submit-global-search" style={{ display: 'none' }}>Search</button>
              </form>

              <div className="global-search-results">
                {searchingGlobal ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    Searching messages...
                  </div>
                ) : globalSearchResults.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    {globalSearchQuery.trim()
                      ? 'No matching messages found.'
                      : 'Enter a keyword to search all your conversations.'}
                  </div>
                ) : (
                  globalSearchResults.map(res => (
                    <div
                      key={res.id}
                      id={`search-result-item-${res.id}`}
                      className="global-search-result-card"
                      onClick={() => {
                        setActiveConvId(res.conversationId);
                        setShowGlobalSearchModal(false);
                      }}
                    >
                      <div className="search-result-header">
                        <span className="search-result-sender">{res.senderName || 'User'}</span>
                        <span className="search-result-time">{formatTimeOrDate(res.createdAt)}</span>
                      </div>
                      <p className="search-result-snippet">{res.content}</p>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          id={`btn-jump-conv-${res.conversationId}`}
                          className="chat-btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                        >
                          <CornerDownLeft size={12} /> Jump to Chat
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="chat-modal-footer">
              <button
                className="chat-btn-secondary"
                onClick={() => setShowGlobalSearchModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
