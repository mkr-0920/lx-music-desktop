<template>
  <div ref="listRef" :class="$style.container" class="scroll">
    <div v-if="listInfo.noItemLabel" :class="$style.tip">
      {{ listInfo.noItemLabel }}
    </div>
    <div v-else :class="$style.grid">
      <button v-for="item in listInfo.list" :key="item.id" :class="$style.item" @click="handleClick(item)">
        <img :src="item.img" :class="$style.cover" loading="lazy" />
        <span :class="$style.name">{{ item.name }}</span>
        <span v-if="item.alias.length" :class="$style.alias">{{ item.alias.join(' / ') }}</span>
        <span :class="$style.meta">{{ $t('artist__album_count', { count: item.albumCount }) }}</span>
      </button>
    </div>
    <material-pagination
      v-if="listInfo.total > listInfo.limit"
      :count="listInfo.total"
      :limit="listInfo.limit"
      :page="listInfo.page"
      @btn-click="togglePage"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { searchText } from '@renderer/store/search/state'
import useList from './useList'

// 歌手搜索目前仅网易云支持
const SOURCE: LX.OnlineSource = 'wy'

const props = defineProps<{ page: number }>()
const router = useRouter()
const route = useRoute()

const {
  listRef,
  listInfo,
  search,
} = useList(SOURCE)

watch(() => [searchText.value, props.page], ([text, page]) => {
  search(text as string, page as number || 1)
}, { immediate: true })

const togglePage = (page: number) => {
  void router.replace({ path: route.path, query: { ...route.query, page } })
}

const handleClick = (item: any) => {
  void router.push({
    path: '/artist/detail',
    query: { id: item.id, name: item.name, img: item.img },
  })
}
</script>

<style lang="less" module>
.container { position: absolute; inset: 0; overflow-y: auto; padding: 15px; box-sizing: border-box; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 20px; }
.item { border: 0; background: none; color: var(--color-font); cursor: pointer; min-width: 0; display: flex; flex-direction: column; align-items: center; }
.cover { width: 100%; aspect-ratio: 1; border-radius: 50%; object-fit: cover; }
.name, .alias, .meta { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
.name { margin-top: 8px; font-size: 14px; font-weight: 700; }
.alias, .meta { margin-top: 3px; font-size: 12px; color: var(--color-font-label); }
.tip { padding: 40px; text-align: center; color: var(--color-font-label); }
</style>
