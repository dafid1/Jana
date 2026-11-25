import { Story, UserProfile } from '../types/telegram';

export interface StoryAuthorGroup {
  userId: string;
  userName: string;
  userAvatar?: string;
  stories: Story[];
  unviewedCount: number;
  allViewed: boolean;
  latestCreatedAt: string;
  firstStoryFlatIndex: number;
  firstUnviewedFlatIndex: number;
}

export interface GroupedStoriesResult {
  myGroup: StoryAuthorGroup | null;
  otherGroups: StoryAuthorGroup[];
  allGroups: StoryAuthorGroup[];
  orderedStories: Story[];
}

export function isStoryViewedByUser(story: Story, uid?: string): boolean {
  if (!uid) return false;
  if (story.userId === uid) return true;
  return Array.isArray(story.viewedBy) && story.viewedBy.includes(uid);
}

/**
 * Groups stories by author in authentic Telegram order:
 * - Current user's stories first (if any)
 * - Unviewed authors next (most recent first)
 * - Viewed authors last (most recent first)
 * Inside each author group, stories play chronologically (oldest -> newest).
 */
export function groupStoriesByAuthor(
  stories: Story[],
  currentUserId?: string,
  usersMap: Record<string, UserProfile> = {}
): GroupedStoriesResult {
  const byUser = new Map<string, Story[]>();

  for (const s of stories) {
    if (!s.userId) continue;
    const list = byUser.get(s.userId) || [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  const rawGroups: Omit<StoryAuthorGroup, 'firstStoryFlatIndex' | 'firstUnviewedFlatIndex'>[] = [];

  byUser.forEach((userStories, userId) => {
    const sortedChronological = [...userStories].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const latest = sortedChronological[sortedChronological.length - 1];
    const author = usersMap[userId];
    const unviewedCount = sortedChronological.filter(
      (s) => !isStoryViewedByUser(s, currentUserId)
    ).length;

    rawGroups.push({
      userId,
      userName: author?.displayName || latest?.userName || 'مستخدم',
      userAvatar: author?.photoURL || latest?.userAvatar || '',
      stories: sortedChronological,
      unviewedCount,
      allViewed: unviewedCount === 0,
      latestCreatedAt: latest?.createdAt || '',
    });
  });

  const myRaw = currentUserId
    ? rawGroups.find((g) => g.userId === currentUserId) || null
    : null;

  const othersRaw = rawGroups
    .filter((g) => g.userId !== currentUserId)
    .sort((a, b) => {
      if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    });

  const orderedRaw = myRaw ? [myRaw, ...othersRaw] : othersRaw;
  const orderedStories: Story[] = [];
  const allGroups: StoryAuthorGroup[] = [];

  for (const g of orderedRaw) {
    const firstStoryFlatIndex = orderedStories.length;
    let firstUnviewedFlatIndex = firstStoryFlatIndex;
    let foundUnviewed = false;

    for (let i = 0; i < g.stories.length; i++) {
      const story = g.stories[i];
      if (!foundUnviewed && !isStoryViewedByUser(story, currentUserId)) {
        firstUnviewedFlatIndex = orderedStories.length;
        foundUnviewed = true;
      }
      orderedStories.push(story);
    }

    allGroups.push({
      ...g,
      firstStoryFlatIndex,
      firstUnviewedFlatIndex,
    });
  }

  const myGroup = allGroups.find((g) => g.userId === currentUserId) || null;
  const otherGroups = allGroups.filter((g) => g.userId !== currentUserId);

  return {
    myGroup,
    otherGroups,
    allGroups,
    orderedStories,
  };
}
