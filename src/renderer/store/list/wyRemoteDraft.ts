import { toMD5 } from '@renderer/utils'
import { userLists } from './state'
import { createUserList, getListMusics, overwriteListMusics, removeUserList, updateUserList } from './action'
import { getBoardsList, getListDetailAll as getBoardListAll } from '@renderer/store/leaderboard/action'
import syncListToCloud from './syncListToCloud'
import { appSetting } from '@renderer/store/setting'

const SNAPSHOT_KEY = 'wy-remote-draft-snapshots'

type SnapshotMap = Record<string, string>

export interface WyRemoteTarget {
  id: string
  name: string
  remoteBoardId: string
  remoteName: string
}

let snapshots: SnapshotMap | null = null

const getSnapshots = (): SnapshotMap => {
  if (snapshots) return snapshots
  try {
    snapshots = JSON.parse(window.localStorage.getItem(SNAPSHOT_KEY) ?? '{}') as SnapshotMap
  } catch {
    snapshots = {}
  }
  return snapshots
}

const saveSnapshots = () => {
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(getSnapshots()))
}

export const getWyRemoteId = (boardId: string) => boardId.replace(/^mkr__/, '')

export const getWyRemoteTargets = async(): Promise<WyRemoteTarget[]> => {
  if (!appSetting['common.wyUserId'].trim()) return []
  const result = await getBoardsList('mkr')
  return result.list.map(item => {
    const targetList = findWyRemoteDraft(item.id)
    return {
      id: targetList?.id ?? `wy_remote_target_${getWyRemoteId(item.id)}`,
      name: item.name,
      remoteBoardId: item.id,
      remoteName: item.name,
    }
  })
}

export const resolveWyRemoteTarget = async(target: WyRemoteTarget) => {
  return ensureWyRemoteDraft(target.remoteBoardId, target.remoteName)
}

export const getWyDraftHash = (list: LX.Music.MusicInfo[]) => {
  return toMD5(list.map(musicInfo => musicInfo.id).join('\n'))
}

export const findWyRemoteDraft = (boardId: string) => {
  const remoteId = getWyRemoteId(boardId)
  return userLists.find(list => list.id == `wy_remote_${toMD5(remoteId)}`) ?? userLists.find(list => (
    list.source == 'wy' && list.sourceListId?.replace(/^wy__/, '') == remoteId
  ) || (
    list.source == 'mkr' && list.sourceListId == `board__${boardId}`
  )) ?? null
}

const setSnapshot = (remoteId: string, hash: string) => {
  getSnapshots()[remoteId] = hash
  saveSnapshots()
}

export const markWyRemoteDraftSynced = async(boardId: string, listId: string) => {
  const list = await getListMusics(listId)
  setSnapshot(getWyRemoteId(boardId), getWyDraftHash(list))
}

export const isWyRemoteDraftDirty = async(boardId: string) => {
  const targetList = findWyRemoteDraft(boardId)
  if (!targetList) return false
  const list = await getListMusics(targetList.id)
  const hash = getWyDraftHash(list)
  const remoteId = getWyRemoteId(boardId)
  const snapshot = getSnapshots()[remoteId]
  if (snapshot == null) {
    const remoteList = await getBoardListAll(boardId, true)
    const remoteHash = getWyDraftHash(remoteList)
    setSnapshot(remoteId, remoteHash)
    return remoteHash != hash
  }
  return snapshot != hash
}

export const ensureWyRemoteDraft = async(boardId: string, name: string) => {
  const remoteId = getWyRemoteId(boardId)
  let targetList = findWyRemoteDraft(boardId)
  if (targetList) {
    if (!targetList.id.startsWith('wy_remote_')) {
      const oldId = targetList.id
      const list = await getListMusics(oldId)
      const id = `wy_remote_${toMD5(remoteId)}`
      await createUserList({ id, name, source: 'wy', sourceListId: remoteId, list })
      const migratedList = userLists.find(item => item.id == id)
      if (migratedList) {
        await removeUserList([oldId])
        targetList = migratedList
      }
    }
    if (targetList.name != name || targetList.source != 'wy' || targetList.sourceListId != remoteId) {
      const targetId = targetList.id
      await updateUserList([{ ...targetList, name, source: 'wy', sourceListId: remoteId }])
      targetList = userLists.find(list => list.id == targetId) ?? targetList
    }
    if (getSnapshots()[remoteId] == null) await isWyRemoteDraftDirty(boardId)
    return targetList
  }

  const list = await getBoardListAll(boardId, true)
  const id = `wy_remote_${toMD5(remoteId)}`
  await createUserList({
    id,
    name,
    source: 'wy',
    sourceListId: remoteId,
    list,
  })
  targetList = userLists.find(item => item.id == id) ?? null
  if (!targetList) throw new Error('Failed to create NetEase playlist draft')
  setSnapshot(remoteId, getWyDraftHash(list))
  return targetList
}

export const refreshWyRemoteDraft = async(boardId: string, name: string) => {
  const remoteId = getWyRemoteId(boardId)
  const existingList = findWyRemoteDraft(boardId)
  if (existingList && !existingList.id.startsWith('wy_remote_')) await ensureWyRemoteDraft(boardId, name)
  const list = await getBoardListAll(boardId, true)
  let targetList = findWyRemoteDraft(boardId)
  if (!targetList) {
    const id = `wy_remote_${toMD5(remoteId)}`
    await createUserList({ id, name, source: 'wy', sourceListId: remoteId, list })
    targetList = userLists.find(item => item.id == id) ?? null
    if (!targetList) throw new Error('Failed to create NetEase playlist draft')
  } else if (targetList.name != name || targetList.source != 'wy' || targetList.sourceListId != remoteId) {
    const targetId = targetList.id
    await updateUserList([{ ...targetList, name, source: 'wy', sourceListId: remoteId }])
    targetList = userLists.find(item => item.id == targetId) ?? targetList
  }
  await overwriteListMusics({ listId: targetList.id, musicInfos: list })
  setSnapshot(remoteId, getWyDraftHash(list))
  return targetList
}

export const syncWyRemoteDraft = async(boardId: string) => {
  const currentList = findWyRemoteDraft(boardId)
  if (!currentList) return false
  const targetList = await ensureWyRemoteDraft(boardId, currentList.name)
  if (!targetList) return false
  const success = await syncListToCloud(targetList)
  if (success) await markWyRemoteDraftSynced(boardId, targetList.id)
  return success
}

export const saveWyRemoteDraftAsLocal = async(boardId: string, name: string) => {
  const targetList = findWyRemoteDraft(boardId)
  if (!targetList) return
  const list = await getListMusics(targetList.id)
  await createUserList({ name, list })
}
