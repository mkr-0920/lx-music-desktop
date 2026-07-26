import { onBeforeRouteLeave } from '@common/utils/vueRouter'
import { ref, nextTick } from '@common/utils/vueTools'
import { addHistoryWord } from '@renderer/store/search/action'
import type { SearchListInfo, ListInfoItem } from '@renderer/store/search/album'
import { search as searchAlbum, listInfos } from '@renderer/store/search/album'

export type SearchSource = LX.OnlineSource | 'all'

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<SearchListInfo>({
    page: 1,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
    tagId: '',
    sortId: '',
  })

  const search = (text: string, source: SearchSource, page: number) => {
    listInfo.value = listInfos[source] as SearchListInfo
    if (text.length) void addHistoryWord(text)

    void searchAlbum(text, page, source).then((list: ListInfoItem[]) => {
      if (!window.lx.albumInfo) window.lx.albumInfo = { searchKey: null, searchPosition: 0 }

      if (listInfo.value.key == window.lx.albumInfo.searchKey && window.lx.albumInfo.searchPosition) {
        void nextTick(() => {
          listRef.value?.scrollTo(window.lx.albumInfo.searchPosition)
        })
      } else if (list.length && listRef.value) {
        window.lx.albumInfo.searchKey = null
        void nextTick(() => {
          listRef.value?.scrollTo(0)
        })
      }
    }).catch(() => {
      // The store has already updated the failure label.
    })
  }

  onBeforeRouteLeave(() => {
    if (!window.lx.albumInfo) window.lx.albumInfo = { searchKey: null, searchPosition: 0 }
    window.lx.albumInfo.searchKey = listInfo.value.key
    window.lx.albumInfo.searchPosition = listRef.value?.getScrollTop() ?? 0
  })

  return {
    listRef,
    listInfo,
    search,
  }
}
