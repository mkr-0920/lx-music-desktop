<template>
  <div id="my-list" :class="$style.container" @click="handleContainerClick">
    <MyList
      ref="myList"
      :list-id="listId || ''"
      :remote-board-id="remoteBoardId || ''"
      @show-menu="handleHideMusicMenu"
      @remote-state="handleRemoteState"
    />
    <div :class="$style.listContent">
      <div v-if="remoteBoardId" :class="$style.remoteToolbar">
        <div :class="$style.remoteTitle">
          <span>{{ remoteName }}</span>
          <span :class="[$style.remoteStatus, { [$style.dirty]: remoteDirty }]">
            {{ $t(remoteDirty ? 'my_list__wy_unsynced' : 'my_list__wy_synced') }}
          </span>
        </div>
        <div :class="$style.remoteActions">
          <base-btn min @click="handleRefreshRemote">{{ $t('my_list__wy_refresh_current') }}</base-btn>
          <base-btn min :disabled="!remoteDirty" @click="handleSyncRemote">{{ $t('lists__sync_to_cloud') }}</base-btn>
        </div>
      </div>
      <MusicList ref="musicList" :list-id="listId" @show-menu="handleHideSideMenu" />
    </div>
  </div>
</template>

<script>
import { getListPrevSelectId } from '@renderer/utils/data'

import MyList from './MyList/index.vue'
import MusicList from './MusicList/index.vue'

export default {
  name: 'List',
  components: {
    MyList,
    MusicList,
  },
  async beforeRouteEnter(to, from, next) {
    if (to.query.source == 'mkr' && to.query.boardId && to.query.id) {
      next()
      return
    }
    let id = to.query.id
    if (!id) {
      id = await getListPrevSelectId()
      next({
        path: to.path,
        query: { id },
      })
    } else next()
  },
  beforeRouteUpdate(to, from) {
    // console.log(to, from)
    if (to.query.updated) return
    if (to.query.source == 'mkr' && to.query.boardId && to.query.id) {
      this.listId = to.query.id
      this.remoteBoardId = to.query.boardId
      const scrollIndex = to.query.scrollIndex
      const isAnimation = from.query.id == to.query.id
      this.$refs.musicList?.handleRestoreScroll(scrollIndex, isAnimation)
      return {
        path: '/list',
        query: { id: to.query.id, source: 'mkr', boardId: to.query.boardId, remoteEdit: 'true', updated: true },
      }
    }
    let id = to.query.id
    if (id == null) return
    // if (!getList(id)) {
    //   id = defaultList.id
    // }
    this.listId = id
    this.remoteBoardId = null
    const scrollIndex = to.query.scrollIndex
    const isAnimation = from.query.id == to.query.id
    this.$refs.musicList?.handleRestoreScroll(scrollIndex, isAnimation)

    return {
      path: '/list',
      query: { id, updated: true },
    }
  },
  beforeRouteLeave(to, from) {
    this.$refs.musicList?.saveListPosition()
  },
  data() {
    return {
      listId: null,
      remoteBoardId: null,
      remoteName: '',
      remoteDirty: false,
    }
  },
  created() {
    if (this.$route.query.source == 'mkr' && this.$route.query.boardId) {
      this.remoteBoardId = this.$route.query.boardId
    }
    this.listId = this.$route.query.id
  },
  methods: {
    handleHideMusicMenu() {
      this.$refs.musicList?.handleMenuClick()
    },
    handleHideSideMenu() {
      this.$refs.myList?.hideMenu()
    },
    handleRefreshRemote() {
      void this.$refs.myList?.handleRefreshRemote()
    },
    handleSyncRemote() {
      void this.$refs.myList?.handleSyncRemote()
    },
    handleRemoteState({ name, dirty }) {
      this.remoteName = name
      this.remoteDirty = dirty
    },
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  overflow: hidden;
  height: 100%;
  display: flex;
  position: relative;
}

.listContent {
  overflow: hidden;
  height: 100%;
  min-width: 0;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
}

.remoteToolbar {
  min-height: 44px;
  padding: 6px 12px;
  box-sizing: border-box;
  border-bottom: var(--color-list-header-border-bottom);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.remoteTitle {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  > span:first-child {
    .mixin-ellipsis-1();
  }
}
.remoteStatus {
  flex: none;
  color: var(--color-font-label);
  font-size: 11px;

  &.dirty {
    color: var(--color-primary);
  }
}
.remoteActions {
  flex: none;
  display: flex;
  gap: 8px;
}

</style>
