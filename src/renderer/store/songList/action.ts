// import { getSongListSetting } from '@renderer/utils/data'
import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import { markRaw, markRawList } from '@common/utils/vueTools'
import {
  tags,
  listInfo,
  listDetailInfo,
  selectListInfo,
  isVisibleListDetail,
  openSongListInputInfo,
} from './state'
import type {
  ListDetailInfo,
  ListDetailType,
  ListInfoItem,
  ListInfo,
  TagInfo,
} from './state'

const cache = new Map<string, any>()

export const setTags = (tagInfo: TagInfo, source: LX.OnlineSource) => {
  tags[source] = markRaw(tagInfo)
}

export const clearList = () => {
  listInfo.list = []
  listInfo.total = 0
  listInfo.noItemLabel = ''
  listInfo.page = 1
  listInfo.key = ''
}

export const setList = (result: ListInfo, tagId: string, sortId: string, page: number) => {
  listInfo.list = markRaw([...result.list])
  if (page == 1 || (result.total && result.list.length)) listInfo.total = result.total
  else listInfo.total = result.limit * page
  listInfo.limit = result.limit
  listInfo.page = page
  listInfo.source = result.source
  listInfo.tagId = tagId
  listInfo.sortId = sortId
  if (result.list.length) listInfo.noItemLabel = ''
  else if (page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
}
export const setListDetail = (result: ListDetailInfo, id: string, page: number, detailType: ListDetailType = 'songList', key?: string) => {
  listDetailInfo.list = markRaw([...result.list])
  listDetailInfo.id = id
  listDetailInfo.source = result.source
  listDetailInfo.detailType = detailType
  if (key != null) listDetailInfo.key = key
  if (page == 1 || (result.total && result.list.length)) listDetailInfo.total = result.total
  else listDetailInfo.total = result.limit * page
  listDetailInfo.limit = result.limit
  listDetailInfo.page = page
  listDetailInfo.info = markRaw({ ...result.info })
  if (result.list.length) listDetailInfo.noItemLabel = ''
  else if (page == 1) listDetailInfo.noItemLabel = window.i18n.t('no_item')
}

export const setSelectListInfo = (info: ListInfoItem) => {
  selectListInfo.author = info.author
  selectListInfo.desc = info.desc
  selectListInfo.id = info.id
  selectListInfo.img = info.img
  selectListInfo.name = info.name
  selectListInfo.play_count = info.play_count
  selectListInfo.source = info.source
}
export const clearListDetail = () => {
  listDetailInfo.list = []
  listDetailInfo.id = ''
  listDetailInfo.source = 'kw'
  listDetailInfo.total = 0
  listDetailInfo.limit = 30
  listDetailInfo.page = 1
  listDetailInfo.key = null
  listDetailInfo.detailType = 'songList'
  listDetailInfo.scrollPosition = 0
  listDetailInfo.info = {}
  listDetailInfo.noItemLabel = ''
}

export const getListDetailRouteQuery = () => ({
  source: listDetailInfo.source,
  id: listDetailInfo.id,
  page: listDetailInfo.page.toString(),
  picUrl: listDetailInfo.info.img ?? '',
  ...(listDetailInfo.detailType == 'album' ? { type: 'album' as const } : {}),
})

export const getTags = async<T extends LX.OnlineSource>(source: T) => {
  return musicSdk[source]?.songList.getTags() as Promise<TagInfo<T>>
}


/**
 * 获取歌单列表
 * @param source 歌单源
 * @param tabId 类型id
 * @param sortId 排序
 * @param page 页数
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getAndSetList = async(source: LX.OnlineSource, tabId: string, sortId: string, page: number, isRefresh = false) => {
  // let source = rootState.setting.songList.source
  // let tabId = rootState.setting.songList.tagInfo.id
  // let sortId = rootState.setting.songList.sortId
  // console.log(sortId)
  let key = `slist__${source}__${sortId}__${tabId}__${page}`
  // if (state.list.list.length && state.list.key == key) return
  if (!isRefresh) {
    if (listInfo.key == key && listInfo.list.length) return
    if (cache.has(key)) {
      listInfo.key = key
      setList(cache.get(key), tabId, sortId, page)
      return
    }
  }
  listInfo.noItemLabel = window.i18n.t('list__loading')
  listInfo.key = key
  // clearList()
  return musicSdk[source]?.songList.getList(sortId, tabId, page).then((result: ListInfo) => {
    cache.set(key, result)
    if (key != listInfo.key) return
    setList(result, tabId, sortId, page)
  }).catch((error: any) => {
    clearList()
    listInfo.noItemLabel = window.i18n.t('list__load_failed')
    console.log(error)
    throw error
  })
}

/**
 * 获取歌单内单页歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetail = async(id: string, source: LX.OnlineSource, page: number, isRefresh = false): Promise<ListDetailInfo> => {
  let key = `sdetail__${source}__${id}__${page}`
  if (!isRefresh && cache.has(key)) return cache.get(key)

  return musicSdk[source]?.songList.getListDetail(id, page).then((result: ListDetailInfo) => {
    result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
    cache.set(key, result)
    return result
  })
}

export const getAlbumDetailKey = (id: string, source: LX.OnlineSource) => `sdetail__album__${source}__${id}`

/**
 * 获取专辑内歌曲及专辑信息
 */
export const getAlbumDetail = async(id: string, source: LX.OnlineSource, isRefresh = false): Promise<ListDetailInfo> => {
  const key = getAlbumDetailKey(id, source)
  if (isRefresh && cache.has(key)) cache.delete(key)
  if (!isRefresh && cache.has(key)) return cache.get(key)

  const albumReq = (musicSdk as any)[source]?.album?.getAlbumDetail
  if (!albumReq) return Promise.reject(new Error('Album not supported in source: ' + source))

  return albumReq(id).then((detail: any) => {
    const detailList = detail.list ?? []
    const result: ListDetailInfo = {
      list: markRawList(detailList.map((item: any) => toNewMusicInfo(item)) as LX.Music.MusicInfoOnline[]),
      source,
      desc: detail.info?.desc ?? null,
      total: detailList.length,
      page: 1,
      limit: detailList.length || 1000,
      key,
      id,
      detailType: 'album',
      scrollPosition: 0,
      info: {
        name: detail.info?.name || '',
        author: detail.info?.singer || '',
        img: detail.info?.img || '',
        desc: `发行时间：${detail.info?.publishTime || '未知'}\n发行公司：${detail.info?.company || '未知'}\n\n${detail.info?.desc || ''}`,
        play_count: '',
      },
      noItemLabel: '',
    }
    cache.set(key, result)
    return result
  })
}

/**
 * 获取并设置专辑详情。返回 true 表示复用了当前页面缓存。
 */
export const getAndSetAlbumDetail = async(id: string, source: LX.OnlineSource, isRefresh = false): Promise<boolean> => {
  const key = getAlbumDetailKey(id, source)
  const isCurrentCache = !isRefresh && listDetailInfo.key == key && listDetailInfo.detailType == 'album' && cache.has(key)
  if (isCurrentCache) return true

  listDetailInfo.key = key
  listDetailInfo.detailType = 'album'
  listDetailInfo.id = id
  listDetailInfo.source = source
  listDetailInfo.page = 1
  listDetailInfo.scrollPosition = 0
  listDetailInfo.noItemLabel = window.i18n.t('list__loading')
  listDetailInfo.info = { name: '', author: '', img: '', desc: '', play_count: '' }
  listDetailInfo.list = []

  return getAlbumDetail(id, source, isRefresh).then(result => {
    if (key != listDetailInfo.key) return false
    setListDetail(result, id, 1, 'album', key)
    return false
  }).catch((error: any) => {
    if (key != listDetailInfo.key) return false
    clearListDetail()
    listDetailInfo.noItemLabel = window.i18n.t('list__load_failed')
    console.log(error)
    throw error
  })
}

/**
 * 获取歌单内全部歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetailAll = async(id: string, source: LX.OnlineSource, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  // console.log(source, id)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const loadData = (id: string, page: number): Promise<ListDetailInfo> => {
    let key = `sdetail__${source}__${id}__${page}`
    if (isRefresh && cache.has(key)) cache.delete(key)
    return cache.has(key)
      ? Promise.resolve(cache.get(key))
      : musicSdk[source]?.songList.getListDetail(id, page).then((result: ListDetailInfo) => {
        result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
        cache.set(key, result)
        return result
      }) ?? Promise.reject(new Error('source not found' + source))
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return loadData(id, 1).then((result: ListDetailInfo) => {
    if (result.total <= result.limit) return result.list

    let maxPage = Math.ceil(result.total / result.limit)
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const loadDetail = (loadPage = 2): Promise<ListDetailInfo['list']> => {
      return loadPage == maxPage
        ? loadData(id, loadPage).then((result: ListDetailInfo) => result.list)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        : loadData(id, loadPage).then((result1: ListDetailInfo) => loadDetail(++loadPage).then((result2: ListDetailInfo['list']) => [...result1.list, ...result2]))
    }
    return loadDetail().then(result2 => [...result.list, ...result2])
  }).then((list: ListDetailInfo['list']) => deduplicationList(list))
}


/**
 * 获取并设置歌单内单页歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getAndSetListDetail = async(id: string, source: LX.OnlineSource, page: number, isRefresh = false) => {
  let key = `sdetail__${source}__${id}__${page}`

  if (!isRefresh && listDetailInfo.key == key && listDetailInfo.list.length) return

  listDetailInfo.key = key
  listDetailInfo.detailType = 'songList'
  listDetailInfo.scrollPosition = 0
  listDetailInfo.noItemLabel = window.i18n.t('list__loading')

  return getListDetail(id, source, page, isRefresh).then((result: ListDetailInfo) => {
    if (key != listDetailInfo.key) return
    setListDetail(result, id, page)
  }).catch((error: any) => {
    clearListDetail()
    listDetailInfo.noItemLabel = window.i18n.t('list__load_failed')
    console.log(error)
    throw error
  })
}

export const setVisibleListDetail = (visible: boolean) => {
  isVisibleListDetail.value = visible
}

export const setOpenSongListInputInfo = (text: string, source: string) => {
  openSongListInputInfo.text = text
  openSongListInputInfo.source = source
}
