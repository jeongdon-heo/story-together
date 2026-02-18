'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../../lib/api';

interface BranchNode {
  id: string;
  parentId: string | null;
  depth: number;
  choices: Array<{ index: number; text: string; description: string }>;
  selectedIdx: number | null;
  voteResult: Record<number, number> | null;
  status: 'voting' | 'decided';
  storyParts: Array<{ id: string; authorType: string; text: string; order: number }>;
}

interface WhatIfResult {
  choiceIdx: number;
  text: string;
}

export default function BranchTreePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [storyId, setStoryId] = useState('');
  const [nodes, setNodes] = useState<BranchNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<BranchNode | null>(null);
  const [whatIfResults, setWhatIfResults] = useState<Record<string, WhatIfResult>>({});
  const [loadingWhatIf, setLoadingWhatIf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // 세션 이야기 조회
        const storiesRes = await api.get('/stories', { params: { sessionId } });
        const story = storiesRes.data.data?.[0];
        if (!story) { setLoading(false); return; }

        setStoryId(story.id);

        // 브랜치 노드 조회
        const storyRes = await api.get(`/stories/${story.id}`);
        const fullStory = storyRes.data.data;
        setNodes(fullStory.branchNodes || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  const handleWhatIf = async (nodeId: string, choiceIdx: number) => {
    const key = `${nodeId}-${choiceIdx}`;
    if (whatIfResults[key] || loadingWhatIf === key) return;

    setLoadingWhatIf(key);
    try {
      const res = await api.post('/ai/generate-what-if', {
        storyId,
        branchNodeId: nodeId,
        choiceIdx,
      });
      setWhatIfResults((prev) => ({
        ...prev,
        [key]: { choiceIdx, text: res.data.data.text },
      }));
    } finally {
      setLoadingWhatIf(null);
    }
  };

  // 트리 레벨별 노드 그룹화
  const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
  const nodesByDepth = Array.from({ length: maxDepth + 1 }, (_, d) =>
    nodes.filter((n) => n.depth === d),
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            ← 뒤로
          </button>
          <h1 className="text-2xl font-bold text-gray-900">🌿 이야기 트리</h1>
          <p className="text-sm text-gray-500">갈림길마다 어떤 선택을 했는지 확인하고, 다른 선택지의 이야기도 탐색해 보세요!</p>
        </div>

        {nodes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-gray-500">아직 갈림길이 없어요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {nodesByDepth.map((levelNodes, depth) => (
              <div key={depth}>
                <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                  <span>{'→'.repeat(depth + 1)}</span>
                  <span>{depth + 1}번째 갈림길</span>
                </p>
                {levelNodes.map((node) => (
                  <div
                    key={node.id}
                    className="bg-white rounded-2xl border border-gray-200 p-5 mb-3"
                  >
                    <div className="space-y-2">
                      {node.choices.map((choice) => {
                        const isSelected = node.selectedIdx === choice.index;
                        const votes = (node.voteResult as any)?.[choice.index] || 0;
                        const totalVotes = node.voteResult
                          ? Object.values(node.voteResult as Record<string, number>).reduce((a, b) => a + b, 0)
                          : 0;
                        const whatIfKey = `${node.id}-${choice.index}`;
                        const whatIfResult = whatIfResults[whatIfKey];
                        const isLoadingWhatIf = loadingWhatIf === whatIfKey;

                        return (
                          <div key={choice.index}>
                            <div
                              className={`rounded-xl p-3 border-2 ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'border-gray-100 bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div>
                                  <span
                                    className={`text-sm font-semibold ${
                                      isSelected ? 'text-emerald-700' : 'text-gray-600'
                                    }`}
                                  >
                                    {isSelected ? '✅ ' : ''}{choice.text}
                                  </span>
                                  <span className="ml-2 text-xs text-gray-400">
                                    {choice.description}
                                  </span>
                                </div>
                                {totalVotes > 0 && (
                                  <span className="text-xs text-gray-400">
                                    {votes}/{totalVotes}표
                                  </span>
                                )}
                              </div>

                              {/* 만약에 버튼 (선택 안 된 것만) */}
                              {!isSelected && node.status === 'decided' && (
                                <div className="mt-2">
                                  {whatIfResult ? (
                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2">
                                      <p className="text-xs font-semibold text-purple-700 mb-1">
                                        🔮 만약에 이 선택을 했다면...
                                      </p>
                                      <p className="text-xs text-gray-700 leading-relaxed">
                                        {whatIfResult.text}
                                      </p>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleWhatIf(node.id, choice.index)}
                                      disabled={isLoadingWhatIf}
                                      className="text-xs text-purple-600 hover:text-purple-800 underline disabled:opacity-50"
                                    >
                                      {isLoadingWhatIf ? '생성 중...' : '🔮 만약에 이 길을 선택했다면?'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
