// 这个文件导出的方法将暴露给客户端调用，第一个参数固定为当前 socket 对象
// import { throttle } from '@common/utils/common'
// import { sendSyncActionList } from '@main/modules/winMain'
// import { SYNC_CLOSE_CODE } from '@/constants'
// import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { getUserSpace } from '@main/modules/sync/server/user'
import { handleRemoteDislikeAction } from '@main/modules/sync/dislikeEvent'
import { runDislikeSyncTask } from './sync'
// import { encryptMsg } from '@/utils/tools'


const handler: LX.Sync.ServerSyncHandlerDislikeActions<LX.Sync.Server.Socket> = {
  async onDislikeSyncAction(socket, action) {
    if (!socket.moduleReadys.dislike) return
    await runDislikeSyncTask(async() => {
      if (!socket.moduleReadys.dislike) return
      await handleRemoteDislikeAction(action)
      const userSpace = getUserSpace(socket.userInfo.name)
      const key = await userSpace.dislikeManage.createSnapshot()
      const currentUserName = socket.userInfo.name
      const currentId = socket.keyInfo.clientId
      const broadcastTasks: Array<Promise<void>> = []
      const currentDislikeRules = await userSpace.dislikeManage.getDislikeRules()
      broadcastTasks.push(socket.remoteQueueDislike.onDislikeSyncAction({
        action: 'dislike_data_overwrite',
        data: currentDislikeRules,
      }).then(async() => {
        await userSpace.dislikeManage.updateDeviceSnapshotKey(currentId, key)
      }).catch(err => {
        socket.close(SYNC_CLOSE_CODE.failed)
        console.log(err.message)
      }))
      socket.broadcast((client) => {
        if (client.keyInfo.clientId == currentId || !client.moduleReadys?.dislike || client.userInfo.name != currentUserName) return
        broadcastTasks.push(client.remoteQueueDislike.onDislikeSyncAction(action).then(async() => {
          await userSpace.dislikeManage.updateDeviceSnapshotKey(client.keyInfo.clientId, key)
        }).catch(err => {
        // TODO send status
          client.close(SYNC_CLOSE_CODE.failed)
          // client.moduleReadys.dislike = false
          console.log(err.message)
        }))
      })
      await Promise.all(broadcastTasks)
    })
  },
}

export default handler
