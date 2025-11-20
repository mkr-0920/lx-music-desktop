import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/leaderboard/action'
import { listDetailInfo } from '@renderer/store/leaderboard/state'
import { playSongListDetail } from '../action'

export default () => {
  const listRef = ref<any>(null)

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.list, index)
  }

  const getList = (id: string, page: number) => {
    void getAndSetListDetail(id, page).then(() => {
      setTimeout(() => {
        if (listRef.value) listRef.value.scrollToTop()
      })
    })
  }
  const handleRefresh = () => {
    if (!listDetailInfo.id) {
      console.error('[Debug] listDetailInfo.id 为空，无法刷新')
      return
    }
    // 第三个参数 true 表示 isRefresh (强制刷新/跳过缓存)
    void getAndSetListDetail(listDetailInfo.id, listDetailInfo.page, true).then(() => {
      setTimeout(() => {
        if (listRef.value) listRef.value.scrollToTop()
      })
    })
  }
  return {
    listRef,
    listDetailInfo,
    getList,
    handlePlayList,
    handleRefresh,
  }
}
