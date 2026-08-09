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
      <div v-if="error && !albums.length" :class="$style.tip">{{ $t('list__load_failed') }}</div>
      <AlbumGrid v-else ref="listRef" :list-info="listInfo" @click-item="handleAlbumClick" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from '@common/utils/vueTools'
import { onBeforeRouteLeave, useRoute, useRouter } from '@common/utils/vueRouter'
import music from '@renderer/utils/musicSdk'
import AlbumGrid from '@renderer/components/material/AlbumList.vue'

const route = useRoute()
const router = useRouter()

interface AlbumGridRef {
  scrollTo: (top: number) => void
  getScrollTop: () => number
}

// 最多缓存几个歌手的专辑列表（LRU，最近访问的排在最前）
const MAX_CACHE_SIZE = 5

const albums = ref<any[]>([])
const listRef = ref<AlbumGridRef | null>(null)
const loading = ref(false)
const error = ref(false)
const sort = ref('newest')
const artist = reactive({ name: '', img: '' })

// 每次进入 / 切换歌手都自增，异步分页循环靠比对它判断自己是否已过期
let loadToken = 0

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
  noItemLabel: sortedAlbums.value.length
    ? ''
    : loading.value ? window.i18n.t('list__loading') : window.i18n.t('no_item'),
}))

const findCache = (id: string) => window.lx.artistDetailInfo.caches.find(item => item.id == id)

// 取出（或新建）该歌手的缓存，并把它提到 LRU 队首
const useCache = (id: string) => {
  const caches = window.lx.artistDetailInfo.caches
  let cache = findCache(id)
  if (cache) {
    const index = caches.indexOf(cache)
    if (index > 0) {
      caches.splice(index, 1)
      caches.unshift(cache)
    }
  } else {
    cache = { id, name: '', img: '', albums: [], sort: 'newest', scrollPosition: 0, nextPage: 1, more: true }
    caches.unshift(cache)
  }
  if (caches.length > MAX_CACHE_SIZE) caches.length = MAX_CACHE_SIZE
  return cache
}

const loadAlbums = async(id: string) => {
  const token = ++loadToken
  const cache = useCache(id)

  // 先渲染已缓存的部分：可能是完整列表，也可能是上次中途离开时留下的前几页
  if (cache.albums.length) {
    albums.value = cache.albums.slice()
    sort.value = cache.sort
    if (cache.name) artist.name = cache.name
    if (cache.img) artist.img = cache.img
    error.value = false
    await nextTick()
    if (token != loadToken) return
    listRef.value?.scrollTo(cache.scrollPosition)
  } else {
    albums.value = []
  }

  // 所有分页都拉过了，完全命中缓存，不再联网
  if (!cache.more) {
    loading.value = false
    error.value = false
    return
  }

  loading.value = true
  error.value = false
  try {
    while (cache.more) {
      const result = await (music as any).wy.artist.getAlbums(id, cache.nextPage)
      // 组件已卸载或已切到别的歌手：丢弃本页结果，且不推进 nextPage，下次重新拉这一页
      if (token != loadToken) return
      if (result.artist) {
        artist.name = result.artist.name || artist.name
        artist.img = result.artist.picUrl || artist.img
        cache.name = artist.name
        cache.img = artist.img
      }
      albums.value.push(...result.list)
      // 边拉边写缓存，中途离开也能保住已拿到的页
      cache.albums = albums.value.slice()
      cache.nextPage++
      cache.more = result.more
    }
  } catch {
    if (token != loadToken) return
    error.value = true
  } finally {
    if (token == loadToken) loading.value = false
  }
}

// 记录排序与滚动位置，返回时原样还原
const saveViewState = () => {
  const cache = findCache(String(route.query.id))
  if (!cache) return
  cache.sort = sort.value
  cache.scrollPosition = listRef.value?.getScrollTop() ?? cache.scrollPosition
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

onBeforeRouteLeave(saveViewState)
onBeforeUnmount(() => {
  saveViewState()
  // 让仍在跑的分页循环在下次 await 返回时自行退出，避免卸载后继续发请求 / 回写缓存
  loadToken++
})

const handleSortChange = (value: string) => {
  // 排序纯前端处理（sortedAlbums 会即时重排），只需同步到缓存
  const cache = findCache(String(route.query.id))
  if (cache) cache.sort = value == 'oldest' ? 'oldest' : 'newest'
}

const handleAlbumClick = (item: any) => {
  // 滚动位置由 onBeforeRouteLeave 统一保存
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
