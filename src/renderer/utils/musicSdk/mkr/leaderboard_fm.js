// [文件: src/renderer/utils/musicSdk/mkr/leaderboard_fm.js]

import { eapiRequest } from '../wy/utils/index'
// 导入通用解析器
import { handleResult } from '../wy/utils/parser'
// 导入配置以读取 Cookie
import { appSetting } from '@renderer/store/setting'
import { toast } from '@renderer/plugins/Tips'

// 构造请求选项 (支持强制指定 OS，解决 FM 模式获取不到的问题)
const getRequestOptions = (forceOs = null) => {
  let wyCookie = appSetting['common.wyCookie']
  if (!wyCookie) {
    toast('请先在设置中填写网易云 Cookie')
    return 'mobile'
  }

  if (forceOs) {
    // 如果 Cookie 里已有 os=xxx，替换它
    if (/os=[^;]+/.test(wyCookie)) {
      wyCookie = wyCookie.replace(/os=[^;]+/, `os=${forceOs}`)
    } else {
      // 如果没有，追加它
      wyCookie += `; os=${forceOs}`
    }
    // 确保还有 appver，有些接口需要配合 appver
    if (!/appver=[^;]+/.test(wyCookie)) {
      wyCookie += '; appver=9.9.9'
    } else {
      // 如果没有，追加它
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
   * 获取 FM 模式列表 (左侧菜单)
   * API: /api/link/position/show/resource
   */
  getBoards: async() => {
    // 构造 extJson
    const extJson = JSON.stringify({
      clientLibraAbTest: { 'fm-style-reopen': 't3', fmNameTest0422: 'c' },
      isHomePageNewFramework: true,
      userSetFMMode: true,
      enableAutoPlay: true,
    })

    const request = eapiRequest(
      '/api/link/position/show/resource',
      {
        positionCode: 'FMTopModeDialog',
        extJson,
        header: '{}',
        e_r: true,
      },
      // 这里必须传入 'android' 来伪装设备
      getRequestOptions('android'),
    )

    // 发送请求
    const { body } = await request.promise

    // 解析数据
    const dslData = body?.data?.crossPlatformResource?.dslData || {}

    const list = []

    // 基础模式
    if (dslData.recommendModeList) {
      dslData.recommendModeList.forEach(mode => {
        list.push({
          id: `wy_fm__${mode.code}`,
          name: mode.title,
          bangid: mode.code,
        })
      })
    }

    // 场景模式
    if (dslData.currentSceneList) {
      dslData.currentSceneList.forEach(scene => {
        list.push({
          id: `wy_fm__scene_${scene.code}`,
          name: scene.title,
          bangid: `SCENE_RCMD@${scene.code}`,
        })
      })
    }

    return {
      list,
      source: 'wy_fm',
    }
  },

  /**
   * 获取歌曲列表
   * API: /api/v1/radio/get
   */
  getList: async(bangid, page) => {
    // 获取歌曲建议也伪装成 Android，更加稳妥
    const options = getRequestOptions('android')

    // 检查 Cookie
    if (!options.headers?.Cookie) {
      throw new Error('请先在设置中填写网易云 Cookie')
    }

    // 解析参数
    let mode = bangid
    let subMode = null

    if (bangid.includes('@')) {
      const parts = bangid.split('@')
      mode = parts[0]
      subMode = parts[1]
    } else if (bangid.startsWith('wy_fm__')) {
      mode = bangid.replace('wy_fm__', '')
    }

    // 准备循环
    const targetTotal = 30
    let collectedList = []
    const maxRetry = 10

    const requestData = {
      mode,
      entranceType: 'main_bottom_tab',
      limit: '3',
      openAidj: 'false',
      header: '{}',
      e_r: true,
    }
    if (subMode) {
      requestData.subMode = subMode
    }

    // 开始串行循环
    for (let i = 0; i < maxRetry; i++) {
      if (collectedList.length >= targetTotal) break

      try {
        const response = await eapiRequest(
          '/api/v1/radio/get',
          requestData,
          options,
        ).promise

        const rawData = response.body?.data

        if (!rawData || rawData.length === 0) {
          console.log('[WY FM] 接口没数据了，停止获取')
          break
        }

        const currentBatch = handleResult(rawData)

        currentBatch.forEach(song => {
          const exists = collectedList.some(s => s.songmid === song.songmid)
          if (!exists) {
            collectedList.push(song)
          }
        })

        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (err) {
        console.error('[WY FM] 获取部分歌曲失败:', err)
        if (collectedList.length > 0) break
      }
    }

    return {
      list: collectedList,
      allPage: 1,
      limit: collectedList.length,
      total: collectedList.length,
      source: 'wy',
    }
  },
}
