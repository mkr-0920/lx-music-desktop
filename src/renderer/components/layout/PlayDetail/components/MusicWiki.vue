<template lang="pug">
div(v-if="visible" :class="$style.wiki")
  div(v-if="metaParts.length" :class="$style.metaRow")
    span(v-for="part in metaParts" :key="part" :class="$style.metaItem") {{ part }}
  div(v-if="displayTags.length" :class="$style.tagRow")
    span(v-for="tag in displayTags" :key="tag" :class="$style.tag") {{ tag }}
  template(v-if="intro")
    div(:class="$style.introTitle") {{ $t('player__wiki_intro') }}
    div.scroll(:class="$style.intro") {{ intro }}
</template>

<script>
import { ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { getWiki } from '@renderer/utils/musicSdk/wy/wiki'

// 支持 wiki 的源: wy 系 + mkr 排行榜/日推 (songmid 为网易云数字 ID)
const WIKI_SOURCES = new Set(['wy', 'wy_daily', 'wy_fm', 'mkr'])

export default {
  name: 'MusicWiki',
  setup() {
    const t = useI18n()
    const visible = ref(false)
    const metaParts = ref([])
    const displayTags = ref([])
    const intro = ref('')

    let requestSeq = 0

    const load = () => {
      const seq = ++requestSeq
      visible.value = false
      metaParts.value = []
      displayTags.value = []
      intro.value = ''

      const rawInfo = 'progress' in (playMusicInfo.musicInfo ?? {})
        ? playMusicInfo.musicInfo?.metadata.musicInfo
        : playMusicInfo.musicInfo
      if (!rawInfo) return
      const source = rawInfo.source
      // 新格式 MusicInfo 的歌曲 ID 在 meta.songId (旧格式才是 songmid, 参考 toOldMusicInfo)
      const songmid = rawInfo.meta?.songId ?? rawInfo.songmid
      // mkr 源搜索页的歌 songmid 是自建 API ID,不可查
      if (!songmid || (source == 'mkr' && !/^\d+$/.test(String(songmid)))) return
      if (!WIKI_SOURCES.has(source)) return

      getWiki(songmid).then(wiki => {
        if (seq != requestSeq) return // 已切歌
        const parts = []
        if (wiki.language) parts.push(`${t('player__wiki_language')} ${wiki.language}`)
        if (wiki.bpm) parts.push(`BPM ${wiki.bpm}`)
        if (wiki.entertainment) parts.push(wiki.entertainment)
        if (wiki.award) parts.push(wiki.award)
        if (!parts.length && !wiki.tags.length && !wiki.intro) return

        metaParts.value = parts
        displayTags.value = wiki.tags.slice(0, 6)
        intro.value = wiki.intro
        visible.value = true
      }).catch(() => {
        // 静默失败,不展示
      })
    }

    // 组件在 v-if="isShowPlayerDetail" 容器内,挂载时详情页必然已显示,直接加载
    load()
    watch(() => musicInfo.id, () => {
      load()
    })

    return {
      visible,
      metaParts,
      displayTags,
      intro,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.wiki {
  width: 100%;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-primary-alpha-900);
  display: flex;
  flex-flow: column nowrap;
  min-height: 0;
  overflow: hidden;
}

.metaRow {
  display: flex;
  flex-flow: row wrap;
  gap: 4px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-font-label);
}

.metaItem {
  overflow-wrap: break-word;
}

.tagRow {
  display: flex;
  flex-flow: row wrap;
  gap: 5px;
  margin-top: 8px;
}

.tag {
  padding: 2px 8px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--color-primary-font);
  background-color: var(--color-primary-alpha-900);
  overflow-wrap: break-word;
  max-width: 100%;
}

.introTitle {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-font-label);
  flex-shrink: 0;
}

.intro {
  margin-top: 2px;
  min-height: 0;
  flex: 1 1 auto;
  // 弹性填充 wiki 剩余高度,长简介内部滚动,底部渐隐提示还有更多
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-font);
  opacity: .85;
  overflow-wrap: break-word;
  white-space: pre-line;
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent);
  &:hover {
    -webkit-mask-image: none;
    mask-image: none;
  }
}
</style>
