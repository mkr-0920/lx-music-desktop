<template>
  <span v-if="label" :class="$style.badge" :title="tooltip" :aria-label="tooltip">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from '@common/utils/vueTools'
import { useI18n } from '@root/lang'
import { sourceNames } from '@renderer/store'
import { playbackSource, playMusicInfo } from '@renderer/store/player/state'

const t = useI18n()

const originSource = computed<LX.Source | null>(() => {
  const musicInfo = playMusicInfo.musicInfo
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo.source : musicInfo.source
})

const getSourceLabel = (source: LX.Source) => source == 'local' ? 'LOCAL' : source.toUpperCase()
const getSourceName = (source: LX.Source) => source == 'local'
  ? t('player__source_local')
  : sourceNames.value[source]

const label = computed(() => {
  const origin = originSource.value
  if (!origin) return ''
  const actual = playbackSource.value ?? origin
  return origin == actual
    ? getSourceLabel(actual)
    : `${getSourceLabel(origin)} \u2192 ${getSourceLabel(actual)}`
})

const tooltip = computed(() => {
  const origin = originSource.value
  if (!origin) return ''
  const actual = playbackSource.value ?? origin
  return origin == actual
    ? t('player__source_tip', { source: getSourceName(origin) })
    : t('player__source_toggled_tip', {
      origin: getSourceName(origin),
      actual: getSourceName(actual),
    })
})
</script>

<style lang="less" module>
.badge {
  flex: none;
  height: 16px;
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 3px;
  color: var(--color-primary);
  background-color: var(--color-primary-light-300-alpha-700);
  font-family: Consolas, "Courier New", monospace;
  font-size: 9px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  user-select: none;
}
</style>
