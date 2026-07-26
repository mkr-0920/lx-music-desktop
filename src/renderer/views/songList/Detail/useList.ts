import { ref, markRawList } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'
import { getAndSetListDetail } from '@renderer/store/songList/action'
import { listDetailInfo } from '@renderer/store/songList/state'
import { playSongListDetail } from './action'
import music from '@renderer/utils/musicSdk'

// 【关键引入】：引入官方的数据清洗工具，把旧数据洗成 V2 格式！
import { toNewMusicInfo } from '@common/utils/tools'

export default () => {
  const listRef = ref<any>(null)
  const route = useRoute()

  const getListData = async(source: LX.OnlineSource, id: string, page: number, refresh: boolean) => {
    const isAlbum = route.query.type === 'album'

    if (isAlbum) {
      listDetailInfo.noItemLabel = window.i18n.t('list__loading') || 'Loading...'

      // 先清空旧的 UI，防止上一个专辑的数据残留闪烁
      listDetailInfo.info = { name: '', author: '', img: '', desc: '', play_count: '' }
      listDetailInfo.list = []

      try {
        const albumReq = (music as any)[source]?.album?.getAlbumDetail
        if (!albumReq) throw new Error('Album not supported')

        // 发起请求，拿到包含完整 info 的 detail
        const detail = await albumReq(id)

        // 使用接口返回的真实神仙数据来渲染左侧 UI！
        listDetailInfo.info = {
          name: detail.info.name || '',
          author: detail.info.singer || '', // 借用 author 显示歌手名
          img: detail.info.img || '',
          desc: `发行时间：${detail.info.publishTime || '未知'}\n发行公司：${detail.info.company || '未知'}\n\n${detail.info.desc || ''}`,
          play_count: '',
        }

        // 洗数据并挂载歌曲列表
        const formattedList = detail.list.map((item: any) => toNewMusicInfo(item))
        listDetailInfo.list = markRawList(formattedList)
        listDetailInfo.id = id
        listDetailInfo.source = source
        listDetailInfo.total = detail.list.length
        listDetailInfo.limit = detail.list.length || 1000
        listDetailInfo.page = 1
        listDetailInfo.noItemLabel = ''
      } catch (e) {
        console.error('[Album Load Error]', e)
        listDetailInfo.noItemLabel = window.i18n.t('list__load_failed') || 'Failed'
      }

      setTimeout(() => {
        if (listRef.value) listRef.value.scrollToTop()
      })
    } else {
      await getAndSetListDetail(id, source, page, refresh).then(() => {
        setTimeout(() => {
          if (listRef.value) listRef.value.scrollToTop()
        })
      })
    }
  }

  const handlePlayList = (index: number) => {
    const isAlbum = route.query.type === 'album'
    void playSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list, index, isAlbum)
  }

  return {
    listRef,
    listDetailInfo,
    getListData,
    handlePlayList,
  }
}
