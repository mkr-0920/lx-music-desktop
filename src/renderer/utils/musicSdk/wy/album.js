// src/renderer/utils/musicSdk/wy/album.js

import { oldEapiRequest, eapiRequest } from './utils/index'
import musicDetailApi from './musicDetail'
import { generateCacheKey } from './utils/crypto'

export default {
  successCode: 200,

  /**
   * 1. 搜索专辑列表
   * @param {String} text 搜索关键词
   * @param {Number} page 当前页码
   * @param {Number} limit 每页数量
   */
  search(text, page, limit = 20) {
    // 复用已有的 cloudsearch 接口，将 type 设为 10 即可完美获取你在 curl 中看到的专辑列表
    return oldEapiRequest('/api/cloudsearch/pc', {
      s: text,
      type: 10, // 10: 专辑
      limit,
      total: true,
      offset: limit * (page - 1),
    }, 'mobile').promise.then(({ body }) => {
      if (body.code !== this.successCode) throw new Error('search failed')

      // 取出你在 curl 响应体中看到的 albums 数组和 albumCount 总数
      return {
        list: this.filterList(body.result.albums || []),
        limit,
        total: body.result.albumCount || 0,
        source: 'wy',
      }
    })
  },

  /**
   * 格式化专辑搜索结果列表
   * 严格按照你在 curl 响应里看到的 JSON 字段进行提取
   */
  filterList(rawData) {
    return rawData.map(item => ({
      id: String(item.id),
      name: item.name || '',
      singer: item.artist ? item.artist.name : '',
      publishTime: item.publishTime ? this.dateFormat(item.publishTime) : '',
      img: item.picUrl ? `${item.picUrl}?param=300y300` : '',
      desc: item.description || '',
      size: item.size || 0,
      company: item.company || '',
      source: 'wy',
    }))
  },

  /**
   * 时间戳格式化工具
   */
  dateFormat(time) {
    const date = new Date(time)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  },

  /**
   * 2. 获取专辑详情及完整歌曲列表
   */
  async getAlbumDetail(id) {
    const paramsForCacheKey = { id: String(id), e_r: 'false' }
    const cacheKey = generateCacheKey(paramsForCacheKey)
    const detailRequest = eapiRequest('/api/album/v3/detail', {
      id: String(id),
      e_r: 'false',
      cache_key: cacheKey,
      header: '{}',
    }, 'mobile')

    const { body } = await detailRequest.promise

    if (body.code !== 200) throw new Error('获取网易云专辑详情失败')

    // 3. 提取接口里的歌曲 ID
    const songIds = (body.songs || []).map(song => song.id)

    // 4. 去拿真实的播放链接和高音质数据
    let list = []
    if (songIds.length > 0) {
      const detailResult = await musicDetailApi.getList(songIds)
      list = detailResult.list
    }

    // 5. 格式化发行时间
    let publishTime = ''
    if (body.album && body.album.publishTime) {
      const date = new Date(body.album.publishTime)
      publishTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    // 6. 满血返回所有信息！
    return {
      list,
      source: 'wy',
      info: {
        name: body.album?.name || '',
        singer: body.album?.artist?.name || '',
        img: body.album?.picUrl || '',
        desc: body.album?.description || '暂无专辑简介',
        publishTime,
        company: body.album?.company || '',
        play_count: '', // 留空防报错
      },
    }
  },
}
