<template>
  <div ref="dom_lists" :class="$style.lists">
    <div :class="$style.listHeader">
      <h2 :class="$style.listsTitle">{{ $t('my_list') }}</h2>
      <div :class="$style.headerBtns">
        <button :class="$style.listsAdd" :aria-label="$t('lists__new_list_btn')" @click="isShowNewList = true">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="70%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-add" />
          </svg>
        </button>
        <button :class="$style.listsAdd" :aria-label="$t('list_update_modal__title')" @click="isShowListUpdateModal = true">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" style="transform: rotate(45deg);" height="70%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-refresh" />
          </svg>
        </button>
      </div>
    </div>
    <ul ref="dom_lists_list" class="scroll" :class="[$style.listsContent, { [$style.sortable]: isModDown }]">
      <li class="default-list" :class="$style.groupTitle">{{ $t('my_list__local_group') }}</li>
      <li
        class="default-list" :class="[$style.listsItem, {[$style.active]: defaultList.id == listId}, {[$style.clicked]: rightClickItemIndex == -2}, {[$style.fetching]: fetchingListStatus[defaultList.id]}]"
        :aria-label="$t(defaultList.name)" :aria-selected="defaultList.id == listId"
        @contextmenu="handleListsItemRigthClick($event, -2)" @click="handleListToggle(defaultList.id)"
      >
        <!-- <div v-if="defaultList.id == listId" :class="$style.activeIcon">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="40%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-right" />
          </svg>
        </div> -->
        <span :class="$style.listsLabel">
          <transition name="list-active">
            <svg-icon v-if="defaultList.id == listId" name="angle-right-solid" :class="$style.activeIcon" />
          </transition>
          {{ $t(defaultList.name) }}
        </span>
      </li>
      <li
        class="default-list" :class="[$style.listsItem, {[$style.active]: loveList.id == listId}, {[$style.clicked]: rightClickItemIndex == -1}, {[$style.fetching]: fetchingListStatus[loveList.id]}]"
        :aria-label="$t(loveList.name)" :aria-selected="loveList.id == listId"
        @contextmenu="handleListsItemRigthClick($event, -1)" @click="handleListToggle(loveList.id)"
      >
        <span :class="$style.listsLabel">
          <transition name="list-active">
            <svg-icon v-if="loveList.id == listId" name="angle-right-solid" :class="$style.activeIcon" />
          </transition>
          {{ $t(loveList.name) }}
        </span>
      </li>
      <li
        v-for="{ item, index } in localUserListEntries"
        :key="item.id" class="user-list"
        :class="[$style.listsItem, {[$style.active]: item.id == listId}, {[$style.clicked]: rightClickItemIndex == index}, {[$style.fetching]: fetchingListStatus[item.id]}]"
        :data-index="index" :aria-label="item.name" :aria-selected="defaultList.id == listId" @contextmenu="handleListsItemRigthClick($event, index)"
      >
        <span :class="$style.listsLabel" @click="handleListToggle(item.id, index + 2)">
          <transition name="list-active">
            <svg-icon v-if="item.id == listId" name="angle-right-solid" :class="$style.activeIcon" />
          </transition>
          {{ item.name }}
        </span>
        <base-input
          :class="$style.listsInput" type="text" :value="item.name"
          :placeholder="item.name" @keyup.enter="handleSaveListName(index, $event)" @blur="handleSaveListName(index, $event)"
        />
      </li>
      <transition enter-active-class="animated-fast slideInLeft" leave-active-class="animated-fast fadeOut" @after-leave="isNewListLeave = false" @after-enter="$refs.dom_listsNewInput.focus()">
        <li v-if="isShowNewList" :class="[$style.listsItem, $style.listsNew, {[$style.newLeave]: isNewListLeave}]">
          <base-input
            ref="dom_listsNewInput" :class="$style.listsInput" type="text" :placeholder="$t('lists__new_list_input')"
            @keyup.enter="handleCreateList" @blur="handleCreateList"
          />
        </li>
      </transition>
      <li class="default-list" :class="$style.groupTitle">
        <span>{{ $t('my_list__wy_group') }}</span>
        <button
          v-if="wyUserId"
          :class="$style.groupAction"
          :aria-label="$t('my_list__wy_refresh')"
          @click.stop="handleRefreshWyLists"
        >
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-refresh" />
          </svg>
        </button>
      </li>
      <li
        v-if="!wyUserId"
        class="default-list"
        :class="[$style.listsItem, $style.statusItem]"
        @click="handleOpenWySetting"
      >
        <span :class="$style.listsLabel">{{ $t('my_list__wy_not_configured') }}</span>
      </li>
      <li v-else-if="wyListStatus == 'loading'" class="default-list" :class="[$style.listsItem, $style.statusItem]">
        <span :class="$style.listsLabel">{{ $t('list__loading') }}</span>
      </li>
      <li
        v-else-if="wyListStatus == 'error'"
        class="default-list"
        :class="[$style.listsItem, $style.statusItem]"
        @click="handleRefreshWyLists"
      >
        <span :class="$style.listsLabel">{{ $t('my_list__wy_load_failed') }}</span>
      </li>
      <template v-else>
        <li
          v-for="item in wyLists"
          :key="item.id"
          class="default-list"
          :class="[$style.listsItem, $style.remoteItem, {[$style.active]: item.id == remoteBoardId}, {[$style.fetching]: remoteOpeningId == item.id}]"
          :aria-label="item.name"
          :aria-selected="item.id == remoteBoardId"
          @click="handleRemoteListToggle(item)"
          @contextmenu="handleRemoteListRightClick($event, item)"
        >
          <span :class="$style.listsLabel">
            <transition name="list-active">
              <svg-icon v-if="item.id == remoteBoardId" name="angle-right-solid" :class="$style.activeIcon" />
            </transition>
            {{ item.name }}
            <span v-if="wyDirtyStatus[item.id]" :class="$style.dirtyStatus">●</span>
          </span>
        </li>
      </template>
    </ul>
    <base-menu v-model="isShowMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
    <base-menu v-model="isShowRemoteMenu" :menus="remoteMenus" :xy="remoteMenuLocation" item-name="name" @menu-click="handleRemoteMenuClick" />
    <DuplicateMusicModal v-model:visible="isShowDuplicateMusicModal" :list-info="duplicateListInfo" />
    <ListSortModal v-model:visible="isShowListSortModal" :list-info="sortListInfo" />
    <ListUpdateModal v-model:visible="isShowListUpdateModal" />
  </div>
</template>

<script>
import { openUrl } from '@common/utils/electron'

import musicSdk from '@renderer/utils/musicSdk'
import DuplicateMusicModal from './components/DuplicateMusicModal.vue'
import ListSortModal from './components/ListSortModal.vue'
import ListUpdateModal from './components/ListUpdateModal.vue'

import { defaultList, loveList, userLists, fetchingListStatus } from '@renderer/store/list/state'
import { removeUserList } from '@renderer/store/list/action'
import { getBoardsList } from '@renderer/store/leaderboard/action'
import {
  ensureWyRemoteDraft,
  findWyRemoteDraft,
  getWyRemoteId,
  isWyRemoteDraftDirty,
  refreshWyRemoteDraft,
  saveWyRemoteDraftAsLocal,
  syncWyRemoteDraft,
} from '@renderer/store/list/wyRemoteDraft'
import { playList } from '@renderer/core/player/action'
import { appSetting } from '@renderer/store/setting'

import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { LIST_IDS } from '@common/constants'

import { dialog } from '@renderer/plugins/Dialog'

import { saveListPrevSelectId } from '@renderer/utils/data'

import { useI18n } from '@renderer/plugins/i18n'


import useShare from './useShare'
import useMenu from './useMenu'
import useListUpdate from './useListUpdate'
import useSort from './useSort'
import useDarg from './useDarg'
import useEditList from './useEditList'
import useListScroll from './useListScroll'
import useDuplicate from './useDuplicate'

export default {
  name: 'MyLists',
  components: {
    DuplicateMusicModal,
    ListSortModal,
    ListUpdateModal,
  },
  props: {
    listId: {
      type: String,
      default: '',
    },
    remoteBoardId: {
      type: String,
      default: '',
    },
  },
  emits: ['show-menu', 'remote-state'],
  setup(props, { emit }) {
    const router = useRouter()
    const t = useI18n()

    const dom_lists_list = ref(null)
    const rightClickItemIndex = ref(-10)
    const wyLists = ref([])
    const wyListStatus = ref('idle')
    const wyUserId = computed(() => appSetting['common.wyUserId'].trim())
    const wyDirtyStatus = reactive({})
    const remoteOpeningId = ref('')
    const remoteMenuItem = ref(null)
    const remoteMenuLocation = reactive({ x: 0, y: 0 })
    const isShowRemoteMenu = ref(false)
    const remoteTargetList = computed(() => remoteMenuItem.value ? findWyRemoteDraft(remoteMenuItem.value.id) : null)
    const remoteMenuDirty = computed(() => remoteMenuItem.value ? !!wyDirtyStatus[remoteMenuItem.value.id] : false)
    const remoteIds = computed(() => new Set(wyLists.value.map(item => getWyRemoteId(item.id))))
    const isRemoteDraftList = list => {
      if (list.id.startsWith('wy_remote_')) return true
      if (list.source == 'wy' && list.sourceListId && remoteIds.value.has(list.sourceListId.replace(/^wy__/, ''))) return true
      return list.source == 'mkr' && !!list.sourceListId?.startsWith('board__mkr__')
    }
    const localUserListEntries = computed(() => userLists
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !isRemoteDraftList(item)))
    const localUserLists = computed(() => localUserListEntries.value.map(({ item }) => item))
    const remoteMenus = computed(() => [
      {
        name: t('list__play'),
        action: 'play',
        disabled: false,
      },
      {
        name: t('my_list__wy_refresh_current'),
        action: 'refresh',
        disabled: remoteMenuDirty.value,
      },
      {
        name: t('my_list__wy_discard_changes'),
        action: 'discard',
        disabled: !remoteMenuDirty.value,
      },
      {
        name: t('lists__sync_to_cloud'),
        action: 'sync_to_cloud',
        disabled: !remoteTargetList.value || !remoteMenuDirty.value,
      },
      {
        name: t('my_list__wy_save_as_local'),
        action: 'save_as_local',
        disabled: false,
      },
    ])

    const { handleImportList, handleExportList } = useShare()
    const { isShowListUpdateModal, handleUpdateSourceList } = useListUpdate()
    const { isShowListSortModal, sortListInfo, handleSortList } = useSort()
    const { isShowDuplicateMusicModal, duplicateListInfo, handleDuplicateList } = useDuplicate()
    const { handleRename, handleSaveListName, isShowNewList, isNewListLeave, handleCreateList } = useEditList({ dom_lists_list })
    useListScroll({ dom_lists_list })

    const handleOpenSourceDetailPage = async(listInfo) => {
      const { source, sourceListId } = listInfo
      if (!sourceListId) return
      let url
      if (/board__/.test(sourceListId)) {
        const id = sourceListId.replace(/board__/, '')
        url = musicSdk[source].leaderboard.getDetailPageUrl(id)
      } else if (musicSdk[source]?.songList?.getDetailPageUrl) {
        url = await musicSdk[source].songList.getDetailPageUrl(sourceListId)
      }
      if (!url) return
      void openUrl(url)
    }

    const handleRemove = (listInfo) => {
      void dialog.confirm({
        message: t('lists__remove_tip', { name: listInfo.name }),
        confirmButtonText: t('lists__remove_tip_button'),
      }).then(isRemove => {
        if (!isRemove) return
        void removeUserList([listInfo.id])
        if (props.listId == listInfo.id) {
          handleListToggle(LIST_IDS.DEFAULT)
        }
      })
    }

    const {
      menus,
      menuLocation,
      isShowMenu,
      showMenu,
      menuClick,
    } = useMenu({
      emit,

      handleImportList,
      handleExportList,
      handleUpdateSourceList,
      handleOpenSourceDetailPage,
      handleSortList,
      handleDuplicateList,
      handleRename,
      handleRemove,
    })

    const handleListsItemRigthClick = (event, index) => {
      isShowRemoteMenu.value = false
      rightClickItemIndex.value = index
      showMenu(event, index)
    }

    const handleListToggle = (id) => {
      if (id == props.listId) return
      router.replace({
        path: '/list',
        query: { id },
      }).catch(_ => _)
    }

    const getWyListItem = (boardId) => {
      for (const item of wyLists.value) {
        if (item.id == boardId) return item
      }
      const targetList = boardId ? findWyRemoteDraft(boardId) : null
      return targetList ? { id: boardId, name: targetList.name } : null
    }
    const emitRemoteState = () => {
      const item = getWyListItem(props.remoteBoardId)
      emit('remote-state', {
        boardId: props.remoteBoardId,
        name: item?.name ?? '',
        dirty: props.remoteBoardId ? !!wyDirtyStatus[props.remoteBoardId] : false,
      })
    }
    const updateRemoteDirtyStatus = async(boardId) => {
      wyDirtyStatus[boardId] = await isWyRemoteDraftDirty(boardId)
      if (boardId == props.remoteBoardId) emitRemoteState()
    }
    const loadWyLists = async() => {
      if (!wyUserId.value) {
        wyLists.value = []
        wyListStatus.value = 'idle'
        emitRemoteState()
        return
      }
      wyListStatus.value = 'loading'
      try {
        const result = await getBoardsList('mkr')
        wyLists.value = result.list
        wyListStatus.value = 'loaded'
        await Promise.all(wyLists.value.map(async item => updateRemoteDirtyStatus(item.id)))
        emitRemoteState()
      } catch (error) {
        console.error('[WY User List] Failed to load playlists:', error)
        wyLists.value = []
        wyListStatus.value = 'error'
      }
    }
    const handleRefreshWyLists = () => {
      void loadWyLists()
    }
    const handleRemoteListToggle = async(item) => {
      if (remoteOpeningId.value) return
      remoteOpeningId.value = item.id
      try {
        const targetList = await ensureWyRemoteDraft(item.id, item.name)
        await updateRemoteDirtyStatus(item.id)
        if (targetList.id == props.listId && item.id == props.remoteBoardId) return
        void router.replace({
          path: '/list',
          query: { id: targetList.id, source: 'mkr', boardId: item.id, remoteEdit: 'true' },
        })
      } finally {
        remoteOpeningId.value = ''
      }
    }
    const handleOpenWySetting = () => {
      void router.push({ path: '/setting' })
    }

    const handleRemoteListRightClick = (event, item) => {
      isShowMenu.value = false
      rightClickItemIndex.value = -10
      remoteMenuItem.value = item
      remoteMenuLocation.x = event.pageX
      remoteMenuLocation.y = event.pageY
      emit('show-menu')
      void nextTick(() => {
        isShowRemoteMenu.value = true
      })
    }

    const refreshRemoteItem = async(item, confirmDiscard = false) => {
      if (confirmDiscard) {
        const confirm = await dialog.confirm({
          message: t('my_list__wy_discard_confirm', { name: item.name }),
          confirmButtonText: t('confirm_button_text'),
        })
        if (!confirm) return
      }
      const targetList = await refreshWyRemoteDraft(item.id, item.name)
      await updateRemoteDirtyStatus(item.id)
      if (props.listId != targetList.id || props.remoteBoardId != item.id) {
        void router.replace({
          path: '/list',
          query: { id: targetList.id, source: 'mkr', boardId: item.id, remoteEdit: 'true' },
        })
      }
    }

    const syncRemoteItem = async(item) => {
      const targetList = findWyRemoteDraft(item.id)
      if (!targetList) return
      const confirm = await dialog.confirm({
        message: t('my_list__wy_sync_to_cloud_confirm', { name: targetList.name }),
        confirmButtonText: t('confirm_button_text'),
      })
      if (!confirm) return
      await syncWyRemoteDraft(item.id)
      await updateRemoteDirtyStatus(item.id)
    }

    const handleSyncRemote = async(boardId = props.remoteBoardId) => {
      const item = getWyListItem(boardId)
      if (item) await syncRemoteItem(item)
    }

    const handleRefreshRemote = async(boardId = props.remoteBoardId) => {
      const item = getWyListItem(boardId)
      if (!item) return
      await refreshRemoteItem(item, !!wyDirtyStatus[item.id])
    }

    const handleRemoteMenuClick = async(action) => {
      isShowRemoteMenu.value = false
      if (!action || !remoteMenuItem.value) return
      const item = remoteMenuItem.value
      switch (action.action) {
        case 'play': {
          const targetList = await ensureWyRemoteDraft(item.id, item.name)
          playList(targetList.id, 0)
          break
        }
        case 'refresh':
          await refreshRemoteItem(item)
          break
        case 'discard':
          await refreshRemoteItem(item, true)
          break
        case 'sync_to_cloud':
          await syncRemoteItem(item)
          break
        case 'save_as_local':
          await ensureWyRemoteDraft(item.id, item.name)
          await saveWyRemoteDraftAsLocal(item.id, t('my_list__wy_local_copy_name', { name: item.name }))
          break
      }
    }

    const handleMenuClick = (action) => {
      if (rightClickItemIndex.value < -2) return
      let index = rightClickItemIndex.value
      rightClickItemIndex.value = -10
      menuClick(action, index)
    }
    const hideMenus = () => {
      isShowMenu.value = false
      isShowRemoteMenu.value = false
      rightClickItemIndex.value = -10
    }

    const { isModDown } = useDarg({ dom_lists_list, handleMenuClick, handleSaveListName, visibleUserLists: localUserLists })

    const handleMyListUpdate = (ids) => {
      let isUpdatedCurrent = false
      for (const item of wyLists.value) {
        const targetList = findWyRemoteDraft(item.id)
        if (!targetList || !ids.includes(targetList.id)) continue
        if (item.id == props.remoteBoardId) isUpdatedCurrent = true
        void updateRemoteDirtyStatus(item.id)
      }
      const currentList = props.remoteBoardId ? findWyRemoteDraft(props.remoteBoardId) : null
      if (!isUpdatedCurrent && currentList && ids.includes(currentList.id)) void updateRemoteDirtyStatus(props.remoteBoardId)
    }
    window.app_event.on('myListUpdate', handleMyListUpdate)


    watch(() => props.listId, (listId) => {
      if (!listId || props.remoteBoardId) return
      saveListPrevSelectId(listId)
    })

    watch(wyUserId, () => {
      void loadWyLists()
    }, { immediate: true })

    watch(() => props.remoteBoardId, (boardId) => {
      if (boardId && findWyRemoteDraft(boardId)) void updateRemoteDirtyStatus(boardId)
      else emitRemoteState()
    })

    watch(() => userLists, (lists) => {
      if (props.remoteBoardId || props.listId == defaultList.id || props.listId == loveList.id || lists.some(l => l.id == props.listId)) return
      void router.replace({
        path: '/list',
        query: {
          id: defaultList.id,
        },
      })
    })

    onBeforeUnmount(() => {
      window.app_event.off('myListUpdate', handleMyListUpdate)
    })

    return {
      rightClickItemIndex,
      defaultList,
      loveList,
      userLists,
      localUserListEntries,
      wyLists,
      wyUserId,
      wyListStatus,
      wyDirtyStatus,
      remoteOpeningId,
      fetchingListStatus,
      dom_lists_list,
      isShowListUpdateModal,
      isShowListSortModal,
      sortListInfo,
      isShowDuplicateMusicModal,
      duplicateListInfo,
      handleSaveListName,
      isShowNewList,
      isNewListLeave,
      handleCreateList,
      handleListsItemRigthClick,
      isShowMenu,
      handleMenuClick,
      menus,
      menuLocation,
      remoteMenus,
      remoteMenuLocation,
      isShowRemoteMenu,
      handleListToggle,
      handleRefreshWyLists,
      handleRemoteListToggle,
      handleRemoteListRightClick,
      handleRemoteMenuClick,
      handleSyncRemote,
      handleRefreshRemote,
      handleOpenWySetting,
      isModDown,
      hideMenu: hideMenus,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@lists-item-height: 36px;
.lists {
  flex: none;
  width: 16%;
  display: flex;
  flex-flow: column nowrap;
}
.listHeader {
  position: relative;
  display: flex;
  flex-flow: row nowrap;
  border-bottom: var(--color-list-header-border-bottom);
  &:hover {
    .listsAdd {
      opacity: 1;
    }
  }
}
.listsTitle {
  flex: auto;
  font-size: 12px;
  line-height: 38px;
  padding: 0 10px;
  .mixin-ellipsis-1();
}
.headerBtns {
  flex: none;
  display: flex;
}
.listsAdd {
  // position: absolute;
  // right: 0;
  margin-top: 6px;
  background: none;
  height: 30px;
  border: none;
  outline: none;
  border-radius: @radius-border;
  cursor: pointer;
  opacity: .1;
  transition: opacity @transition-normal;
  color: var(--color-button-font);
  svg {
    vertical-align: bottom;
  }
  &:active {
    opacity: .7 !important;
  }
  &:hover {
    opacity: .6 !important;
  }
}
.listsContent {
  flex: auto;
  min-width: 0;
  overflow-y: scroll !important;
  // border-right: 1px solid rgba(0, 0, 0, 0.12);

  &.sortable {
    * {
      -webkit-user-drag: element;
    }

    .listsItem {
      &:hover, &.active, &.selected, &.clicked {
        background-color: transparent !important;
      }

      &.dragingItem {
        background-color: var(--color-primary-background-hover) !important;
      }
    }
  }
}
.groupTitle {
  min-height: 30px;
  padding: 8px 10px 3px;
  box-sizing: border-box;
  color: var(--color-font-label);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.groupAction {
  width: 22px;
  height: 22px;
  padding: 4px;
  border: 0;
  background: none;
  color: inherit;
  opacity: .55;
  cursor: pointer;
  transition: opacity @transition-fast;

  svg {
    width: 100%;
    height: 100%;
  }

  &:hover {
    opacity: 1;
  }
}
.remoteItem .listsLabel {
  padding-left: 18px;
}
.dirtyStatus {
  margin-left: 5px;
  color: var(--color-primary);
  font-size: 10px;
}
.statusItem {
  color: var(--color-font-label);
  font-size: 12px;
}
.listsItem {
  position: relative;
  transition: .3s ease;
  transition-property: color, background-color, opacity;
  background-color: transparent;
  &:not(.active) {
    &:hover {
      background-color: var(--color-primary-background-hover);
      cursor: pointer;
    }
  }
  &.active {
    // background-color:
    color: var(--color-primary);
  }
  &.selected {
    background-color: var(--color-primary-font-active);
  }
  &.clicked {
    background-color: var(--color-primary-background-hover);
  }
  &.fetching {
    opacity: .5;
  }
  &.editing {
    padding: 0 10px;
    background-color: var(--color-primary-background-hover);
    .listsLabel {
      display: none;
    }
    .listsInput {
      display: block;
    }
  }
}
.activeIcon {
  height: .9em;
  width: .9em;
  margin-left: -0.45em;
  vertical-align: -0.05em;
}
.listsLabel {
  display: block;
  height: @lists-item-height;
  padding: 0 10px;
  font-size: 13px;
  line-height: @lists-item-height;
  .mixin-ellipsis-1();
}
.listsInput {
  width: 100%;
  height: @lists-item-height;
  // border: none;
  padding: 0;
  // padding-bottom: 1px;
  line-height: @lists-item-height;
  background: none !important;
  border-radius: 0;
  // outline: none;
  font-size: 13px;
  display: none;
  // font-family: inherit;
}

.listsNew {
  padding: 0 10px;
  background-color: var(--color-primary-background-hover) !important;
  .listsInput {
    display: block;
  }
}
.newLeave {
  margin-top: -@lists-item-height;
  z-index: -1;
}


</style>
