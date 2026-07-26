// [文件: src/renderer/store/list/syncListToCloud.ts]

import { eapiRequest } from '@renderer/utils/musicSdk/wy/utils/index'
import { appSetting } from '@renderer/store/setting'
import { getListMusics } from '@renderer/store/list/listManage'
import { toast } from '@renderer/plugins/Tips'

/**
 * 辅助函数：解析歌单 ID
 * 兼容纯数字 ID 和 网易云 URL
 */
const parsePlaylistId = (input: string): string => {
  if (!input) return ''
  // 尝试从 URL 中匹配 id=123456
  const match = input.match(/[?&]id=(\d+)/)
  if (match) {
    return match[1]
  }
  // 如果不是 URL，假设它本身就是 ID (纯数字)
  return input
}

/**
 * 构造带有 Cookie 的请求选项
 */
const getRequestOptions = () => {
  const wyCookie = appSetting['common.wyCookie']
  if (!wyCookie) return 'mobile'
  return {
    mobile: true,
    headers: {
      Cookie: wyCookie,
    },
  }
}

/**
 * 获取网易云歌单详情 (仅获取 ID 列表)
 */
const getRemotePlaylistTracks = async(playlistId: string): Promise<Set<string>> => {
  const request = eapiRequest(
    '/api/v6/playlist/detail',
    {
      id: playlistId,
      n: '100000',
      s: '0',
      header: '{}',
      e_r: true,
    },
    getRequestOptions(),
  ) as any

  const { body } = await request.promise
  if (body.code !== 200) {
    // 这里的 message 往往就是 "请求参数错误"
    throw new Error(body.message || `获取远程歌单失败 (Code: ${body.code})`)
  }

  const trackIds = body.playlist?.trackIds || []
  return new Set(trackIds.map((t: any) => String(t.id)))
}

/**
 * 操作歌单 (添加/删除/更新顺序)
 */
const manipulateTracks = async(op: 'add' | 'del' | 'update', playlistId: string, songIds: string[]) => {
  let trackIdsStr = ''
  if (op === 'update') {
    // Update: [123,456]
    trackIdsStr = `[${songIds.join(',')}]`
  } else {
    // Add/Del: ["123", "456"]
    trackIdsStr = JSON.stringify(songIds)
  }

  const request = eapiRequest(
    '/api/playlist/manipulate/tracks',
    {
      pid: playlistId,
      trackIds: trackIdsStr,
      op,
      header: '{}',
      e_r: true,
    },
    getRequestOptions(),
  ) as any

  const { body } = await request.promise
  // 200: 成功, 502: 部分情况也是成功(需忽略), 其他: 失败
  if (body.code !== 200 && body.code !== 502) {
    throw new Error(body.message || `操作 ${op} 失败`)
  }
  return body
}

/**
 * 同步本地列表到网易云 (主入口)
 */
export default async(listInfo: LX.List.UserListInfo) => {
  if (!listInfo.sourceListId || listInfo.source !== 'wy') {
    toast('此列表未绑定网易云歌单ID，无法同步', 'error')
    return false
  }

  const wyCookie = appSetting['common.wyCookie']
  if (!wyCookie) {
    toast('请先在设置-基本设置中填写网易云 Cookie', 'error')
    return false
  }

  // 在此处解析纯数字 ID
  const playlistId = parsePlaylistId(listInfo.sourceListId)
  if (!playlistId) {
    toast('无效的歌单 ID', 'error')
    return false
  }

  toast(`开始同步: ${listInfo.name}`, 'normal')
  console.log(`[Sync] 开始同步列表 "${listInfo.name}" (ID: ${playlistId}) ...`)

  try {
    // 获取本地歌曲 ID 列表
    const localMusics = await getListMusics(listInfo.id)
    const targetSongIds: string[] = []
    const unsupportedMusics = localMusics.filter(musicInfo => musicInfo.source !== 'wy')
    if (unsupportedMusics.length) {
      toast(`有 ${unsupportedMusics.length} 首歌曲不是网易云来源，请先换源后再同步`, 'error')
      return false
    }

    localMusics.forEach(m => {
      if (m.source === 'wy' && m.id) {
        // ID 清洗：移除可能的 "wy_" 前缀
        const rawId = String(m.id).replace(/^wy_/, '')
        if (/^\d+$/.test(rawId)) {
          targetSongIds.push(rawId)
        }
      }
    })
    if (targetSongIds.length != localMusics.length) {
      toast('部分歌曲缺少有效的网易云歌曲 ID，请先换源后再同步', 'error')
      return false
    }

    // 获取远程歌单当前状态
    const currentSongIdSet = await getRemotePlaylistTracks(playlistId)
    const targetSongIdSet = new Set(targetSongIds)

    // 计算差异
    const toAdd = targetSongIds.filter(id => !currentSongIdSet.has(id))
    const toDel = Array.from(currentSongIdSet).filter(id => !targetSongIdSet.has(id))

    console.log(`[Sync] 差异计算: 新增 ${toAdd.length} 首, 删除 ${toDel.length} 首`)

    // 执行操作
    // 删除
    if (toDel.length > 0) {
      console.log(`[Sync] 正在删除 ${toDel.length} 首歌曲...`)
      await manipulateTracks('del', playlistId, toDel)
    }

    // 添加
    if (toAdd.length > 0) {
      console.log(`[Sync] 正在添加 ${toAdd.length} 首歌曲...`)
      await manipulateTracks('add', playlistId, toAdd)
    }

    // 排序 (Update) - 确保顺序一致
    if (targetSongIds.length > 0) {
      console.log('[Sync] 正在更新歌单顺序...')
      await manipulateTracks('update', playlistId, targetSongIds)
    }

    console.log('[Sync] 同步完成')
    toast('同步至网易云成功！', 'success')
    return true
  } catch (err: any) {
    console.error('[Sync] 同步失败:', err)
    toast(`同步失败: ${err.message || '未知错误'}`, 'error')
    return false
  }
}
