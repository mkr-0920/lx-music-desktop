// 网易云音乐百科 (音乐百科简要信息 + 创作简介)
// 数据源接口:
//   summary -> /api/song/play/about/block/page    曲风/标签/语种/BPM/影视/获奖
//   info    -> /api/link/page/parent/relation/construct/info (eapi) 创作简介
import { eapiRequest } from './utils/index'

/**
 * @typedef {object} WikiSummary
 * @property {string[]} tags 曲风 + 推荐标签
 * @property {string} language 语种
 * @property {string} bpm
 * @property {string} entertainment 影视节目
 * @property {string} award 获奖成就
 * @property {string} intro 创作简介
 */

const cache = new Map()

const getNumericId = (songmid) => {
  // songmid 为网易云数字 ID (wy / wy_daily / wy_fm / mkr排行榜源)
  return String(songmid).split('_')[0]
}

const parseSummary = (body) => {
  const result = {
    tags: [],
    language: '',
    bpm: '',
    entertainment: '',
    award: '',
  }
  const blocks = body?.data?.blocks
  if (!Array.isArray(blocks)) return result
  const basic = blocks.find(b => b.code === 'SONG_PLAY_ABOUT_SONG_BASIC')
  if (!basic) return result
  for (const creative of basic.creatives ?? []) {
    const type = creative.creativeType
    if (type == 'songTag' || type == 'songBizTag') {
      for (const res of creative.resources ?? []) {
        const title = res.uiElement?.mainTitle?.title
        if (title && !result.tags.includes(title)) result.tags.push(title)
      }
    } else if (type == 'language') {
      result.language = creative.uiElement?.textLinks?.[0]?.text ?? ''
    } else if (type == 'bpm') {
      result.bpm = creative.uiElement?.textLinks?.[0]?.text ?? ''
    } else if (type == 'entertainment') {
      result.entertainment = creative.resources?.[0]?.uiElement?.mainTitle?.title ?? ''
    } else if (type == 'songAward') {
      result.award = creative.resources?.[0]?.uiElement?.mainTitle?.title ?? ''
    }
  }
  return result
}

const parseIntro = (body) => {
  const blocks = body?.data?.blocks
  if (!Array.isArray(blocks)) return ''
  const wikiBlock = blocks.find(b => b.positionCode === 'songDetailNewSongWiki')
  const infoBlocks = wikiBlock?.rnData?.blocks
  if (!Array.isArray(infoBlocks)) return ''
  const songInfo = infoBlocks.find(b => b.blockCode === 'wikiSubBlockSongInfoVo')
  return songInfo?.blockInfo?.desc ?? ''
}

/**
 * 获取歌曲的音乐百科信息 (带缓存)
 * @param {string} songmid 网易云数字歌曲 ID
 * @returns {Promise<WikiSummary>}
 */
export const getWiki = (songmid) => {
  const id = getNumericId(songmid)
  if (!/^\d+$/.test(id)) return Promise.reject(new Error('non netease id'))
  const cached = cache.get(id)
  if (cached) return cached

  const promise = (async() => {
    const summaryRequest = eapiRequest('/api/song/play/about/block/page', { songId: id })
    const { body: summaryBody } = await summaryRequest.promise
    if (summaryBody?.code !== 200) throw new Error(`wiki summary failed: ${summaryBody?.code}`)
    const summary = parseSummary(summaryBody)

    let intro = ''
    try {
      const extJson = JSON.stringify({
        states: { playingResource: { current: id, scene: 'songWiki' } },
      })
      const infoRequest = eapiRequest('/api/link/page/parent/relation/construct/info', {
        extJson,
        positionCode: 'songWikiMainPosition',
      })
      const { body: infoBody } = await infoRequest.promise
      if (infoBody?.code === 200) intro = parseIntro(infoBody)
    } catch {
      // 简介加载失败不影响元信息展示
    }

    return { ...summary, intro }
  })()

  cache.set(id, promise)
  return promise
}
