import { tempListMeta, userLists } from '@renderer/store/list/state'
import { dialog } from '@renderer/plugins/Dialog'
import syncSourceList from '@renderer/store/list/syncSourceList'
import { getListDetail, getListDetailAll } from '@renderer/store/songList/action'
import { createUserList, setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'
import { LIST_IDS } from '@common/constants'
import { toMD5 } from '@renderer/utils'
import music from '@renderer/utils/musicSdk'

// 把清洗工具也引入进来
import { toNewMusicInfo } from '@common/utils/tools'

const getListId = (id: string, source: LX.OnlineSource) => `${source}__${id}`

export const addSongListDetail = async(id: string, source: LX.OnlineSource, name?: string, isAlbum: boolean = false) => {
  const listId = getListId(id, source)
  const targetList = userLists.find(l => l.sourceListId == listId)
  if (targetList) {
    const confirm = await dialog.confirm({
      message: window.i18n.t('duplicate_list_tip', { name: targetList.name }),
      cancelButtonText: window.i18n.t('lists__import_part_button_cancel'),
      confirmButtonText: window.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    void syncSourceList(targetList)
    return
  }

  let list
  if (isAlbum) {
    const albumReq = (music as any)[source]?.album?.getAlbumDetail
    if (!albumReq) throw new Error('Album not supported in source: ' + source)
    const detail = await albumReq(id)
    // 收藏时，必须把专辑歌曲洗成 V2 格式再入库！
    list = detail.list.map((m: any) => toNewMusicInfo(m))
  } else {
    list = await getListDetailAll(id, source)
  }

  await createUserList({
    name,
    id: `${source}_${toMD5(listId)}`,
    list,
    source,
    sourceListId: id,
  })
}

export const playSongListDetail = async(id: string, source: LX.OnlineSource, list?: LX.Music.MusicInfoOnline[], index: number = 0, isAlbum: boolean = false) => {
  let isPlayingList = false
  const listId = getListId(id, source)

  if (!list?.length) {
    if (isAlbum) {
      const albumReq = (music as any)[source]?.album?.getAlbumDetail
      if (!albumReq) throw new Error('Album not supported in source: ' + source)
      const detail = await albumReq(id)
      // 兜底获取第一页时，也要洗数据
      list = detail.list.map((m: any) => toNewMusicInfo(m))
    } else {
      list = (await getListDetail(id, source, 1)).list
    }
  }

  if (list?.length) {
    await setTempList(listId, [...list])
    playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }

  let fullList
  if (isAlbum) {
    const albumReq = (music as any)[source]?.album?.getAlbumDetail
    const detail = await albumReq(id)
    fullList = detail.list.map((m: any) => toNewMusicInfo(m))
  } else {
    fullList = await getListDetailAll(id, source)
  }

  if (!fullList.length) return

  if (isPlayingList) {
    if (tempListMeta.id == listId) {
      await setTempList(listId, [...fullList])
    }
  } else {
    await setTempList(listId, [...fullList])
    playList(LIST_IDS.TEMP, index)
  }
}
