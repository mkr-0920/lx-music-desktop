<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <img :src="artist.img" :class="$style.avatar" />
      <div :class="$style.info">
        <h2>{{ artist.name }}</h2>
        <p>{{ loading ? $t('artist__loading_albums', { count: albums.length }) : $t('artist__album_count', { count: albums.length }) }}</p>
      </div>
      <base-tab v-model="sort" :list="sortOptions" :disabled="loading" @change="handleSortChange" />
      <base-btn @click="router.back()">{{ $t('back') }}</base-btn>
    </div>
    <div :class="$style.content">
      <div v-if="error" :class="$style.tip">{{ $t('list__load_failed') }}</div>
      <AlbumGrid v-else ref="listRef" :list-info="listInfo" @click-item="handleAlbumClick" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import music from '@renderer/utils/musicSdk'
import AlbumGrid from '@renderer/components/material/AlbumList.vue'

const route = useRoute()
const router = useRouter()

interface AlbumGridRef {
  scrollTo: (top: number) => void
  getScrollTop: () => number
}

const albums = ref<any[]>([])
const listRef = ref<AlbumGridRef | null>(null)
const loading = ref(false)
const error = ref(false)
const sort = ref('newest')
const artist = reactive({ name: '', img: '' })
const sortOptions = computed(() => [
  { id: 'newest', label: window.i18n.t('artist__sort_newest') },
  { id: 'oldest', label: window.i18n.t('artist__sort_oldest') },
])
const sortedAlbums = computed(() => [...albums.value].sort((a, b) => sort.value == 'oldest'
  ? a.publishTimestamp - b.publishTimestamp
  : b.publishTimestamp - a.publishTimestamp))
const listInfo = computed(() => ({
  list: sortedAlbums.value,
  total: sortedAlbums.value.length,
  page: 1,
  limit: Math.max(sortedAlbums.value.length, 1),
  noItemLabel: loading.value ? window.i18n.t('list__loading') : sortedAlbums.value.length ? '' : window.i18n.t('no_item'),
}))

const loadAlbums = async(id: string) => {
  // 命中缓存：直接复用上次加载的专辑、排序与滚动位置，不再联网，避免返回时闪屏
  const cache = window.lx.artistDetailInfo
  if (cache.id == id && cache.albums.length) {
    albums.value = cache.albums
    sort.value = cache.sort
    loading.value = false
    error.value = false
    await nextTick()
    listRef.value?.scrollTo(cache.scrollPosition)
    return
  }

  albums.value = []
  loading.value = true
  error.value = false
  try {
    let page = 1
    let more = true
    while (more) {
      const result = await (music as any).wy.artist.getAlbums(id, page)
      if (page == 1 && result.artist) {
        artist.name = result.artist.name || artist.name
        artist.img = result.artist.picUrl || artist.img
      }
      albums.value.push(...result.list)
      more = result.more
      page++
    }
    saveCache(id, 0)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

// 将当前专辑列表 / 排序 / 滚动位置写入模块级缓存
const saveCache = (id: string, scrollPosition: number) => {
  const cache = window.lx.artistDetailInfo
  cache.id = id
  cache.albums = albums.value
  cache.sort = sort.value
  cache.scrollPosition = scrollPosition
}

watch(() => route.query.id, (id) => {
  if (!id) {
    void router.replace('/search')
    return
  }
  artist.name = String(route.query.name ?? '')
  artist.img = String(route.query.img ?? '')
  void loadAlbums(String(id))
}, { immediate: true })

const handleSortChange = (value: string) => {
  // 排序纯前端处理（sortedAlbums 会即时重排），仅同步到缓存，不再改写 URL
  window.lx.artistDetailInfo.sort = value == 'oldest' ? 'oldest' : 'newest'
}

const handleAlbumClick = (item: any) => {
  // 离开前记录当前滚动位置，返回时命中缓存即可原样还原
  saveCache(String(route.query.id), listRef.value?.getScrollTop() ?? 0)
  void router.push({ path: '/songList/detail', query: { id: item.id, source: 'wy', type: 'album' } })
}
</script>

<style lang="less" module>
.container { display: flex; flex-direction: column; }
.header { height: 90px; flex: none; display: flex; align-items: center; gap: 12px; padding: 0 15px; }
.avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
.info { min-width: 0; flex: auto; }
.info h2, .info p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.info p { margin-top: 6px; color: var(--color-font-label); font-size: 12px; }
.content { position: relative; flex: auto; min-height: 0; }
.tip { padding: 40px; text-align: center; color: var(--color-font-label); }
</style>
