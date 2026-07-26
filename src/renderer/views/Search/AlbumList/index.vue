<template>
  <div :class="$style.container">
    <AlbumGrid
      ref="listRef"
      :list-info="listInfo"
      @click-item="handleAlbumClick"
      @toggle-page="togglePage"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from '@common/utils/vueTools'
import { searchText } from '@renderer/store/search/state'
// 【恢复】：因为翻页需要修改路由参数，所以必须引回来
import { useRouter, useRoute } from '@common/utils/vueRouter'
import useList, { type SearchSource } from './useList'
import AlbumGrid from '@renderer/components/material/AlbumList.vue'

interface Props {
  sourceId: SearchSource
  page: number
}

const props = defineProps<Props>()
const router = useRouter()
const route = useRoute()

const {
  listRef,
  listInfo,
  search,
} = useList()

watch(() => [props.sourceId, props.page], ([sourceId, page]) => {
  setTimeout(() => {
    search(searchText.value, sourceId as SearchSource, page as number || 1)
  })
})
watch(searchText, (searchText) => {
  setTimeout(() => {
    search(searchText, props.sourceId, props.page)
  })
}, {
  immediate: true,
})

const handleAlbumClick = (item: any) => {
  void router.push({
    path: '/songList/detail',
    query: {
      id: item.id,
      source: item.source,
      type: 'album',
    },
  })
}

// 核心的翻页逻辑，点击下一页时修改 URL，从而触发上面的 watch 重新搜索
const togglePage = (page: number) => {
  void router.replace({
    path: route.path,
    query: {
      ...route.query,
      page,
    },
  })
}
</script>

<style lang="less" module>
.container {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  padding-top: 5px;
}
</style>
