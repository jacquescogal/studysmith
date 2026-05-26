import { useEffect, useState } from "react";

import { getModuleOverview } from "@/api";
import { normalizeNoteGroups, normalizeTimeline } from "@/lib/format";

const emptyStats = {
  studyCount: 0,
  questionCount: 0,
  dueCount: 0,
  staleCount: 0
};

const emptyTimeline = {
  due: 0,
  week: 0,
  month: 0,
  sixMonths: 0,
  longTerm: 0
};

export function useModuleOverview({
  moduleId = "",
  chipFilterIds = [],
  reviewRefreshToken = 0,
  routeNoteGroupId = "",
  routeTopicId = "",
  setSelectedNoteGroupId,
  setSelectedTopicId,
  onError
} = {}) {
  const [noteGroups, setNoteGroups] = useState([]);
  const [moduleNoteGroupStats, setModuleNoteGroupStats] = useState([]);
  const [moduleStats, setModuleStats] = useState(emptyStats);
  const [moduleQuestionTimeline, setModuleQuestionTimeline] = useState(emptyTimeline);
  const [moduleStatsLoading, setModuleStatsLoading] = useState(false);
  const [moduleStatsError, setModuleStatsError] = useState("");

  useEffect(() => {
    if (!moduleId) {
      setNoteGroups([]);
      if (!routeNoteGroupId) {
        setSelectedNoteGroupId?.("");
      }
      if (!routeTopicId) {
        setSelectedTopicId?.("");
      }
      setModuleNoteGroupStats([]);
      setModuleStats(emptyStats);
      setModuleQuestionTimeline(emptyTimeline);
      setModuleStatsError("");
      setModuleStatsLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadModuleOverview = async () => {
      setModuleStatsLoading(true);
      setModuleStatsError("");
      try {
        const data = await getModuleOverview(moduleId, chipFilterIds);
        if (cancelled) {
          return;
        }
        const groups = normalizeNoteGroups(data.note_groups || []);
        const stats = (data.note_group_stats || []).map((group) => {
          const timeline = normalizeTimeline(group.timeline);
          return {
            id: group.id,
            title: group.title || "Untitled note group",
            studyCount: group.study_count || 0,
            questionCount: group.question_count || 0,
            dueCount: group.due_count || timeline.due,
            staleCount: group.stale_count || 0,
            timeline
          };
        });
        const moduleOverviewStats = data.module_stats || {};
        setNoteGroups(groups);
        setSelectedNoteGroupId?.((currentId) => {
          if (!routeNoteGroupId && currentId && !groups.some((group) => group.id === currentId)) {
            return "";
          }
          return currentId;
        });
        setModuleNoteGroupStats(stats);
        setModuleStats({
          studyCount: moduleOverviewStats.study_count || 0,
          questionCount: moduleOverviewStats.question_count || 0,
          dueCount: moduleOverviewStats.due_count || 0,
          staleCount: moduleOverviewStats.stale_count || 0
        });
        setModuleQuestionTimeline(normalizeTimeline(data.module_timeline));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setNoteGroups([]);
        setModuleNoteGroupStats([]);
        setModuleStats(emptyStats);
        setModuleQuestionTimeline(emptyTimeline);
        setModuleStatsError(error.message || "Failed to load module overview");
        onError?.(error);
      } finally {
        if (!cancelled) {
          setModuleStatsLoading(false);
        }
      }
    };

    loadModuleOverview();
    return () => {
      cancelled = true;
    };
  }, [
    chipFilterIds,
    moduleId,
    onError,
    reviewRefreshToken,
    routeNoteGroupId,
    routeTopicId,
    setSelectedNoteGroupId,
    setSelectedTopicId
  ]);

  return {
    noteGroups,
    setNoteGroups,
    moduleNoteGroupStats,
    moduleStats,
    moduleQuestionTimeline,
    moduleStatsLoading,
    moduleStatsError
  };
}
