import { markRawList } from '@common/utils/vueTools'
import music from '@renderer/utils/musicSdk'

import type { ListInfoItem } from './state'
import { maxPages, listInfos } from './state'

interface SearchResult {
  list: ListInfoItem[]
  total: number
  limit: number
}

export const resetListInfo = (sourceId: LX.OnlineSource): [] => {
  const listInfo = listInfos[sourceId]
  if (!listInfo) return []
  listInfo.page = 1
  listInfo.total = 0
  listInfo.list = []
  listInfo.key = null
  listInfo.noItemLabel = ''
  return []
}

export const search = async(text: string, page: number, sourceId: LX.OnlineSource): Promise<ListInfoItem[]> => {
  const listInfo = listInfos[sourceId]
  if (!listInfo) return []
  if (!text) return resetListInfo(sourceId)

  const key = `${page}__${sourceId}__${text}`
  // 命中缓存：直接复用上次结果，不再联网
  if (listInfo.key == key && listInfo.list.length) return listInfo.list

  listInfo.noItemLabel = window.i18n.t('list__loading')
  listInfo.key = key

  const searchReq = (music as any)[sourceId]?.artist?.search?.(text, page, listInfo.limit)
  if (!searchReq) {
    resetListInfo(sourceId)
    listInfo.noItemLabel = window.i18n.t('list__load_failed')
    throw new Error('source not found or artist search not supported: ' + sourceId)
  }

  return searchReq.then((data: SearchResult) => {
    // 结果回来时关键词/页码已经变了，丢弃
    if (key != listInfo.key) return []
    listInfo.list = markRawList(data.list)
    listInfo.page = page
    listInfo.limit = data.limit || listInfo.limit
    if (page == 1 || (data.total && data.list.length)) listInfo.total = data.total
    else listInfo.total = listInfo.limit * page
    maxPages[sourceId] = Math.ceil(listInfo.total / listInfo.limit)
    listInfo.noItemLabel = data.list.length ? '' : window.i18n.t('no_item')
    return listInfo.list
  }).catch((error: any) => {
    if (key != listInfo.key) return []
    resetListInfo(sourceId)
    listInfo.noItemLabel = window.i18n.t('list__load_failed')
    console.log(error)
    throw error
  })
}
