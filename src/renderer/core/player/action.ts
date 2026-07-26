import { isEmpty, setPause, setPlay, setResource, setStop } from '@renderer/plugins/player'
import { isPlay, playInfo, playMusicInfo, playQueue, playQueueIndex, musicInfo as _musicInfo } from '@renderer/store/player/state'
import {
  getList,
  clearPlayedList,
  clearTempPlayeList,
  setPlayMusicInfo,
  setMusicInfo,
  setAllStatus,
  setPlaybackSource,
  setPlayListId,
  createPlayQueueItem,
  replacePlayQueue,
  setPlayQueueIndex,
} from '@renderer/store/player/action'
import { appSetting } from '@renderer/store/setting'
import { getMusicUrl, getPicPath, getLyricInfo } from '../music/index'
import { requestMsg } from '@renderer/utils/message'
import { getRandom } from '@renderer/utils/index'
import { addListMusics, removeListMusics } from '@renderer/store/list/action'
import { loveList } from '@renderer/store/list/state'
import { addDislikeInfo } from '@renderer/core/dislikeList'
import { dislikeInfo } from '@renderer/store/dislikeList/state'
import { SPLIT_CHAR } from '@common/constants'
// import { checkMusicFileAvailable } from '@renderer/utils/music'

let gettingUrlId = ''
const createGettingUrlId = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const tInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.meta.toggleMusicInfo : musicInfo.meta.toggleMusicInfo
  return `${musicInfo.id}_${tInfo?.id ?? ''}`
}
const createDelayNextTimeout = (delay: number) => {
  let timeout: NodeJS.Timeout | null
  const clearDelayNextTimeout = () => {
    // console.log(this.timeout)
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    timeout = setTimeout(() => {
      timeout = null
      if (window.lx.isPlayedStop) return
      console.warn('delay next timeout timeout', delay)
      void playNext(true)
    }, delay)
  }

  return {
    clearDelayNextTimeout,
    addDelayNextTimeout,
  }
}
const { addDelayNextTimeout, clearDelayNextTimeout } = createDelayNextTimeout(5000)
const { addDelayNextTimeout: addLoadTimeout, clearDelayNextTimeout: clearLoadTimeout } = createDelayNextTimeout(100000)

/**
 * 检查音乐信息是否已更改
 */
const diffCurrentMusicInfo = (curMusicInfo: LX.Music.MusicInfo | LX.Download.ListItem): boolean => {
  // return curMusicInfo !== playMusicInfo.musicInfo || isPlay.value
  return gettingUrlId != createGettingUrlId(curMusicInfo) || curMusicInfo.id != playMusicInfo.musicInfo?.id || isPlay.value
}

let cancelDelayRetry: (() => void) | null = null
const delayRetry = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh = false): Promise<string | null> => {
  // if (cancelDelayRetry) cancelDelayRetry()
  return new Promise<string | null>((resolve, reject) => {
    const time = getRandom(2, 6)
    setAllStatus(window.i18n.t('player__getting_url_delay_retry', { time }))
    const tiemout = setTimeout(() => {
      getMusicPlayUrl(musicInfo, isRefresh, true).then((result) => {
        cancelDelayRetry = null
        resolve(result)
      }).catch(async(err: any) => {
        cancelDelayRetry = null
        reject(err)
      })
    }, time * 1000)
    cancelDelayRetry = () => {
      clearTimeout(tiemout)
      cancelDelayRetry = null
      resolve(null)
    }
  })
}
const getMusicPlayUrl = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh = false, isRetryed = false): Promise<string | null> => {
  // this.musicInfo.url = await getMusicPlayUrl(targetSong, type)
  setAllStatus(window.i18n.t('player__getting_url'))
  if (appSetting['player.autoSkipOnError']) addLoadTimeout()

  // const type = getPlayType(appSetting['player.highQuality'], musicInfo)
  let toggleMusicInfo = ('progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo).meta.toggleMusicInfo

  return (toggleMusicInfo ? getMusicUrl({
    musicInfo: toggleMusicInfo,
    isRefresh,
    allowToggleSource: false,
  }) : Promise.reject(new Error('not found'))).catch(async() => {
    const sourceMusicInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
    if (!diffCurrentMusicInfo(musicInfo)) setPlaybackSource(sourceMusicInfo.source)
    return getMusicUrl({
      musicInfo,
      isRefresh,
      onToggleSource(mInfo) {
        if (diffCurrentMusicInfo(musicInfo)) return
        if (mInfo) setPlaybackSource(mInfo.source)
        setAllStatus(window.i18n.t('toggle_source_try'))
      },
    })
  }).then(url => {
    if (window.lx.isPlayedStop || diffCurrentMusicInfo(musicInfo)) return null

    return url
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch(err => {
    // console.log('err', err.message)
    if (window.lx.isPlayedStop ||
      diffCurrentMusicInfo(musicInfo) ||
      err.message == requestMsg.cancelRequest) return null

    if (err.message == requestMsg.tooManyRequests) return delayRetry(musicInfo, isRefresh)

    if (!isRetryed) return getMusicPlayUrl(musicInfo, isRefresh, true)

    throw err
  })
}

export const setMusicUrl = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh?: boolean) => {
  // if (appSetting['player.autoSkipOnError']) addLoadTimeout()
  if (!diffCurrentMusicInfo(musicInfo)) return
  const sourceMusicInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  setPlaybackSource(sourceMusicInfo.meta.toggleMusicInfo?.source ?? sourceMusicInfo.source)
  if (cancelDelayRetry) cancelDelayRetry()
  gettingUrlId = createGettingUrlId(musicInfo)
  void getMusicPlayUrl(musicInfo, isRefresh).then((url) => {
    if (!url) return
    setResource(url)
  }).catch((err: any) => {
    console.log(err)
    setAllStatus(err.message)
    window.app_event.error()
    if (appSetting['player.autoSkipOnError']) addDelayNextTimeout()
  }).finally(() => {
    if (musicInfo === playMusicInfo.musicInfo) {
      gettingUrlId = ''
      clearLoadTimeout()
    }
  })
}

// 恢复上次播放的状态
const handleRestorePlay = async(restorePlayInfo: LX.Player.SavedPlayInfo) => {
  const musicInfo = playMusicInfo.musicInfo
  if (!musicInfo) return

  setImmediate(() => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    window.app_event.setProgress(appSetting['player.isSavePlayTime'] ? restorePlayInfo.time : 0, restorePlayInfo.maxTime)
    window.app_event.pause()
  })


  void getPicPath({ musicInfo, listId: playMusicInfo.listId }).then((url: string) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id || url == _musicInfo.pic) return
    setMusicInfo({ pic: url })
    window.app_event.picUpdated()
  }).catch(_ => _)

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    window.app_event.lyricUpdated()
  }).catch((err) => {
    console.log(err)
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setAllStatus(window.i18n.t('lyric__load_error'))
  })
}


// 处理音乐播放
const handlePlay = () => {
  window.lx.isPlayedStop &&= false

  resetRandomNextMusicInfo()
  if (window.lx.restorePlayInfo) {
    void handleRestorePlay(window.lx.restorePlayInfo)
    window.lx.restorePlayInfo = null
    return
  }
  const musicInfo = playMusicInfo.musicInfo

  if (!musicInfo) return

  setStop()
  window.app_event.pause()

  clearDelayNextTimeout()
  clearLoadTimeout()


  setMusicUrl(musicInfo)

  void getPicPath({ musicInfo, listId: playMusicInfo.listId }).then((url: string) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id || url == _musicInfo.pic) return
    setMusicInfo({ pic: url })
    window.app_event.picUpdated()
  }).catch(_ => _)

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    window.app_event.lyricUpdated()
  }).catch((err) => {
    console.log(err)
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setAllStatus(window.i18n.t('lyric__load_error'))
  })
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param id 歌曲id
 */
export const playListById = (listId: string, id: string) => {
  const index = getList(listId).findIndex(m => m.id == id)
  if (index < 0) return
  playList(listId, index)
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param index 播放的歌曲位置
 */
export const playList = (listId: string, index: number) => {
  const prevListId = playInfo.playerListId
  const list = getList(listId)
  if (!list[index]) return
  setPlayListId(listId)

  let queue = list.map((musicInfo, sourceIndex) => createPlayQueueItem({
    musicInfo,
    listId,
    sourceIndex,
  })).filter(item => item.sourceIndex == index || isQueueMusicPlayable(item.musicInfo))
  let queueIndex = queue.findIndex(item => item.sourceIndex == index)
  if (appSetting['player.togglePlayMethod'] == 'random') {
    const [current] = queue.splice(queueIndex, 1)
    shuffleQueue(queue)
    queue.unshift(current)
    queueIndex = 0
  }
  replacePlayQueue(queue, queueIndex)
  setPlayMusicInfo(listId, playQueue[queueIndex].musicInfo)
  if (appSetting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  handlePlay()
}

const handleToggleStop = () => {
  stop()
  setTimeout(() => {
    setPlayMusicInfo(null, null)
  })
}

export const resetRandomNextMusicInfo = () => {
  // The explicit queue already keeps a stable random order.
}

const shuffleQueue = (list: LX.Player.PlayQueueItem[]) => {
  for (let index = list.length - 1; index > 0; index--) {
    const targetIndex = getRandom(0, index + 1)
    const item = list[index]
    list[index] = list[targetIndex]
    list[targetIndex] = item
  }
}

const isQueueMusicPlayable = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  if ('progress' in musicInfo) return musicInfo.isComplate
  const name = musicInfo.name?.replaceAll(SPLIT_CHAR.DISLIKE_NAME, SPLIT_CHAR.DISLIKE_NAME_ALIAS).toLocaleLowerCase().trim() ?? ''
  const singer = musicInfo.singer?.replaceAll(SPLIT_CHAR.DISLIKE_NAME, SPLIT_CHAR.DISLIKE_NAME_ALIAS).toLocaleLowerCase().trim() ?? ''
  return !dislikeInfo.musicNames.has(name) &&
    !dislikeInfo.singerNames.has(singer) &&
    !dislikeInfo.names.has(`${name}${SPLIT_CHAR.DISLIKE_NAME}${singer}`)
}

const getQueueLoopIndex = () => {
  const index = playQueue.findIndex(item => item.origin == 'source')
  return index < 0 ? 0 : index
}

export const applyPlayQueueMode = () => {
  if (playQueueIndex.value < 0 || playQueueIndex.value >= playQueue.length - 1) return
  const indexes: number[] = []
  const sourceItems: LX.Player.PlayQueueItem[] = []
  for (let index = playQueueIndex.value + 1; index < playQueue.length; index++) {
    const item = playQueue[index]
    if (item.origin != 'source') continue
    indexes.push(index)
    sourceItems.push(item)
  }
  if (appSetting['player.togglePlayMethod'] == 'random') {
    shuffleQueue(sourceItems)
  } else {
    sourceItems.sort((a, b) => (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0))
  }
  indexes.forEach((index, itemIndex) => {
    playQueue[index] = sourceItems[itemIndex]
  })
}

export const getNextPlayMusicInfo = async(): Promise<LX.Player.PlayMusicInfo | null> => {
  if (!playQueue.length) return null
  if (playQueueIndex.value < 0) return playQueue[0]
  if (appSetting['player.togglePlayMethod'] == 'singleLoop') return playQueue[playQueueIndex.value]
  if (playQueueIndex.value < playQueue.length - 1) return playQueue[playQueueIndex.value + 1]
  if (appSetting['player.togglePlayMethod'] == 'listLoop' || appSetting['player.togglePlayMethod'] == 'random') {
    return playQueue[getQueueLoopIndex()] ?? null
  }
  return null
}

export const playQueueItem = (index: number) => {
  const item = playQueue[index]
  if (!item) return
  setPlayQueueIndex(index)
  setPlayMusicInfo(item.listId, item.musicInfo, item.isTempPlay)
  handlePlay()
}
/**
 * 下一曲
 * @param isAutoToggle 是否自动切换
 * @returns
 */
export const playNext = async(isAutoToggle = false): Promise<void> => {
  console.log('skip next', isAutoToggle)
  if (!playQueue.length) {
    handleToggleStop()
    return
  }
  if (playQueueIndex.value < 0) {
    playQueueItem(0)
    return
  }
  if (isAutoToggle && appSetting['player.togglePlayMethod'] == 'singleLoop') {
    playQueueItem(playQueueIndex.value)
    return
  }
  let nextIndex = playQueueIndex.value + 1
  if (nextIndex >= playQueue.length) {
    if (isAutoToggle && (appSetting['player.togglePlayMethod'] == 'list' || appSetting['player.togglePlayMethod'] == 'none')) return
    nextIndex = getQueueLoopIndex()
  }
  playQueueItem(nextIndex)
}

/**
 * 上一曲
 */
export const playPrev = async(isAutoToggle = false): Promise<void> => {
  if (!playQueue.length) {
    handleToggleStop()
    return
  }
  if (playQueueIndex.value < 0) {
    playQueueItem(0)
    return
  }
  let prevIndex = playQueueIndex.value - 1
  if (prevIndex < 0) {
    if (isAutoToggle && (appSetting['player.togglePlayMethod'] == 'list' || appSetting['player.togglePlayMethod'] == 'none')) return
    prevIndex = playQueue.length - 1
  }
  playQueueItem(prevIndex)
}

/**
 * 恢复播放
 */
export const play = () => {
  window.lx.isPlayedStop &&= false
  if (playMusicInfo.musicInfo == null) return
  if (isEmpty()) {
    if (createGettingUrlId(playMusicInfo.musicInfo) != gettingUrlId) setMusicUrl(playMusicInfo.musicInfo)
    return
  }
  setPlay()
}

/**
 * 暂停播放
 */
export const pause = () => {
  setPause()
}

/**
 * 停止播放
 */
export const stop = () => {
  setStop()
  setTimeout(() => {
    window.app_event.stop()
  })
}

/**
 * 播放、暂停播放切换
 */
export const togglePlay = () => {
  window.lx.isPlayedStop &&= false
  if (isPlay.value) {
    pause()
  } else {
    play()
  }
}

/**
 * 收藏当前播放的歌曲
 */
export const collectMusic = () => {
  if (!playMusicInfo.musicInfo) return
  void addListMusics(loveList.id, ['progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo])
}

/**
 * 取消收藏当前播放的歌曲
 */
export const uncollectMusic = () => {
  if (!playMusicInfo.musicInfo) return
  void removeListMusics({ listId: loveList.id, ids: ['progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo.id : playMusicInfo.musicInfo.id] })
}

/**
 * 不喜欢当前播放的歌曲
 */
export const dislikeMusic = async() => {
  if (!playMusicInfo.musicInfo) return
  const minfo = 'progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo
  await addDislikeInfo([{ name: minfo.name, singer: minfo.singer }])
  await playNext(true)
}
