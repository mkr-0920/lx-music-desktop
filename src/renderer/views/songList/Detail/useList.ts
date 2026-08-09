import { nextTick, ref } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'
import { getAndSetAlbumDetail, getAndSetListDetail } from '@renderer/store/songList/action'
import { listDetailInfo } from '@renderer/store/songList/state'
import { playSongListDetail } from './action'

export default () => {
  const listRef = ref<any>(null)
  const route = useRoute()

  const getListData = async(source: LX.OnlineSource, id: string, page: number, refresh: boolean) => {
    const isAlbum = route.query.type === 'album'

    if (isAlbum) {
      const isCached = await getAndSetAlbumDetail(id, source, refresh)
      await nextTick()
      if (isCached) listRef.value?.scrollTo(listDetailInfo.scrollPosition)
      else listRef.value?.scrollToTop()
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
