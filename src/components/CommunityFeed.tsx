import React, { useEffect, useState, useCallback } from 'react';
import {
  MessageSquare, Send, ThumbsUp, Sparkles, Pin, Share2, Tag,
  Trash2, Edit3, Search, RefreshCw, X, Check,
  Globe, Building2, ChevronDown, ChevronUp, ExternalLink, Image,
  FileText, MessageCircle, HelpCircle, Flame, Plus,
  Heart, Copy, CornerDownRight
} from 'lucide-react';
import './CommunityFeed.css';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface CommunityComment {
  id: number;
  postId: number;
  authorId: number;
  authorName: string;
  authorRole: string;
  authorUniversity?: string;
  authorDepartment?: string;
  parentCommentId?: number;
  content: string;
  likesCount: number;
  createdAt: string;
  isAuthor: boolean;
  replies?: CommunityComment[];
}

export interface CommunityPost {
  id: number;
  authorId: number;
  authorName: string;
  authorRole: string;
  authorUniversity?: string;
  authorDepartment?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  attachmentUrl?: string;
  attachmentType?: string;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
  isPinned: boolean;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  hasUserReacted: boolean;
  userReactionType?: string;
  isAuthor: boolean;
}

export interface PaginatedPostsResult {
  items: CommunityPost[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const REACTION_TYPES = [
  { type: 'Like', label: 'Like', icon: '👍', color: '#3b82f6' },
  { type: 'Insightful', label: 'Insightful', icon: '💡', color: '#f59e0b' },
  { type: 'Curious', label: 'Curious', icon: '🤔', color: '#8b5cf6' },
  { type: 'Celebrate', label: 'Celebrate', icon: '🎉', color: '#10b981' },
  { type: 'Support', label: 'Support', icon: '🤝', color: '#ec4899' },
];

export const CATEGORIES = [
  { id: 'All', label: 'All Discussions', icon: MessageSquare },
  { id: 'ResearchInquiry', label: 'Research Inquiry', icon: HelpCircle },
  { id: 'PaperDiscussion', label: 'Paper Discussion', icon: FileText },
  { id: 'ConferenceUpdate', label: 'Conferences & CFPs', icon: Globe },
  { id: 'CollaborationCall', label: 'Collaboration Call', icon: Sparkles },
  { id: 'General', label: 'Scholarly Discourse', icon: MessageCircle },
];

// Relative Time Helper
const formatRelativeTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
};

const CommunityFeed: React.FC = () => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('latest');
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Post Creator State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>('');
  const [createContent, setCreateContent] = useState<string>('');
  const [createCategory, setCreateCategory] = useState<string>('ResearchInquiry');
  const [createTags, setCreateTags] = useState<string>('');
  const [createAttachmentUrl, setCreateAttachmentUrl] = useState<string>('');
  const [createAttachmentType, setCreateAttachmentType] = useState<string>('Link');
  const [createVisibility, setCreateVisibility] = useState<string>('Public');
  const [submittingPost, setSubmittingPost] = useState<boolean>(false);

  // Edit Post State
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('General');
  const [editTags, setEditTags] = useState<string>('');
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false);

  // Expanded Comments Drawer & Threading State
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, CommunityComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);
  const [commentSortMap, setCommentSortMap] = useState<Record<number, 'oldest' | 'newest'>>({});
  const [collapsedRepliesMap, setCollapsedRepliesMap] = useState<Record<number, boolean>>({});
  const [inlineReplyCommentId, setInlineReplyCommentId] = useState<number | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState<string>('');
  const [likedCommentIds, setLikedCommentIds] = useState<Set<number>>(new Set());

  // Share Post Modal State
  const [sharingPost, setSharingPost] = useState<CommunityPost | null>(null);
  const [shareNote, setShareNote] = useState<string>('');
  const [submittingShare, setSubmittingShare] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  // Reaction Popover active post id
  const [reactionPopoverPostId, setReactionPopoverPostId] = useState<number | null>(null);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Community Posts
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        params.append('category', selectedCategory);
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (selectedTag) {
        params.append('tag', selectedTag);
      }
      if (sortBy) {
        params.append('sort', sortBy);
      }

      const res = await fetch(`http://localhost:5000/api/community/posts?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const result: PaginatedPostsResult = await res.json();
        setPosts(result.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      showToast('Could not load community feed.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedCategory, searchTerm, selectedTag, sortBy]);

  // Fetch Popular Tags
  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/community/popular-tags', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPopularTags(data.map((t: any) => t.tag || t));
        }
      }
    } catch (err) {
      console.error('Failed to load popular tags:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchPosts();
    fetchTags();
  }, [fetchPosts, fetchTags]);

  // Create Post Handler
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createContent.trim()) {
      showToast('Please provide both title and discussion content.');
      return;
    }

    try {
      setSubmittingPost(true);
      const tagsArray = createTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const payload = {
        title: createTitle.trim(),
        content: createContent.trim(),
        category: createCategory,
        tags: tagsArray,
        attachmentUrl: createAttachmentUrl.trim() || null,
        attachmentType: createAttachmentUrl.trim() ? createAttachmentType : null,
        visibility: createVisibility
      };

      const res = await fetch('http://localhost:5000/api/community/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdPost: CommunityPost = await res.json();
        setPosts(prev => [createdPost, ...prev]);
        setIsCreateModalOpen(false);
        setCreateTitle('');
        setCreateContent('');
        setCreateTags('');
        setCreateAttachmentUrl('');
        showToast('✓ Scholarly discussion post published to the community!');
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to publish post.');
      }
    } catch {
      showToast('Failed to connect to community service.');
    } finally {
      setSubmittingPost(false);
    }
  };

  // Edit Post Handler
  const handleSaveEdit = async () => {
    if (!editingPost) return;
    if (!editTitle.trim() || !editContent.trim()) {
      showToast('Title and content are required.');
      return;
    }

    try {
      setSubmittingEdit(true);
      const tagsArray = editTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const res = await fetch(`http://localhost:5000/api/community/posts/${editingPost.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory,
          tags: tagsArray
        })
      });

      if (res.ok) {
        setPosts(prev => prev.map(p => {
          if (p.id === editingPost.id) {
            return {
              ...p,
              title: editTitle.trim(),
              content: editContent.trim(),
              category: editCategory,
              tags: tagsArray,
              updatedAt: new Date().toISOString()
            };
          }
          return p;
        }));
        setEditingPost(null);
        showToast('✓ Post updated successfully.');
      } else {
        showToast('Could not update post.');
      }
    } catch {
      showToast('Error updating post.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: number) => {
    if (!window.confirm('Are you sure you want to delete this discussion post?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/community/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        showToast('Post removed.');
      } else {
        showToast('Could not delete post.');
      }
    } catch {
      showToast('Deletion failed.');
    }
  };

  // Toggle Reaction with sentiment
  const handleToggleReaction = async (postId: number, reactionType: string) => {
    setReactionPopoverPostId(null);
    try {
      const res = await fetch(`http://localhost:5000/api/community/posts/${postId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reactionType })
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              hasUserReacted: data.hasReacted,
              userReactionType: data.reactionType,
              reactionsCount: data.reactionsCount
            };
          }
          return p;
        }));
        showToast(data.hasReacted ? `✓ Expressed ${reactionType} feedback!` : 'Reaction removed.');
      }
    } catch {
      showToast('Failed to record reaction.');
    }
  };

  // Fetch comments for expanded post
  const toggleComments = async (postId: number) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setReplyingToCommentId(null);
      setInlineReplyCommentId(null);
      return;
    }

    setExpandedPostId(postId);
    setReplyingToCommentId(null);
    setInlineReplyCommentId(null);

    try {
      setLoadingComments(true);
      const res = await fetch(`http://localhost:5000/api/community/posts/${postId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const postDetail = await res.json();
        setCommentsMap(prev => ({ ...prev, [postId]: postDetail.comments || [] }));
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  // Submit Top-Level Comment / Reply
  const handleAddComment = async (postId: number) => {
    if (!newCommentText.trim()) return;

    try {
      setSubmittingComment(true);
      const res = await fetch(`http://localhost:5000/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: newCommentText.trim(),
          parentCommentId: replyingToCommentId
        })
      });

      if (res.ok) {
        const createdComment: CommunityComment = await res.json();
        setNewCommentText('');
        setReplyingToCommentId(null);

        setCommentsMap(prev => {
          const currentList = prev[postId] || [];
          if (createdComment.parentCommentId) {
            return {
              ...prev,
              [postId]: currentList.map(c => {
                if (c.id === createdComment.parentCommentId) {
                  return {
                    ...c,
                    replies: [...(c.replies || []), createdComment]
                  };
                }
                return c;
              })
            };
          } else {
            return {
              ...prev,
              [postId]: [...currentList, createdComment]
            };
          }
        });

        setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p));
        showToast('✓ Comment published to discussion.');
      }
    } catch {
      showToast('Failed to post reply.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Submit Inline Reply
  const handleAddInlineReply = async (postId: number, parentCommentId: number) => {
    if (!inlineReplyText.trim()) return;
    try {
      setSubmittingComment(true);
      const res = await fetch(`http://localhost:5000/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: inlineReplyText.trim(),
          parentCommentId
        })
      });
      if (res.ok) {
        const createdComment: CommunityComment = await res.json();
        setInlineReplyText('');
        setInlineReplyCommentId(null);
        setCommentsMap(prev => {
          const currentList = prev[postId] || [];
          return {
            ...prev,
            [postId]: currentList.map(c => {
              if (c.id === parentCommentId) {
                return {
                  ...c,
                  replies: [...(c.replies || []), createdComment]
                };
              }
              return c;
            })
          };
        });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p));
        showToast('✓ Reply published to discussion!');
      }
    } catch {
      showToast('Failed to post reply.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Upvote / Like Comment
  const handleLikeComment = async (postId: number, commentId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/community/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCommentsMap(prev => {
          const list = prev[postId] || [];
          return {
            ...prev,
            [postId]: list.map(c => {
              if (c.id === commentId) {
                return { ...c, likesCount: data.likesCount };
              }
              if (c.replies) {
                return {
                  ...c,
                  replies: c.replies.map(r => r.id === commentId ? { ...r, likesCount: data.likesCount } : r)
                };
              }
              return c;
            })
          };
        });
        setLikedCommentIds(prev => new Set(prev).add(commentId));
        showToast('✓ Critique upvoted!');
      }
    } catch {
      showToast('Failed to upvote critique.');
    }
  };

  // Delete Comment / Reply
  const handleDeleteComment = async (postId: number, commentId: number) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/community/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCommentsMap(prev => {
          const list = prev[postId] || [];
          return {
            ...prev,
            [postId]: list
              .filter(c => c.id !== commentId)
              .map(c => ({
                ...c,
                replies: c.replies?.filter(r => r.id !== commentId)
              }))
          };
        });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p));
        showToast('Comment deleted.');
      }
    } catch {
      showToast('Could not delete comment.');
    }
  };

  // Submit Share Note
  const handleShareSubmit = async () => {
    if (!sharingPost) return;
    try {
      setSubmittingShare(true);
      const res = await fetch(`http://localhost:5000/api/community/posts/${sharingPost.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shareNote: shareNote.trim() || null })
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.id === sharingPost.id ? { ...p, sharesCount: data.sharesCount } : p));
        setSharingPost(null);
        setShareNote('');
        showToast('✓ Discussion broadcasted to your academic network!');
      } else {
        showToast('Could not share discussion.');
      }
    } catch {
      showToast('Error sharing discussion.');
    } finally {
      setSubmittingShare(false);
    }
  };

  // Get sorted comments for a post
  const getSortedComments = (postId: number) => {
    const list = commentsMap[postId] || [];
    const sort = commentSortMap[postId] || 'oldest';
    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sort === 'newest' ? timeB - timeA : timeA - timeB;
    });
  };

  // Toggle Collapse Replies
  const toggleCollapseReplies = (commentId: number) => {
    setCollapsedRepliesMap(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  return (
    <div className="community-container" id="community-feed-page">
      {/* Top Header Banner */}
      <div className="community-header">
        <div className="community-title-group">
          <h1>
            <MessageSquare size={32} color="#4f46e5" />
            Research Community & Discussions
          </h1>
          <p>Scholarly discourse, collaborative inquiries, literature debates, and conference call-outs.</p>
        </div>

        <div className="community-header-actions">
          <button
            id="btn-open-create-post"
            className="btn-create-post-cta"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={18} /> New Research Post
          </button>
        </div>
      </div>

      {/* Main Layout: Feed Column + Sidebar Discovery Column */}
      <div className="community-layout">
        <div className="feed-main-col">
          {/* Category Filter Tabs */}
          <div className="category-tabs-bar" role="tablist">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`tab-category-${cat.id.toLowerCase()}`}
                  className={`category-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedTag('');
                  }}
                >
                  <Icon size={16} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Feed Filter Toolbar */}
          <div className="feed-toolbar">
            <div className="feed-search-box">
              <Search size={18} color="#64748b" />
              <input
                id="input-feed-search"
                type="text"
                placeholder="Search discussions, methodologies, researchers, or papers..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="feed-sort-box">
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Sort by:</span>
              <select
                id="select-feed-sort"
                className="feed-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="latest">Latest Posts</option>
                <option value="popular">Most Popular</option>
                <option value="comments">Most Discussed</option>
              </select>
            </div>
          </div>

          {/* Active Tag Filter Indicator */}
          {selectedTag && (
            <div className="active-tag-banner">
              <span>Filtering by topic: <strong>#{selectedTag}</strong></span>
              <button onClick={() => setSelectedTag('')} title="Clear tag filter">
                <X size={15} />
              </button>
            </div>
          )}

          {/* Posts Feed Stream */}
          {loading ? (
            <div className="feed-loading">
              <RefreshCw size={36} className="spinner-icon" />
              <p>Gathering academic discussions and peer exchanges...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="feed-empty-state" id="feed-empty-state">
              <MessageSquare size={54} style={{ opacity: 0.25, marginBottom: '1rem' }} />
              <h3>No Academic Discussions Found</h3>
              <p>
                {searchTerm || selectedTag || selectedCategory !== 'All'
                  ? 'No discussions match your filter criteria. Try clearing search filters.'
                  : 'Be the first researcher to initiate a discussion thread or inquiry!'}
              </p>
              <button
                className="btn-create-post-cta"
                style={{ marginTop: '1.2rem' }}
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus size={16} /> Start a Discussion
              </button>
            </div>
          ) : (
            <div className="posts-list" id="posts-feed-stream">
              {posts.map(post => {
                const isExpanded = expandedPostId === post.id;
                const comments = commentsMap[post.id] || [];

                return (
                  <article key={post.id} className="post-card" id={`community-post-${post.id}`}>
                    {/* Pinned Institutional Announcement Flag */}
                    {post.isPinned && (
                      <div className="pinned-post-flag">
                        <Pin size={13} /> Pinned Institutional Announcement
                      </div>
                    )}

                    {/* Author Attribution Row */}
                    <div className="post-header-row">
                      <div className="author-avatar">
                        {post.authorName ? post.authorName.charAt(0) : 'U'}
                      </div>
                      <div className="author-info">
                        <div className="author-name-row">
                          <span className="author-name">{post.authorName}</span>
                          <span className="author-role-badge">{post.authorRole}</span>
                        </div>
                        <div className="author-submeta">
                          {post.authorUniversity && (
                            <span><Building2 size={13} /> {post.authorUniversity}</span>
                          )}
                          <span>·</span>
                          <span title={new Date(post.createdAt).toLocaleString()}>
                            {formatRelativeTime(post.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Author Menu Actions */}
                      {post.isAuthor && (
                        <div className="post-author-actions">
                          <button
                            className="btn-icon-subtle"
                            title="Edit post"
                            onClick={() => {
                              setEditingPost(post);
                              setEditTitle(post.title);
                              setEditContent(post.content);
                              setEditCategory(post.category);
                              setEditTags(post.tags.join(', '));
                            }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            className="btn-icon-subtle btn-delete-post"
                            title="Delete post"
                            onClick={() => handleDeletePost(post.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Post Category Badge */}
                    <div className="post-category-tag">
                      <Tag size={12} /> {post.category}
                    </div>

                    {/* Post Content */}
                    <h2 className="post-title">{post.title}</h2>
                    <div className="post-body-text">{post.content}</div>

                    {/* Taxonomy Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="post-tags-cloud">
                        {post.tags.map(t => (
                          <button
                            key={t}
                            className="post-tag-chip"
                            onClick={() => setSelectedTag(t)}
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Attachment Preview Card */}
                    {post.attachmentUrl && (
                      <div className="post-attachment-box">
                        <div className="attachment-icon">
                          {post.attachmentType === 'PDF' ? <FileText size={20} color="#ef4444" /> :
                           post.attachmentType === 'Image' ? <Image size={20} color="#10b981" /> :
                           <ExternalLink size={20} color="#3b82f6" />}
                        </div>
                        <div className="attachment-details">
                          <span className="attachment-label">Research Resource Attachment ({post.attachmentType || 'Resource'})</span>
                          <a
                            href={post.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="attachment-link"
                          >
                            {post.attachmentUrl} <ExternalLink size={13} />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Reaction Sentiment Cluster Breakdown */}
                    {post.reactionsCount > 0 && (
                      <div className="post-reactions-breakdown" id={`badge-reaction-${post.id}`}>
                        <span className="reaction-cluster">
                          {REACTION_TYPES.slice(0, Math.min(3, post.reactionsCount)).map((r, i) => (
                            <span key={i} className="cluster-icon" style={{ zIndex: 3 - i }}>{r.icon}</span>
                          ))}
                        </span>
                        <span className="reaction-cluster-count">{post.reactionsCount} peer reactions</span>
                      </div>
                    )}

                    {/* Post Footer Action Bar */}
                    <div className="post-action-bar">
                      <div className="action-buttons-group">
                        {/* Reaction Button with Popover */}
                        <div className="reaction-container">
                          <button
                            id={`btn-react-${post.id}`}
                            className={`post-action-btn ${post.hasUserReacted ? 'active-reacted' : ''}`}
                            style={post.hasUserReacted ? { color: REACTION_TYPES.find(r => r.type === post.userReactionType)?.color || '#4f46e5' } : {}}
                            onClick={() => {
                              if (post.hasUserReacted) {
                                handleToggleReaction(post.id, post.userReactionType || 'Like');
                              } else {
                                handleToggleReaction(post.id, 'Like');
                              }
                            }}
                            title="Click to toggle reaction, or use dropdown to choose sentiment"
                          >
                            {post.hasUserReacted ? (
                              <span className="active-reaction-icon">
                                {REACTION_TYPES.find(r => r.type === post.userReactionType)?.icon || '👍'}
                              </span>
                            ) : (
                              <ThumbsUp size={16} />
                            )}
                            <span className="reaction-label-count">
                              {post.hasUserReacted
                                ? `${REACTION_TYPES.find(r => r.type === post.userReactionType)?.label || 'Liked'} (${post.reactionsCount})`
                                : `React (${post.reactionsCount})`}
                            </span>
                          </button>

                          {/* Quick Reactions Popover Selector Trigger */}
                          <button
                            id={`btn-react-dropdown-${post.id}`}
                            className="reaction-menu-trigger"
                            title="Choose reaction sentiment"
                            onClick={() => setReactionPopoverPostId(reactionPopoverPostId === post.id ? null : post.id)}
                          >
                            <ChevronDown size={14} />
                          </button>

                          {reactionPopoverPostId === post.id && (
                            <div className="reactions-popover animate-fade-in" id={`reaction-popover-${post.id}`}>
                              {REACTION_TYPES.map(r => (
                                <button
                                  key={r.type}
                                  id={`reaction-btn-${r.type.toLowerCase()}-${post.id}`}
                                  className={`reaction-emoji-btn ${post.userReactionType === r.type ? 'current-selected' : ''}`}
                                  title={`${r.label}: Express ${r.label.toLowerCase()} feedback`}
                                  onClick={() => handleToggleReaction(post.id, r.type)}
                                >
                                  <span className="emoji-char">{r.icon}</span>
                                  <span className="emoji-tooltip">{r.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Comments Toggle Button */}
                        <button
                          id={`btn-comments-toggle-${post.id}`}
                          className={`post-action-btn ${isExpanded ? 'active-expanded' : ''}`}
                          onClick={() => toggleComments(post.id)}
                        >
                          <MessageSquare size={16} />
                          <span>Comments ({post.commentsCount})</span>
                        </button>
                      </div>

                      {/* Share Action */}
                      <div className="share-action">
                        <button
                          id={`btn-share-post-${post.id}`}
                          className="post-action-btn"
                          title="Share discussion with peers"
                          onClick={() => {
                            setSharingPost(post);
                            setShareNote('');
                          }}
                        >
                          <Share2 size={16} />
                          <span>Share ({post.sharesCount})</span>
                        </button>
                      </div>
                    </div>

                    {/* =========================================================================
                        EXPANDED THREADED COMMENTS SECTION
                       ========================================================================= */}
                    {isExpanded && (
                      <div className="comments-section" id={`comments-section-${post.id}`}>
                        {/* Comments Header Bar */}
                        <div className="comments-header-bar">
                          <div className="comments-header-title">
                            <MessageSquare size={18} color="#4f46e5" />
                            <h3>Discussion Replies & Peer Critiques ({post.commentsCount})</h3>
                          </div>
                          <div className="comments-sort-selector">
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Order:</span>
                            <select
                              id={`select-comment-sort-${post.id}`}
                              className="comment-sort-dropdown"
                              value={commentSortMap[post.id] || 'oldest'}
                              onChange={e => setCommentSortMap(prev => ({ ...prev, [post.id]: e.target.value as 'oldest' | 'newest' }))}
                            >
                              <option value="oldest">Oldest First</option>
                              <option value="newest">Newest First</option>
                            </select>
                          </div>
                        </div>

                        {/* New Comment Input Box */}
                        <div className="comment-composer">
                          <div className="author-avatar composer-avatar">
                            {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                          </div>
                          <div className="composer-input-wrapper">
                            {replyingToCommentId && (
                              <div className="replying-banner">
                                <span>Replying to comment #{replyingToCommentId}</span>
                                <button onClick={() => setReplyingToCommentId(null)} title="Cancel reply"><X size={13} /></button>
                              </div>
                            )}
                            <textarea
                              id={`textarea-comment-${post.id}`}
                              className="comment-textarea"
                              rows={2}
                              maxLength={2000}
                              placeholder={replyingToCommentId ? 'Write your scholarly reply...' : 'Contribute your insight, methodology critique, or literature reference...'}
                              value={newCommentText}
                              onChange={e => setNewCommentText(e.target.value)}
                            />
                            <div className="composer-footer-row">
                              <span className="char-counter">{newCommentText.length} / 2000 chars</span>
                              <div className="composer-actions">
                                {replyingToCommentId && (
                                  <button
                                    type="button"
                                    className="btn-cancel-reply"
                                    onClick={() => setReplyingToCommentId(null)}
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  id={`btn-submit-comment-${post.id}`}
                                  className="btn-submit-comment"
                                  disabled={submittingComment || !newCommentText.trim()}
                                  onClick={() => handleAddComment(post.id)}
                                >
                                  <Send size={14} />
                                  {submittingComment ? 'Posting...' : 'Post Critique'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Comments List */}
                        {loadingComments ? (
                          <div className="comments-loading">
                            <RefreshCw size={24} className="spinner-icon" />
                            <span>Retrieving conversation thread...</span>
                          </div>
                        ) : comments.length === 0 ? (
                          <div className="comments-empty">
                            <p>No comments on this discussion yet. Start the debate!</p>
                          </div>
                        ) : (
                          <div className="comments-thread-list">
                            {getSortedComments(post.id).map(c => {
                              const isPostAuthor = c.authorId === post.authorId;
                              const isLiked = likedCommentIds.has(c.id);
                              const areRepliesCollapsed = !!collapsedRepliesMap[c.id];
                              const hasReplies = c.replies && c.replies.length > 0;
                              const isInlineReplying = inlineReplyCommentId === c.id;

                              return (
                                <div key={c.id} className="comment-bubble" id={`comment-${c.id}`}>
                                  <div className="comment-header">
                                    <div className="comment-author-avatar">{c.authorName.charAt(0)}</div>
                                    <div className="comment-author-meta">
                                      <div className="comment-author-line">
                                        <span className="comment-author-name">{c.authorName}</span>
                                        <span className="comment-author-role">{c.authorRole}</span>
                                        {isPostAuthor && (
                                          <span className="op-author-badge">Author</span>
                                        )}
                                      </div>
                                      <div className="comment-submeta-line">
                                        {c.authorUniversity && (
                                          <span className="comment-univ"><Building2 size={11} /> {c.authorUniversity}</span>
                                        )}
                                        <span className="comment-date" title={new Date(c.createdAt).toLocaleString()}>
                                          {formatRelativeTime(c.createdAt)}
                                        </span>
                                      </div>
                                    </div>
                                    {c.isAuthor && (
                                      <button
                                        id={`btn-delete-comment-${c.id}`}
                                        className="btn-delete-comment"
                                        title="Delete critique"
                                        onClick={() => handleDeleteComment(post.id, c.id)}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>

                                  <div className="comment-body">{c.content}</div>

                                  {/* Comment Footer Actions */}
                                  <div className="comment-footer-actions">
                                    {/* Like / Upvote Comment */}
                                    <button
                                      id={`btn-like-comment-${c.id}`}
                                      className={`btn-comment-action ${isLiked ? 'liked' : ''}`}
                                      onClick={() => handleLikeComment(post.id, c.id)}
                                      title="Upvote this critique"
                                    >
                                      <Heart size={13} fill={isLiked ? '#ec4899' : 'none'} color={isLiked ? '#ec4899' : '#64748b'} />
                                      <span>{c.likesCount || 0}</span>
                                    </button>

                                    {/* Reply to Comment */}
                                    <button
                                      id={`btn-reply-comment-${c.id}`}
                                      className="btn-comment-action btn-reply-trigger"
                                      onClick={() => {
                                        setInlineReplyCommentId(inlineReplyCommentId === c.id ? null : c.id);
                                        setInlineReplyText(`@${c.authorName} `);
                                      }}
                                    >
                                      <CornerDownRight size={13} />
                                      <span>Reply</span>
                                    </button>

                                    {/* Collapse / Expand Replies */}
                                    {hasReplies && (
                                      <button
                                        id={`btn-toggle-replies-${c.id}`}
                                        className="btn-comment-action btn-collapse-replies"
                                        onClick={() => toggleCollapseReplies(c.id)}
                                      >
                                        {areRepliesCollapsed ? (
                                          <>
                                            <ChevronDown size={13} />
                                            <span>Show {c.replies!.length} {c.replies!.length === 1 ? 'reply' : 'replies'}</span>
                                          </>
                                        ) : (
                                          <>
                                            <ChevronUp size={13} />
                                            <span>Hide {c.replies!.length} {c.replies!.length === 1 ? 'reply' : 'replies'}</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {/* Dedicated Inline Reply Composer */}
                                  {isInlineReplying && (
                                    <div className="inline-reply-composer animate-fade-in" id={`inline-reply-box-${c.id}`}>
                                      <textarea
                                        id={`textarea-inline-reply-${c.id}`}
                                        className="inline-reply-textarea"
                                        rows={2}
                                        value={inlineReplyText}
                                        onChange={e => setInlineReplyText(e.target.value)}
                                        placeholder={`Reply to ${c.authorName}...`}
                                      />
                                      <div className="inline-reply-actions">
                                        <button
                                          className="btn-cancel-inline"
                                          onClick={() => setInlineReplyCommentId(null)}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          id={`btn-send-inline-reply-${c.id}`}
                                          className="btn-send-inline"
                                          disabled={submittingComment || !inlineReplyText.trim()}
                                          onClick={() => handleAddInlineReply(post.id, c.id)}
                                        >
                                          <Send size={13} />
                                          Reply
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Nested Replies (Level 1) */}
                                  {hasReplies && !areRepliesCollapsed && (
                                    <div className="nested-replies-list">
                                      {c.replies!.map(r => {
                                        const isReplyPostAuthor = r.authorId === post.authorId;
                                        const isReplyLiked = likedCommentIds.has(r.id);

                                        return (
                                          <div key={r.id} className="nested-reply-bubble" id={`reply-${r.id}`}>
                                            <div className="comment-header">
                                              <div className="comment-author-avatar mini-avatar">{r.authorName.charAt(0)}</div>
                                              <div className="comment-author-meta">
                                                <div className="comment-author-line">
                                                  <span className="comment-author-name">{r.authorName}</span>
                                                  <span className="comment-author-role">{r.authorRole}</span>
                                                  {isReplyPostAuthor && (
                                                    <span className="op-author-badge">Author</span>
                                                  )}
                                                </div>
                                                <div className="comment-submeta-line">
                                                  <span className="comment-date" title={new Date(r.createdAt).toLocaleString()}>
                                                    {formatRelativeTime(r.createdAt)}
                                                  </span>
                                                </div>
                                              </div>
                                              {r.isAuthor && (
                                                <button
                                                  id={`btn-delete-reply-${r.id}`}
                                                  className="btn-delete-comment"
                                                  title="Delete reply"
                                                  onClick={() => handleDeleteComment(post.id, r.id)}
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              )}
                                            </div>
                                            <div className="comment-body nested-body">{r.content}</div>
                                            <div className="nested-reply-footer">
                                              <button
                                                id={`btn-like-reply-${r.id}`}
                                                className={`btn-comment-action mini-action ${isReplyLiked ? 'liked' : ''}`}
                                                onClick={() => handleLikeComment(post.id, r.id)}
                                                title="Upvote reply"
                                              >
                                                <Heart size={12} fill={isReplyLiked ? '#ec4899' : 'none'} color={isReplyLiked ? '#ec4899' : '#64748b'} />
                                                <span>{r.likesCount || 0}</span>
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Topics & Academic Guidelines */}
        <aside className="community-sidebar">
          {/* Quick Creator Box */}
          <div className="sidebar-card quick-create-card">
            <h3>Start a Discussion</h3>
            <p>Broadcast breakthrough papers, pose methodology inquiries, or find co-authors.</p>
            <button className="btn-create-post-cta" onClick={() => setIsCreateModalOpen(true)}>
              <Plus size={16} /> Compose New Post
            </button>
          </div>

          {/* Popular Community Tags */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <Flame size={18} color="#f59e0b" />
              Trending Research Topics
            </div>
            <div className="popular-tags-cloud">
              {popularTags.map(tag => (
                <button
                  key={tag}
                  className={`sidebar-tag-chip ${selectedTag === tag ? 'active' : ''}`}
                  onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                >
                  #{tag}
                </button>
              ))}
              {popularTags.length === 0 && (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No trending tags yet.</p>
              )}
            </div>
          </div>

          {/* Community Academic Standards */}
          <div className="sidebar-card guidelines-card">
            <div className="sidebar-card-title">
              <Sparkles size={18} color="#4f46e5" />
              Academic Discourse Standards
            </div>
            <ul className="guidelines-list">
              <li>Cite literature and empirical sources where applicable.</li>
              <li>Offer constructive peer critique and evidence-based feedback.</li>
              <li>Tag methodology domains to connect with relevant experts.</li>
              <li>Maintain collaborative, respectful academic integrity.</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* =========================================================================
          CREATE POST MODAL
         ========================================================================= */}
      {isCreateModalOpen && (
        <div className="modal-overlay animate-fade-in" id="modal-create-post">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                <Edit3 size={22} color="#4f46e5" />
                Create Research Discussion Post
              </h2>
              <button className="close-btn" onClick={() => setIsCreateModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreatePost} style={{ padding: '1.2rem 0 0 0' }}>
              <div className="form-group">
                <label>Discussion Title / Query *</label>
                <input
                  id="input-post-title"
                  type="text"
                  className="neo-input"
                  required
                  placeholder="e.g. Comparative benchmarks of Diffusion vs GANs for medical imaging..."
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label>Discussion Category *</label>
                  <select
                    id="select-post-category"
                    className="neo-input"
                    value={createCategory}
                    onChange={e => setCreateCategory(e.target.value)}
                  >
                    <option value="ResearchInquiry">Research Inquiry</option>
                    <option value="PaperDiscussion">Paper Discussion</option>
                    <option value="ConferenceUpdate">Conference & CFP</option>
                    <option value="CollaborationCall">Collaboration Call</option>
                    <option value="General">Scholarly Discourse</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Audience Visibility</label>
                  <select
                    id="select-post-visibility"
                    className="neo-input"
                    value={createVisibility}
                    onChange={e => setCreateVisibility(e.target.value)}
                  >
                    <option value="Public">Public (Platform-wide)</option>
                    <option value="Institution">My Institution Only</option>
                    <option value="ConnectionsOnly">My Connected Peers Only</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Post Content / Details (Markdown Supported) *</label>
                <textarea
                  id="textarea-post-content"
                  className="neo-input"
                  rows={6}
                  required
                  placeholder="Elaborate on your hypothesis, findings, research methodology, or query for the academic community..."
                  value={createContent}
                  onChange={e => setCreateContent(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Topic Tags (Comma-separated)</label>
                <input
                  id="input-post-tags"
                  type="text"
                  className="neo-input"
                  placeholder="e.g. DeepLearning, MedicalImaging, ComputerVision"
                  value={createTags}
                  onChange={e => setCreateTags(e.target.value)}
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label>Attachment URL (Paper / PDF / Link)</label>
                  <input
                    id="input-post-attachment-url"
                    type="url"
                    className="neo-input"
                    placeholder="https://arxiv.org/abs/..."
                    value={createAttachmentUrl}
                    onChange={e => setCreateAttachmentUrl(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Attachment Type</label>
                  <select
                    id="select-post-attachment-type"
                    className="neo-input"
                    value={createAttachmentType}
                    onChange={e => setCreateAttachmentType(e.target.value)}
                  >
                    <option value="Link">External Link</option>
                    <option value="PDF">Preprint / PDF</option>
                    <option value="Image">Dataset / Diagram Image</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1.2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                <button type="button" className="cancel-btn" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button
                  id="btn-create-post"
                  type="submit"
                  className="btn-create-post-cta"
                  disabled={submittingPost}
                >
                  <Send size={16} />
                  {submittingPost ? 'Publishing...' : 'Publish Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT POST MODAL
         ========================================================================= */}
      {editingPost && (
        <div className="modal-overlay animate-fade-in" id="modal-edit-post">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h2>Edit Discussion Post</h2>
              <button className="close-btn" onClick={() => setEditingPost(null)}>✕</button>
            </div>

            <div style={{ padding: '1rem 0 0 0' }}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  className="neo-input"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Content</label>
                <textarea
                  className="neo-input"
                  rows={5}
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  className="neo-input"
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                >
                  <option value="ResearchInquiry">Research Inquiry</option>
                  <option value="PaperDiscussion">Paper Discussion</option>
                  <option value="ConferenceUpdate">Conference & CFP</option>
                  <option value="CollaborationCall">Collaboration Call</option>
                  <option value="General">Scholarly Discourse</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tags (Comma-separated)</label>
                <input
                  type="text"
                  className="neo-input"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                />
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                <button className="cancel-btn" onClick={() => setEditingPost(null)}>Cancel</button>
                <button
                  className="btn-create-post-cta"
                  disabled={submittingEdit}
                  onClick={handleSaveEdit}
                >
                  <Check size={16} />
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SHARE DISCUSSION MODAL
         ========================================================================= */}
      {sharingPost && (
        <div className="modal-overlay animate-fade-in" id="modal-share-post">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                <Share2 size={22} color="#4f46e5" />
                Share Scholarly Discussion
              </h2>
              <button className="close-btn" onClick={() => setSharingPost(null)}>✕</button>
            </div>

            <div style={{ padding: '1.2rem 0 0 0' }}>
              {/* Post Preview Snippet */}
              <div className="share-preview-card">
                <div className="share-preview-category">{sharingPost.category}</div>
                <h4 className="share-preview-title">{sharingPost.title}</h4>
                <p className="share-preview-author">By {sharingPost.authorName} ({sharingPost.authorRole})</p>
              </div>

              <div className="form-group" style={{ marginTop: '1.2rem' }}>
                <label>Add a perspective or reflection note (Optional)</label>
                <textarea
                  id="input-share-note"
                  className="neo-input"
                  rows={3}
                  placeholder="Why are you sharing this discussion with your research connections?"
                  value={shareNote}
                  onChange={e => setShareNote(e.target.value)}
                />
              </div>

              {/* Direct Link Copy Row */}
              <div className="share-link-row">
                <input
                  type="text"
                  readOnly
                  className="neo-input"
                  value={`${window.location.origin}/community#post-${sharingPost.id}`}
                  style={{ fontSize: '0.82rem', background: '#f8fafc' }}
                />
                <button
                  type="button"
                  className="btn-copy-link"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/community#post-${sharingPost.id}`);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                    showToast('Link copied to clipboard!');
                  }}
                >
                  {linkCopied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1.4rem', display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                <button type="button" className="cancel-btn" onClick={() => setSharingPost(null)}>
                  Cancel
                </button>
                <button
                  id="btn-submit-share"
                  type="button"
                  className="btn-create-post-cta"
                  disabled={submittingShare}
                  onClick={handleShareSubmit}
                >
                  <Share2 size={16} />
                  {submittingShare ? 'Sharing...' : 'Share Discussion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notice" id="community-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;
