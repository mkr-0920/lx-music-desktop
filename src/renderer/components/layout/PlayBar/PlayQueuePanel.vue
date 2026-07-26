<template>
  <teleport to="#root">
    <div v-if="show" :class="$style.mask" @click.self="close">
      <section :class="$style.panel" role="dialog" :aria-label="$t('player__queue_title')" @click.stop>
        <header :class="$style.header">
          <div>
            <h3>{{ $t('player__queue_title') }}</h3>
            <p>{{ $t('player__queue_count', { count: playQueue.length }) }}</p>
          </div>
          <div :class="$style.actions">
            <common-toggle-play-mode-btn />
            <button :disabled="!hasPending" @click="clearPendingPlayQueue">
              {{ $t('player__queue_clear') }}
            </button>
            <button :class="$style.closeBtn" :aria-label="$t('close')" @click="close">
              <svg viewBox="0 0 24 24"><use xlink:href="#icon-close" /></svg>
            </button>
          </div>
        </header>

        <div v-if="playQueue.length" ref="listEl" class="scroll" :class="$style.list">
          <div
            v-for="(item, index) in playQueue"
            :key="item.queueId"
            data-queue-item
            :data-index="index"
            :data-current="index == playQueueIndex ? 'true' : null"
            :data-queue-locked="index <= playQueueIndex ? 'true' : null"
            :class="[
              $style.item,
              { [$style.current]: index == playQueueIndex },
              { [$style.played]: index < playQueueIndex },
              { [$style.draggable]: index > playQueueIndex },
            ]"
            @dblclick="playQueueItem(index)"
          >
            <span :class="$style.position">
              <svg v-if="index == playQueueIndex" viewBox="0 0 512 512"><use xlink:href="#icon-play" /></svg>
              <template v-else>{{ index + 1 }}</template>
            </span>
            <div :class="$style.info" @click="playQueueItem(index)">
              <div :class="$style.name">{{ getMusicInfo(item).name }}</div>
              <div :class="$style.singer">{{ getMusicInfo(item).singer }}</div>
            </div>
            <span v-if="item.origin != 'source'" :class="$style.badge">
              {{ $t(item.origin == 'play_next' ? 'player__queue_play_next' : 'player__queue_play_later') }}
            </span>
            <button
              v-if="index > playQueueIndex"
              :class="$style.removeBtn"
              :aria-label="$t('player__queue_remove')"
              @click.stop="removePlayQueueItem(index)"
            >
              <svg viewBox="0 0 24 24"><use xlink:href="#icon-close" /></svg>
            </button>
          </div>
        </div>
        <div v-else :class="$style.empty">{{ $t('player__queue_empty') }}</div>
      </section>
    </div>
  </teleport>
</template>

<script setup>
import Sortable from 'sortablejs'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useCssModule, watch } from '@common/utils/vueTools'
import { playQueue, playQueueIndex } from '@renderer/store/player/state'
import { clearPendingPlayQueue, movePlayQueueItem, removePlayQueueItem } from '@renderer/store/player/action'
import { playQueueItem } from '@renderer/core/player'

const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['update:show'])
const styles = useCssModule()
const listEl = ref(null)
let sortable

const hasPending = computed(() => playQueue.length > playQueueIndex.value + 1)
const close = () => {
  emit('update:show', false)
}
const getMusicInfo = item => 'progress' in item.musicInfo ? item.musicInfo.metadata.musicInfo : item.musicInfo

const destroySortable = () => {
  sortable?.destroy()
  sortable = null
}

const initSortable = () => {
  if (!listEl.value || sortable) return
  sortable = Sortable.create(listEl.value, {
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 4,
    supportPointer: false,
    draggable: '[data-queue-item]',
    filter: '[data-queue-locked="true"], button',
    preventOnFilter: false,
    chosenClass: styles.chosen,
    dragClass: styles.dragging,
    ghostClass: styles.dragging,
    fallbackClass: styles.fallback,
    onMove(event) {
      const draggedIndex = Number(event.dragged.dataset.index)
      const relatedIndex = Number(event.related.dataset.index)
      if (draggedIndex <= playQueueIndex.value || relatedIndex < playQueueIndex.value) return false
      if (relatedIndex == playQueueIndex.value) return event.willInsertAfter
      return true
    },
    onUpdate(event) {
      if (event.oldIndex == null || event.newIndex == null || event.oldIndex == event.newIndex) return
      movePlayQueueItem(event.oldIndex, event.newIndex)
    },
  })
}

const scrollToCurrent = () => {
  void nextTick(() => {
    initSortable()
    listEl.value?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'center' })
  })
}

const handleKeydown = event => {
  if (props.show && event.key == 'Escape') close()
}

watch(() => props.show, visible => {
  if (visible) scrollToCurrent()
})

watch(listEl, element => {
  destroySortable()
  if (element) void nextTick(initSortable)
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (props.show) scrollToCurrent()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  destroySortable()
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, .08);
}

.panel {
  position: absolute;
  right: 14px;
  bottom: calc(@height-player + 10px);
  width: min(430px, calc(100vw - 28px));
  height: min(600px, calc(100vh - @height-player - 34px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--color-font);
  background: var(--color-content-background);
  border: 1px solid var(--color-primary-alpha-900);
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, .24);
  -webkit-app-region: no-drag;
}

.header {
  min-height: 64px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-primary-alpha-900);
  box-sizing: border-box;

  h3, p { margin: 0; }
  h3 { font-size: 16px; font-weight: 600; }
  p { margin-top: 4px; color: var(--color-font-label); font-size: 12px; }
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;

  button {
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    color: var(--color-button-font);
    background: transparent;
    cursor: pointer;
    &:hover { background: var(--color-primary-background-hover); }
    &:disabled { opacity: .35; cursor: default; background: transparent; }
  }
}

.actions .closeBtn {
  width: 28px;
  padding: 5px;
  svg { width: 100%; height: 100%; fill: currentColor; }
}

.list { flex: 1; overflow-y: auto; padding: 6px 0; }
.item {
  min-height: 52px;
  padding: 5px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  user-select: none;
  transition: background-color @transition-fast, opacity @transition-fast;
  &:hover { background: var(--color-primary-background-hover); }
}
.draggable { cursor: grab; }
.draggable:active { cursor: grabbing; }
.current { color: var(--color-button-font-selected); background: var(--color-primary-background-hover); }
.played { opacity: .5; }
.chosen { background: var(--color-primary-background-active); }
.dragging { opacity: .35; background: var(--color-primary-background-active); }
.fallback { opacity: .9; box-shadow: 0 4px 16px rgba(0, 0, 0, .24); }
.position { width: 24px; flex: none; text-align: center; color: var(--color-font-label); font-size: 12px; }
.position svg { width: 14px; height: 14px; fill: currentColor; }
.info { min-width: 0; flex: 1; cursor: pointer; }
.name, .singer { .mixin-ellipsis-1(); }
.name { font-size: 13px; }
.singer { margin-top: 3px; color: var(--color-font-label); font-size: 11px; }
.badge { flex: none; padding: 2px 5px; border-radius: 3px; color: var(--color-font-label); background: var(--color-primary-background-hover); font-size: 10px; }
.removeBtn {
  width: 26px;
  height: 26px;
  flex: none;
  padding: 5px;
  border: 0;
  color: var(--color-font-label);
  background: transparent;
  opacity: 0;
  cursor: pointer;
  svg { width: 100%; height: 100%; fill: currentColor; }
  .item:hover & { opacity: .8; }
  &:hover { opacity: 1 !important; }
}
.empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--color-font-label); font-size: 13px; }
</style>
