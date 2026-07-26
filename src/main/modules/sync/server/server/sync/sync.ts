import { FeaturesList } from '../../../../../../common/constants_sync'
import { featureVersion, modules } from '../../modules'

let syncQueue: Promise<void> = Promise.resolve()

export const runSyncTask = async<T>(task: () => Promise<T>): Promise<T> => {
  const currentTask = syncQueue.catch(() => {}).then(task)
  syncQueue = currentTask.then(() => {}, () => {})
  return currentTask
}

export const sync = async(socket: LX.Sync.Server.Socket) => {
  let disconnected = false
  const removeCloseListener = socket.onClose(() => {
    disconnected = true
  })

  try {
    await runSyncTask(async() => {
      const enabledFeatures = await socket.remote.getEnabledFeatures('desktop-app', featureVersion)

      if (disconnected) throw new Error('disconnected')
      for (const moduleName of FeaturesList) {
        if (enabledFeatures[moduleName]) {
          socket.feature[moduleName] = enabledFeatures[moduleName]
          await modules[moduleName].sync(socket)
        }
        if (disconnected) throw new Error('disconnected')
      }
      await socket.remote.finished()
    })
  } finally {
    removeCloseListener()
  }
}
