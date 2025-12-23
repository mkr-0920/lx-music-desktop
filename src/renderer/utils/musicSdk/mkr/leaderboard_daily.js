// [文件: src/renderer/utils/musicSdk/mkr/leaderboard_daily.js]

// 导入所有依赖
import { eapiRequest } from '../wy/utils/index'
import { handleResult } from '../wy/utils/parser'
// 导入 appSetting 以读取 Cookie
import { appSetting } from '@renderer/store/setting'
import { toast } from '@renderer/plugins/Tips'

// 定义接口常量
const API_URLS = {
  STYLE_TAGS: '/api/homepage/daily/song/config/get',
  STYLE_TAGS_SAVE: '/api/homepage/daily/song/tag/save',
  STYLE_PLAYLIST: '/api/homepage/category/daily/song/list',
  DAILY_RECOMMEND_BATCH: '/api/batch', // 使用 batch 接口获取日推
}

// 构造请求选项 (支持强制指定 OS，解决 FM 模式获取不到的问题)
const getRequestOptions = (forceOs = null) => {
  let wyCookie = appSetting['common.wyCookie']
  if (!wyCookie) {
    toast('请先在设置中填写网易云 Cookie')
    return 'mobile'
  }

  if (forceOs) {
    // 1. 如果 Cookie 里已有 os=xxx，替换它
    if (/os=[^;]+/.test(wyCookie)) {
      wyCookie = wyCookie.replace(/os=[^;]+/, `os=${forceOs}`)
    } else {
      // 2. 如果没有，追加它
      wyCookie += `; os=${forceOs}`
    }
    // 确保还有 appver，有些接口需要配合 appver
    if (!/appver=[^;]+/.test(wyCookie)) {
      wyCookie += '; appver=9.9.9'
    } else {
      // 2. 如果没有，追加它
      wyCookie += '; appver=9.9.9'
    }
  }

  return {
    mobile: true,
    headers: {
      Cookie: wyCookie,
    },
  }
}

export default {
  /**
   * getBoards (获取风格标签)
   * 对应 Python: handle_get_style_tags
   */
  getBoards: async() => {
    // 1. 请求风格标签配置
    const request = eapiRequest(
      API_URLS.STYLE_TAGS,
      {
        header: '{}',
        e_r: true,
      },
      getRequestOptions(),
    )

    const { body } = await request.promise
    const list = []

    // 2. 解析返回的数据 (对应 Python 中的 data["data"])
    const data = body.data || {}
    const categorys = data.categorys || []

    categorys.forEach(category => {
      const currentCategoryId = category.categoryId

      // 跳过无效分类
      if (!currentCategoryId) return

      category.tagVOList.forEach(tag => {
        // 构造 ID，格式：wy_daily__tagId_categoryId
        list.push({
          id: `wy_daily__${tag.tagId}_${currentCategoryId}`,
          name: tag.tagName,
          bangid: `${tag.tagId}_${currentCategoryId}`,
        })
      })
    })

    // 3. 在顶部插入“每日推荐”
    list.unshift({
      id: 'wy_daily__daily_recommend',
      name: '每日推荐',
      bangid: 'daily_recommend',
    })

    return {
      list,
      source: 'wy_daily',
    }
  },

  /**
   * getList (获取推荐歌曲)
   * 对应 Python: handle_netease_daily_recommend & handle_netease_style_recommend
   */
  getList: async(bangid, page) => {
    const options = getRequestOptions()

    // --- 每日推荐 ---
    if (bangid === 'daily_recommend') {
      // 对应 Python: handle_netease_daily_recommend (使用 batch 接口)
      const request = eapiRequest(
        API_URLS.DAILY_RECOMMEND_BATCH,
        {
          '/api/v3/discovery/recommend/songs': '{"ispush":"false"}',
          '/api/discovery/recommend/songs/history/recent': '',
          header: '{}',
          e_r: true,
        },
        options,
      )

      const { body } = await request.promise
      // 提取 batch 响应中的数据
      const recommendData = body['/api/v3/discovery/recommend/songs']
      const rawList = recommendData?.data?.dailySongs || []

      const list = handleResult(rawList)
      return {
        list,
        allPage: 1,
        limit: list.length,
        total: list.length,
        source: 'wy',
      }
    }

    // --- 风格日推 ---
    // bangid 格式: "tagId_categoryId"
    const parts = bangid.split('_')
    if (parts.length !== 2) return { list: [], total: 0, source: 'wy' }

    const [tagId, categoryId] = parts

    // 保存偏好 (Save Tags)
    const saveRequest = eapiRequest(
      API_URLS.STYLE_TAGS_SAVE,
      {
        tags: JSON.stringify({
          tagIds: [parseInt(tagId)],
          categoryId: parseInt(categoryId),
        }),
        header: '{}',
        e_r: true,
      },
      options,
    )
    await saveRequest.promise // 等待保存完成

    // 获取歌单 (Get List)
    const listRequest = eapiRequest(
      API_URLS.STYLE_PLAYLIST,
      {
        header: '{}',
        e_r: true,
      },
      options,
    )

    const { body } = await listRequest.promise
    const rawList = body.data?.dailySongs || []

    const list = handleResult(rawList)
    return {
      list,
      allPage: 1,
      limit: list.length,
      total: list.length,
      source: 'wy',
    }
  },
}
