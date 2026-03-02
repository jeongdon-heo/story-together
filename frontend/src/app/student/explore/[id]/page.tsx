'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { toBackendURL } from '../../../../lib/api';
import {
  publishApi,
  type PublishedStoryDetail,
  MODE_EMOJI,
  MODE_LABELS,
} from '../../../../lib/publish-api';

const LIKED_KEY = 'story_liked_ids';

function getLikedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveLikedId(id: string) {
  const ids = getLikedIds();
  ids.add(id);
  localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(ids)));
}

export default function ExploreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isTeacher } = useAuth();
  const homePath = isTeacher ? '/teacher' : '/student';
  const publishedId = params.id as string;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [story, setStory] = useState<PublishedStoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<PublishedStoryDetail['comments']>([]);

  useEffect(() => {
    publishApi.getById(publishedId).then((res) => {
      if (res.data) {
        setStory(res.data);
        setLikeCount(res.data.likeCount);
        setComments(res.data.comments);
        setLiked(getLikedIds().has(publishedId));
      }
    }).catch(() => {
      router.push('/student/explore');
    }).finally(() => setLoading(false));
  }, [publishedId, router]);

  const handleLike = async () => {
    if (liked || liking) return;
    setLiking(true);
    try {
      const res = await publishApi.like(publishedId);
      if (res.data) {
        setLikeCount(res.data.likeCount);
        setLiked(true);
        saveLikedId(publishedId);
      }
    } catch {}
    setLiking(false);
  };

  const handleComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await publishApi.comment(publishedId, commentText.trim());
      if (res.data) {
        setComments((prev) => [...prev, res.data]);
        setCommentText('');
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch {}
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!story) return null;

  const cover = story.story.illustrations.find((i) => i.isCover);
  const illustrationMap = new Map(
    story.story.illustrations
      .filter((i) => !i.isCover)
      .map((i) => [i.sceneIndex, i.imageUrl]),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-indigo-100">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">
            {story.story.authorName}의 이야기
          </p>
          <p className="text-xs text-gray-400">
            {MODE_EMOJI[story.story.mode]} {MODE_LABELS[story.story.mode]} · {story.classRoom.name}
          </p>
        </div>
        {/* 좋아요 */}
        <button
          onClick={handleLike}
          disabled={liked || liking}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm transition-all ${
            liked
              ? 'bg-red-100 text-red-500'
              : 'bg-white border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-400'
          }`}
        >
          <span>{liked ? '❤️' : '🤍'}</span>
          <span>{likeCount}</span>
        </button>
        <button onClick={() => router.push(homePath)} className="text-gray-400 hover:text-gray-700" title="홈으로">🏠</button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5">
        {/* 안내 카드 */}
        <div className="bg-white rounded-2xl border border-indigo-100 p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1">📖 이야기 읽기</h3>
          <p className="text-xs text-gray-500 leading-relaxed">친구가 쓴 이야기를 읽어 보세요. 좋아요와 댓글로 응원해 주세요!</p>
        </div>

        {/* 표지 이미지 */}
        {cover && (
          <div className="rounded-2xl overflow-hidden mb-5 shadow-lg">
            <img src={toBackendURL(cover.imageUrl)} alt="표지" className="w-full object-cover max-h-72" />
          </div>
        )}

        {/* 이야기 본문 */}
        <div className="space-y-3 mb-8">
          {story.story.parts.map((part, idx) => {
            const isAi = part.authorType === 'ai';
            // 학생 파트 뒤에 삽화가 있으면 삽입
            const illus = illustrationMap.get(Math.floor(idx / 2));

            return (
              <div key={part.id}>
                <div
                  className={`rounded-2xl p-4 ${
                    isAi
                      ? 'bg-white border border-indigo-100 border-l-4 border-l-indigo-300'
                      : 'bg-amber-50 border border-amber-100 border-l-4 border-l-amber-400'
                  }`}
                >
                  <p className={`text-xs font-bold mb-2 ${isAi ? 'text-indigo-400' : 'text-amber-600'}`}>
                    {isAi ? '🤖 AI' : `✏️ ${story.story.authorName}`}
                  </p>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {part.text}
                  </p>
                </div>
                {illus && !isAi && (
                  <div className="my-3 rounded-2xl overflow-hidden shadow-sm">
                    <img src={illus} alt="삽화" className="w-full object-cover max-h-56" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 댓글 섹션 */}
        <div className="bg-white rounded-2xl border border-indigo-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            💬 댓글 <span className="text-gray-400 text-sm font-normal">({comments.length})</span>
          </h3>

          {comments.length === 0 ? (
            <p className="text-center text-gray-300 text-sm py-4">
              첫 번째 댓글을 달아보세요!
            </p>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs flex-none font-bold text-indigo-600">
                    {c.author.slice(0, 1)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-gray-900">{c.author}</span>
                      <span className="text-xs text-gray-300">
                        {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 댓글 입력 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
              placeholder="이야기 감상을 남겨요..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              maxLength={200}
            />
            <button
              onClick={handleComment}
              disabled={!commentText.trim() || submitting}
              className="bg-indigo-500 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-indigo-600 transition-colors disabled:opacity-40"
            >
              등록
            </button>
          </div>
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
