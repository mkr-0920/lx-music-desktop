import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { registerListActionEvent } from '../../../../listEvent'
import { getUserSpace } from '../../../user'
import { runListSyncTask } from './sync'

// let socket: LX.Sync.Server.Socket | null
let unregisterLocalListAction: (() => void) | null


const sendListAction = async(wss: LX.Sync.Server.SocketServer, action: LX.Sync.List.ActionList) => {
  await runListSyncTask(async() => {
    // console.log('sendListAction', action.action)
    const clients = [...wss.clients].filter(client => client.moduleReadys?.list)
    if (!clients.length) return
    const userSpace = getUserSpace()
    const key = await userSpace.listManage.createSnapshot()
    await Promise.all(clients.map(async(client) => {
      await client.remoteQueueList.onListSyncAction(action).then(async() => {
        await userSpace.listManage.updateDeviceSnapshotKey(client.keyInfo.clientId, key)
      }).catch(err => {
        // TODO send status
        client.close(SYNC_CLOSE_CODE.failed)
        // client.moduleReadys.list = false
        console.log(err.message)
      })
    }))
  })
}

export const registerEvent = (wss: LX.Sync.Server.SocketServer) => {
  // socket = _socket
  // socket.onClose(() => {
  //   unregisterLocalListAction?.()
  //   unregisterLocalListAction = null
  // })
  unregisterEvent()
  unregisterLocalListAction = registerListActionEvent((action) => {
    void sendListAction(wss, action).catch(err => {
      console.error(err)
    })
  })
}

export const unregisterEvent = () => {
  unregisterLocalListAction?.()
  unregisterLocalListAction = null
}
