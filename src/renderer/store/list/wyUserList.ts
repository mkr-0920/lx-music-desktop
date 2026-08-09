import { ref, reactive } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { getBoardsList } from '@renderer/store/leaderboard/action'
import { type BoardItem } from '@renderer/store/leaderboard/state'
import { isWyRemoteDraftDirty } from './wyRemoteDraft'

export type WyListStatus = 'idle' | 'loading' | 'loaded' | 'error'

/** 网易云用户歌单列表（模块级，跨组件挂载存活） */
export const wyLists = ref<BoardItem[]>([])
export const wyListStatus = ref<WyListStatus>('idle')
/** boardId -> 本地草稿是否与云端不一致 */
export const wyDirtyStatus = reactive<Record<string, boolean>>({})

/** 已成功加载过的网易云用户 id，与当前设置不一致时缓存失效 */
let loadedUserId: string | null = null
let loadingPromise: Promise<void> | null = null

export const getWyUserId = () => appSetting['common.wyUserId'].trim()

export const updateWyDirtyStatus = async(boardId: string) => {
  wyDirtyStatus[boardId] = await isWyRemoteDraftDirty(boardId)
  return wyDirtyStatus[boardId]
}

const reset = () => {
  wyLists.value = []
  wyListStatus.value = 'idle'
  loadedUserId = null
  for (const key of Object.keys(wyDirtyStatus)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete wyDirtyStatus[key]
  }
}

const doLoad = async(userId: string) => {
  wyListStatus.value = 'loading'
  try {
    const result = await getBoardsList('mkr')
    wyLists.value = result.list
    wyListStatus.value = 'loaded'
    loadedUserId = userId

    // 丢弃已不存在的歌单的脏标记，其余就地重算（不清空，避免 ● 标记闪烁）
    const ids = new Set(result.list.map(item => item.id))
    for (const key of Object.keys(wyDirtyStatus)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      if (!ids.has(key)) delete wyDirtyStatus[key]
    }
    await Promise.all(result.list.map(async item => updateWyDirtyStatus(item.id)))
  } catch (error) {
    console.error('[WY User List] Failed to load playlists:', error)
    wyLists.value = []
    wyListStatus.value = 'error'
    loadedUserId = null
  }
}

/**
 * 加载网易云用户歌单列表
 * @param force 跳过缓存强制重新拉取（侧栏刷新按钮用）
 */
export const loadWyLists = async(force = false) => {
  const userId = getWyUserId()
  if (!userId) {
    reset()
    return
  }
  // 命中缓存：同一账号且已有数据，不再联网
  if (!force && loadedUserId == userId && wyLists.value.length) return
  // 并发去重：同一时刻只跑一次请求
  if (loadingPromise && !force) return loadingPromise

  const promise: Promise<void> = doLoad(userId).finally(() => {
    if (loadingPromise === promise) loadingPromise = null
  })
  loadingPromise = promise
  return promise
}
