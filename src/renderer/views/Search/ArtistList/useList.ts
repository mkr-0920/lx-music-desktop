import { onBeforeRouteLeave } from '@common/utils/vueRouter'
import { ref, nextTick } from '@common/utils/vueTools'
import { addHistoryWord } from '@renderer/store/search/action'
import type { SearchListInfo, ListInfoItem } from '@renderer/store/search/artist'
import { search as searchArtist, listInfos } from '@renderer/store/search/artist'

export default (source: LX.OnlineSource) => {
  // 歌手列表的滚动容器是普通 DOM 元素，不是组件
  const listRef = ref<HTMLElement | null>(null)

  const listInfo = ref<SearchListInfo>(listInfos[source] ?? {
    page: 1,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, page: number) => {
    const info = listInfos[source]
    if (info) listInfo.value = info
    if (text.length) void addHistoryWord(text)

    void searchArtist(text, page, source).then((list: ListInfoItem[]) => {
      if (listInfo.value.key == window.lx.artistInfo.searchKey && window.lx.artistInfo.searchPosition) {
        // 回到上次离开时的位置
        void nextTick(() => {
          listRef.value?.scrollTo({ top: window.lx.artistInfo.searchPosition })
        })
      } else if (list.length && listRef.value) {
        window.lx.artistInfo.searchKey = null
        void nextTick(() => {
          listRef.value?.scrollTo({ top: 0 })
        })
      }
    }).catch(() => {
      // 失败提示已由 store 写入 noItemLabel
    })
  }

  onBeforeRouteLeave(() => {
    window.lx.artistInfo.searchKey = listInfo.value.key
    window.lx.artistInfo.searchPosition = listRef.value?.scrollTop ?? 0
  })

  return {
    listRef,
    listInfo,
    search,
  }
}
