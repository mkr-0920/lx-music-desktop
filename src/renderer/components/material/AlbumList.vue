<template>
  <div :class="$style.container">
    <div ref="dom_list_ref" :class="$style.listContent" class="scroll">
      <div :class="$style.grid">
        <div
          v-for="item in listInfo.list"
          :key="item.id"
          :class="$style.item"
          @click="handleClick(item)"
        >
          <div :class="$style.coverWrapper">
            <img :src="item.img" :class="$style.cover" loading="lazy" />
            <div v-if="item.size" :class="$style.sizeBadge">{{ item.size }} 首</div>
          </div>
          <div :class="$style.info">
            <div :class="$style.name" :title="item.name">{{ item.name }}</div>
            <div :class="$style.singer" :title="item.singer">{{ item.singer }}</div>
            <div :class="$style.meta" :title="item.company">
              {{ item.publishTime }}
              <span v-if="item.company">· {{ item.company }}</span>
            </div>
          </div>
        </div>
      </div>

      <div :class="$style.pagination">
        <material-pagination
          :count="listInfo.total"
          :limit="listInfo.limit"
          :page="listInfo.page"
          @btn-click="handleTogglePage"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from '@common/utils/vueTools'

defineProps({
  listInfo: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['click-item', 'toggle-page'])

// 【修正】：声明内部滚动容器的 ref
const dom_list_ref = ref<HTMLElement | null>(null)

const handleClick = (item: any) => {
  emit('click-item', item)
}

const handleTogglePage = (page: number) => {
  emit('toggle-page', page)
}

// 【极其关键的修正】：向外暴露滚动方法，这样翻页后 useList.ts 就能控制列表回到顶部
defineExpose({
  scrollTo(top: number) {
    dom_list_ref.value?.scrollTo({ top })
  },
  getScrollTop() {
    return dom_list_ref.value?.scrollTop ?? 0
  },
})
</script>

<style lang="less" module>
.container {
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  position: relative;
}

.listContent {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 15px 15px 0;
  box-sizing: border-box;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 20px;
}

.item {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-4px);
    .cover {
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }
  }
}

.coverWrapper {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
}

.cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: box-shadow 0.3s ease;
}

.sizeBadge {
  position: absolute;
  top: 6px;
  right: 6px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  backdrop-filter: blur(4px);
  z-index: 2;
}

.info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.name {
  width: 100%;
  font-size: 14px;
  font-weight: bold;
  color: var(--color-font);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.singer {
  width: 100%;
  font-size: 12px;
  color: var(--color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.meta {
  width: 100%;
  font-size: 11px;
  color: var(--color-font-label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pagination {
  text-align: center;
  padding: 20px 0;
}
</style>
