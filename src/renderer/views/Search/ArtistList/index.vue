<template>
  <div :class="$style.container" class="scroll">
    <div v-if="loading || error || (!list.length && searchText)" :class="$style.tip">
      {{ loading ? $t('list__loading') : error ? $t('list__load_failed') : $t('no_item') }}
    </div>
    <div v-else :class="$style.grid">
      <button v-for="item in list" :key="item.id" :class="$style.item" @click="handleClick(item)">
        <img :src="item.img" :class="$style.cover" loading="lazy" />
        <span :class="$style.name">{{ item.name }}</span>
        <span v-if="item.alias.length" :class="$style.alias">{{ item.alias.join(' / ') }}</span>
        <span :class="$style.meta">{{ $t('artist__album_count', { count: item.albumCount }) }}</span>
      </button>
    </div>
    <material-pagination
      v-if="total > limit"
      :count="total"
      :limit="limit"
      :page="page"
      @btn-click="togglePage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { searchText } from '@renderer/store/search/state'
import { addHistoryWord } from '@renderer/store/search/action'
import music from '@renderer/utils/musicSdk'

const props = defineProps<{ page: number }>()
const router = useRouter()
const route = useRoute()
const list = ref<any[]>([])
const total = ref(0)
const limit = 30
const loading = ref(false)
const error = ref(false)
let requestKey = ''

const search = async(text: string, page: number) => {
  if (!text) {
    list.value = []
    total.value = 0
    return
  }
  void addHistoryWord(text)
  const key = `${text}__${page}`
  requestKey = key
  loading.value = true
  error.value = false
  try {
    const result = await (music as any).wy.artist.search(text, page, limit)
    if (requestKey != key) return
    list.value = result.list
    total.value = result.total
  } catch {
    if (requestKey == key) error.value = true
  } finally {
    if (requestKey == key) loading.value = false
  }
}

watch(() => [searchText.value, props.page], ([text, page]) => {
  void search(text as string, page as number || 1)
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
