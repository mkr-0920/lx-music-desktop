// 导入所有内置音源的模块
import kw from './kw/index'
import kg from './kg/index'
import tx from './tx/index'
import wy from './wy/index'
import mg from './mg/index'
import bd from './bd/index'
// 导入xm, mkr音源模块 (xm为兼容旧版)
import xm from './xm'
import mkr from './mkr/index'
// 导入API源（自定义API）的支持列表
import { supportQuality } from './api-source'
// 导入 userApi 状态
import { userApi } from '@renderer/store'

// 定义所有音源的列表和对象
const sources = {
  // sources 数组定义了音源在 UI 上的显示顺序和 ID
  sources: [
    {
      name: '酷我音乐',
      id: 'kw',
    },
    {
      name: '酷狗音乐',
      id: 'kg',
    },
    {
      name: 'QQ音乐',
      id: 'tx',
    },
    {
      name: '网易音乐',
      id: 'wy',
    },
    {
      name: '咪咕音乐',
      id: 'mg',
    },
    {
      name: '虾米音乐',
      id: 'xm',
    },
    {
      name: '我的音乐',
      id: 'mkr',
    },
    // {
    //   name: '百度音乐',
    //   id: 'bd',
    // },
  ],
  // 将导入的模块赋值给对应的 ID，方便按 ID 调用
  kw,
  kg,
  tx,
  wy,
  mg,
  bd,
  xm,
  mkr,
}
export default {
  // 导出所有音源模块
  ...sources,
  // 导出一个 init 函数，用于并行初始化所有音源
  init() {
    const tasks = []
    for (let source of sources.sources) {
      let sm = sources[source.id]
      // 检查音源模块是否有 init 方法，如果有则执行
      sm && sm.init && tasks.push(sm.init())
    }
    return Promise.all(tasks)
  },
  // 导出自定义 API 支持的音质列表
  supportQuality,

  // "换源"功能的核心：聚合搜索
  // 它会搜索除当前失败源 (s) 和黑名单源 (excludeSource) 之外的所有源
  async searchMusic({ name, singer, source: s, limit = 25 }) {
    // 整理歌名
    const trimStr = str => typeof str == 'string' ? str.trim() : str
    const musicName = trimStr(name)
    const tasks = []
    // 定义不参与“换源”搜索的黑名单
    const excludeSource = ['xm']
    // 拿到当前所有已注册了 API 脚本的音源
    // 它的结构是: { wy: { getMusicUrl: ... }, tx: { ... }, mkr: { ... } }
    const availableApiSources = userApi.apis
    // 遍历所有在 UI 上注册的音源
    for (const source of sources.sources) {
      // 检查是否需要跳过
      if (!sources[source.id].musicSearch || // 1. 跳过：如果音源没有内置搜索功能
          source.id == s || // 2. 跳过：如果是刚刚播放失败的那个源 (s)
          excludeSource.includes(source.id) || // 3. 跳过：如果在排除列表里 (如 xm)
          !availableApiSources[source.id]?.getMusicUrl // // 4. 该源是否在“已注册的 API 脚本”中，并且提供了 getMusicUrl 动作
      ) continue // !! 注意：这里没有检查 API 脚本是否支持该源的 musicUrl
      // 将搜索任务（一个Promise）添加到任务数组
      tasks.push(sources[source.id].musicSearch.search(`${musicName} ${singer || ''}`.trim(), 1, limit).catch(_ => null))
    }
    // 并行执行所有搜索任务，并过滤掉失败的结果
    return (await Promise.all(tasks)).filter(s => s)
  },

  // "换源"功能的“查找与排序”
  // 在所有搜索结果中，找出与原歌曲最匹配的一项
  async findMusic({ name, singer, albumName, interval, source: s }) {
    // 1. 调用上面的 searchMusic，并行搜索所有可用音源
    const lists = await this.searchMusic({ name, singer, source: s, limit: 25 })
    // console.log(lists)
    // console.log({ name, singer, albumName, interval, source: s })
    // --- 定义一系列用于“模糊匹配”的辅助函数 ---
    // 用于分割多歌手的分隔符
    const singersRxp = /、|&|;|；|\/|,|，|\|/
    // 格式化歌手名：分割、排序、合并，确保 "A、B" 和 "B、A" 能匹配
    const sortSingle = singer => singersRxp.test(singer)
      ? singer.split(singersRxp).sort((a, b) => a.localeCompare(b)).join('、')
      : (singer || '')
    // 排序辅助函数：从数组中找出符合条件的项，并将其从原数组中移除
    const sortMusic = (arr, callback) => {
      const tempResult = []
      for (let i = arr.length - 1; i > -1; i--) {
        const item = arr[i]
        if (callback(item)) {
          delete item.fSinger
          delete item.fMusicName
          delete item.fAlbumName
          delete item.fInterval
          tempResult.push(item)
          arr.splice(i, 1)
        }
      }
      tempResult.reverse()
      return tempResult
    }
    // 将 "mm:ss" 格式的时长转换为秒数
    const getIntv = (interval) => {
      if (!interval) return 0
      let intvArr = interval.split(':')
      let intv = 0
      let unit = 1
      while (intvArr.length) {
        intv += parseInt(intvArr.pop()) * unit
        unit *= 60
      }
      return intv
    }
    // 格式化字符串：移除所有特殊字符和空格，并转为小写
    const trimStr = str => typeof str == 'string' ? str.trim() : (str || '')
    const filterStr = str => typeof str == 'string' ? str.replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '') : String(str || '')
    // --- 准备原歌曲（播放失败的那首歌）的“干净”数据 ---
    const fMusicName = filterStr(name).toLowerCase()
    const fSinger = filterStr(sortSingle(singer)).toLowerCase()
    const fAlbumName = filterStr(albumName).toLowerCase()
    const fInterval = getIntv(interval)

    // --- 定义匹配规则 ---
    // 规则1: 时长匹配 (允许±2秒的误差)
    const isEqualsInterval = (intv) => Math.abs((fInterval || intv) - (intv || fInterval)) < 3
    // 规则2: 歌名包含 (A包含B 或 B包含A)
    const isIncludesName = (name) => (fMusicName.includes(name) || name.includes(fMusicName))
    // 规则3: 歌手包含
    const isIncludesSinger = (singer) => fSinger ? (fSinger.includes(singer) || singer.includes(fSinger)) : true
    // 规则4: 专辑名相等
    const isEqualsAlbum = (album) => fAlbumName ? fAlbumName == album : true

    // 2. 第一轮过滤与筛选：遍历所有音源的所有搜索结果
    const result = lists.map(source => {
      // 准备“干净”数据
      for (const item of source.list) {
        item.name = trimStr(item.name)
        item.singer = trimStr(item.singer)
        item.fSinger = filterStr(sortSingle(item.singer).toLowerCase())
        item.fMusicName = filterStr(String(item.name ?? '').toLowerCase())
        item.fAlbumName = filterStr(String(item.albumName ?? '').toLowerCase())
        item.fInterval = getIntv(item.interval)

        // 【过滤】如果时长不匹配，直接丢弃
        if (!isEqualsInterval(item.fInterval)) {
          item.name = null
          continue
        }
        // 【P0 匹配 - 优先级最高】歌名完全一致 且 歌手名包含
        if (item.fMusicName == fMusicName && isIncludesSinger(item.fSinger)) return item
      }
      // 【P1 匹配 - 优先级中】歌手名完全一致 且 歌名包含
      for (const item of source.list) {
        if (item.name == null) continue // 跳过被过滤的
        if (item.fSinger == fSinger && isIncludesName(item.fMusicName)) return item
      }
      // 【P2 匹配 - 优先级低】专辑、歌手、歌名都包含
      for (const item of source.list) {
        if (item.name == null) continue // 跳过被过滤的
        if (isEqualsAlbum(item.fAlbumName) && isIncludesSinger(item.fSinger) && isIncludesName(item.fMusicName)) return item
      }
      // 如果 P0, P1, P2 都不满足，则该音源没有匹配项
      return null
    }).filter(s => s) // 过滤掉所有 null 的结果

    // 3. 第二轮排序：对所有通过筛选的歌曲进行优先级排序
    const newResult = []
    if (result.length) {
      // 优先级1: 歌手、歌名、时长 完全精确匹配
      newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.fMusicName == fMusicName && item.interval == interval))
      // 优先级2: 歌名、歌手、专辑 完全精确匹配
      newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName && item.fSinger == fSinger && item.fAlbumName == fAlbumName))
      // 优先级3: 歌手、歌名 完全精确匹配
      newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.fMusicName == fMusicName))
      // ... (其他各种优先级的组合) ...
      newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName && item.interval == interval))
      newResult.push(...sortMusic(result, item => item.fSinger == fSinger && item.interval == interval))
      newResult.push(...sortMusic(result, item => item.interval == interval))
      newResult.push(...sortMusic(result, item => item.fMusicName == fMusicName))
      newResult.push(...sortMusic(result, item => item.fSinger == fSinger))
      newResult.push(...sortMusic(result, item => item.fAlbumName == fAlbumName))
      // 清理临时数据
      for (const item of result) {
        delete item.fSinger
        delete item.fMusicName
        delete item.fAlbumName
        delete item.fInterval
      }
      // 添加所有剩下的匹配项
      newResult.push(...result)
    }
    // console.log(newResult)
    // 4. 返回最终排好序的列表，播放器将尝试播放第 0 项
    return newResult
  },
}
