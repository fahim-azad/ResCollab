import React, { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';

interface BookmarkButtonProps {
  itemType: string;
  itemId: number;
}

const BookmarkButton: React.FC<BookmarkButtonProps> = ({ itemType, itemId }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`http://localhost:5000/api/bookmark/check/${itemType}/${itemId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setIsBookmarked(data.isBookmarked);
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkStatus();
  }, [itemType, itemId]);

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicking card
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      if (isBookmarked) {
        await fetch(`http://localhost:5000/api/bookmark/item/${itemType}/${itemId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsBookmarked(false);
      } else {
        await fetch(`http://localhost:5000/api/bookmark`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ itemType, itemId })
        });
        setIsBookmarked(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button 
      onClick={toggleBookmark}
      title={isBookmarked ? "Remove Bookmark" : "Bookmark"}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '0.2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isBookmarked ? 'var(--brand-purple)' : '#cbd5e1',
        transition: 'all 0.2s'
      }}
    >
      <Bookmark size={24} fill={isBookmarked ? 'var(--brand-purple)' : 'none'} />
    </button>
  );
};

export default BookmarkButton;
