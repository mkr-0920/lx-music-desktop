<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <base-tab v-model="source" :list="sources" @change="handleSourceChange" />
      <base-tab v-model="searchType" :list="searchTypes" @change="handleTypeChange" />
    </div>
    <div :class="$style.main">
      <song-list-list v-if="searchType == 'songlist'" v-show="searchText" :page="page" :source-id="source" />
      <album-list v-else-if="searchType == 'album'" v-show="searchText" :page="page" :source-id="source" />
      <artist-list v-else-if="searchType == 'artist'" v-show="searchText" :page="page" />
      <music-list v-else v-show="searchText" :page="page" :source-id="source" />

      <blank-view :visible="!searchText" :source="source" />
    </div>
  </div>
</template>

<script>
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { searchText } from '@renderer/store/search/state'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'
import { sources as musicSources } from '@renderer/store/search/music'
import { sources as songListSources } from '@renderer/store/search/songlist'
import { sources as albumSources } from '@renderer/store/search/album'

import MusicList from './MusicList/index.vue'
import SongListList from './SongListList/index.vue'
import AlbumList from './AlbumList/index.vue'
import ArtistList from './ArtistList/index.vue'
import BlankView from './components/BlankView.vue'
import { computed, ref } from '@common/utils/vueTools'
import { sourceNames } from '@renderer/store'

const source = ref('kw')
const searchType = ref(null)
const page = ref(1)

const getSources = type => type == 'album' || type == 'artist'
  ? albumSources.filter(source => source == 'wy')
  : type == 'songlist' ? songListSources : musicSources

const verifyQueryParams = async(to, from, next) => {
  let _source = to.query.source
  let _type = to.query.type
  let _page = to.query.page

  if (_source == null || _type == null) {
    const setting = await getSearchSetting()
    _source ??= setting.source
    _type ??= setting.type

    const availableSources = getSources(_type)
    if (!availableSources.includes(_source)) _source = availableSources[0]
    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: _page },
    })
    return
  }
  const availableSources = getSources(_type)
  if (!availableSources.includes(_source)) {
    _source = availableSources[0]
    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: 1 },
    })
    void setSearchSetting({ source: _source, type: _type })
    return
  }
  source.value = _source
  searchType.value = _type

  if (_page) page.value = parseInt(_page)

  if (to.query.text != null) {
    searchText.value = to.query.text
    if (!_page) page.value = 1
  }
  next()
  void setSearchSetting({ source: _source, type: _type })
}

export default {
  components: {
    MusicList,
    SongListList,
    AlbumList,
    ArtistList,
    BlankView,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const route = useRoute()
    const router = useRouter()

    const sources = computed(() => getSources(searchType.value).map(id => ({
      id,
      label: sourceNames.value[id],
    })))
    const handleSourceChange = (id) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          source: id,
          page: 1,
        },
      })
    }

    const searchTypes = computed(() => {
      return [
        { label: window.i18n.t('search__type_music'), id: 'music' },
        { label: window.i18n.t('search__type_album'), id: 'album' },
        { label: window.i18n.t('search__type_artist'), id: 'artist' },
        { label: window.i18n.t('search__type_songlist'), id: 'songlist' },
      ]
    })

    const handleTypeChange = (type) => {
      const availableSources = getSources(type)
      const nextSource = availableSources.includes(source.value) ? source.value : availableSources[0]
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          type,
          source: nextSource,
          page: 1,
        },
      })
    }

    return {
      sources,
      source,
      handleSourceChange,
      searchTypes,
      searchType,
      handleTypeChange,
      page,
      searchText,
    }
  },
}
</script>

<style lang="less" module>
.container {
  display: flex;
  flex-flow: column nowrap;
}

.header {
  // padding: 5px 0;
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
}

.main {
  position: relative;
  flex: auto;
  // min-height: 0;
}
</style>
